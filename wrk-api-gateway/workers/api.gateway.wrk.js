'use strict'

const async = require('async')
const WrkBase = require('wrk-base/workers/base.wrk')
const ApiServer = require('./lib/api-server')
const OrchestratorClient = require('./lib/orchestrator-client')
const AuthManager = require('./lib/auth-manager')

/**
 * API Gateway Worker class
 * Handles HTTP requests and routes them to internal services via RPC
 * @class WrkApiGateway
 * @extends WrkBase
 */
class WrkApiGateway extends WrkBase {
  /**
   * Creates an instance of WrkApiGateway
   * @param {Object} conf - Configuration object
   * @param {Object} ctx - Context object
   * @throws {Error} If required context is missing
   */
  constructor (conf, ctx) {
    super(conf, ctx)

    this.prefix = `api-gateway-${ctx.port || 3000}`
    this.apiServer = null
    this.orchestratorClient = null
    this.authManager = null
    this.requestCache = new Map()
    this.rateLimiter = new Map()

    this.init()
    this.start()
  }

  /**
   * Initialize the worker
   */
  init () {
    super.init()

    this.setInitFacs([
      ['fac', 'bfx-facs-interval', '0', '0', {}, 0],
      ['fac', 'bfx-facs-lru', '15m', '15m', { max: 10000, maxAge: 60000 * 15 }],
      ['fac', 'bfx-facs-http', 'c0', 'c0', { timeout: 30000, debug: false }, 1],
      ['fac', 'svc-facs-httpd', 'h0', 'h0', {
        port: this.conf.port || 3000,
        host: this.conf.host || '0.0.0.0',
        logger: true,
        addDefaultRoutes: true,
        trustProxy: true
      }, 1]
    ])

    this.apiServer = new ApiServer(this.conf, this.logger)
    this.orchestratorClient = new OrchestratorClient(this.conf, this.logger)
    this.authManager = new AuthManager(this.conf, this.logger)
  }

  /**
   * Start the worker and set up HTTP routes
   * @param {Function} cb - Callback function
   */
  _start (cb) {
    async.series([
      next => { super._start(next) },
      async () => {
        const httpd = this.httpd_h0

        // Set up routes
        this.setupRoutes(httpd)

        // Initialize components
        await this.orchestratorClient.initialize()
        await this.authManager.initialize()

        // Start HTTP server
        await httpd.startServer()

        // Start background processes
        this.startRateLimitCleanup()

        this.logger.info(`API Gateway started on port ${this.conf.port || 3000}`)
      }
    ], cb)
  }

  /**
   * Set up HTTP routes
   * @param {Object} httpd - HTTP server instance
   */
  setupRoutes (httpd) {
    // Health check endpoint
    httpd.addRoute({
      method: 'GET',
      path: '/health',
      handler: this.handleHealthCheck.bind(this)
    })

    // Inference endpoint
    httpd.addRoute({
      method: 'POST',
      path: '/api/v1/inference/:modelId',
      handler: this.handleInferenceRequest.bind(this)
    })

    // Model management endpoints
    httpd.addRoute({
      method: 'GET',
      path: '/api/v1/models',
      handler: this.handleListModels.bind(this)
    })

    httpd.addRoute({
      method: 'GET',
      path: '/api/v1/models/:modelId',
      handler: this.handleGetModel.bind(this)
    })

    httpd.addRoute({
      method: 'POST',
      path: '/api/v1/models',
      handler: this.handleCreateModel.bind(this)
    })

    // Service status endpoint
    httpd.addRoute({
      method: 'GET',
      path: '/api/v1/status',
      handler: this.handleServiceStatus.bind(this)
    })

    // CORS preflight
    httpd.addRoute({
      method: 'OPTIONS',
      path: '*',
      handler: this.handleCorsPreflight.bind(this)
    })
  }

  /**
   * Handle health check requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async handleHealthCheck (req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        version: '1.0.0'
      }

      res.json(health)
    } catch (error) {
      this.logger.error('Health check failed:', error)
      res.status(500).json({ error: 'Health check failed' })
    }
  }

  /**
   * Handle inference requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async handleInferenceRequest (req, res) {
    try {
      const { modelId } = req.params
      const { inputData, options = {} } = req.body

      // Rate limiting
      if (!this.checkRateLimit(req)) {
        return res.status(429).json({ error: 'Rate limit exceeded' })
      }

      // Authentication
      if (!await this.authManager.authenticate(req)) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // Validate input
      if (!inputData) {
        return res.status(400).json({ error: 'Input data is required' })
      }

      // Route request to orchestrator
      const result = await this.orchestratorClient.routeInferenceRequest({
        modelId,
        inputData,
        options
      })

      res.json({
        success: true,
        modelId,
        result: result.result,
        workerId: result.workerId,
        timestamp: Date.now()
      })
    } catch (error) {
      this.logger.error('Inference request failed:', error)
      res.status(500).json({ error: error.message || 'Inference request failed' })
    }
  }

  /**
   * Handle list models requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async handleListModels (req, res) {
    try {
      // Authentication
      if (!await this.authManager.authenticate(req)) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { type, limit } = req.query
      const result = await this.orchestratorClient.listModels({ type, limit: limit ? parseInt(limit) : undefined })

      res.json({
        success: true,
        models: result.models,
        count: result.count,
        timestamp: Date.now()
      })
    } catch (error) {
      this.logger.error('List models request failed:', error)
      res.status(500).json({ error: error.message || 'Failed to list models' })
    }
  }

  /**
   * Handle get model requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async handleGetModel (req, res) {
    try {
      const { modelId } = req.params

      // Authentication
      if (!await this.authManager.authenticate(req)) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const result = await this.orchestratorClient.getModel({ modelId })

      res.json({
        success: true,
        model: result,
        timestamp: Date.now()
      })
    } catch (error) {
      this.logger.error('Get model request failed:', error)
      res.status(500).json({ error: error.message || 'Failed to get model' })
    }
  }

  /**
   * Handle create model requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async handleCreateModel (req, res) {
    try {
      // Authentication
      if (!await this.authManager.authenticate(req)) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { modelId, modelData, metadata } = req.body

      if (!modelId || !modelData || !metadata) {
        return res.status(400).json({ error: 'Model ID, data, and metadata are required' })
      }

      const result = await this.orchestratorClient.createModel({
        modelId,
        modelData: Buffer.from(modelData, 'base64'),
        metadata
      })

      res.json({
        success: true,
        modelId,
        result,
        timestamp: Date.now()
      })
    } catch (error) {
      this.logger.error('Create model request failed:', error)
      res.status(500).json({ error: error.message || 'Failed to create model' })
    }
  }

  /**
   * Handle service status requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async handleServiceStatus (req, res) {
    try {
      // Authentication
      if (!await this.authManager.authenticate(req)) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const status = await this.orchestratorClient.getServiceStatus()

      res.json({
        success: true,
        status,
        timestamp: Date.now()
      })
    } catch (error) {
      this.logger.error('Service status request failed:', error)
      res.status(500).json({ error: error.message || 'Failed to get service status' })
    }
  }

  /**
   * Handle CORS preflight requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async handleCorsPreflight (req, res) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
    res.status(200).end()
  }

  /**
   * Check rate limit for request
   * @param {Object} req - HTTP request
   * @returns {boolean} Rate limit status
   */
  checkRateLimit (req) {
    if (!this.conf.rateLimit?.enabled) {
      return true
    }

    const clientId = req.ip || req.connection.remoteAddress
    const now = Date.now()
    const windowMs = this.conf.rateLimit.windowMs || 60000
    const maxRequests = this.conf.rateLimit.maxRequests || 100

    if (!this.rateLimiter.has(clientId)) {
      this.rateLimiter.set(clientId, {
        requests: 1,
        windowStart: now
      })
      return true
    }

    const clientData = this.rateLimiter.get(clientId)

    // Reset window if expired
    if (now - clientData.windowStart > windowMs) {
      clientData.requests = 1
      clientData.windowStart = now
      return true
    }

    // Check if limit exceeded
    if (clientData.requests >= maxRequests) {
      return false
    }

    clientData.requests++
    return true
  }

  /**
   * Start rate limit cleanup process
   */
  startRateLimitCleanup () {
    setInterval(() => {
      const now = Date.now()
      const windowMs = this.conf.rateLimit?.windowMs || 60000

      for (const [clientId, data] of this.rateLimiter.entries()) {
        if (now - data.windowStart > windowMs * 2) {
          this.rateLimiter.delete(clientId)
        }
      }
    }, 60000) // Clean up every minute
  }
}

module.exports = WrkApiGateway
