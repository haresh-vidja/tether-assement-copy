'use strict'

const pino = require('pino')
const OrchestratorClient = require('./workers/lib/orchestrator-client')
const AuthManager = require('./workers/lib/auth-manager')

/**
 * Simple API Gateway Service
 * Standalone implementation without complex framework dependencies
 */
class ApiGatewayService {
  constructor (conf = {}) {
    this.conf = conf
    this.logger = pino({
      name: 'api-gateway',
      level: conf.debug ? 'debug' : 'info'
    })
    
    this.orchestratorClient = new OrchestratorClient(conf, this.logger)
    this.authManager = new AuthManager(conf, this.logger)
    this.rateLimiter = new Map()
    this.isRunning = false
  }

  async start () {
    try {
      this.logger.info('Starting API Gateway Service...')
      
      // Initialize components
      await this.orchestratorClient.initialize()
      await this.authManager.initialize()
      
      // Start HTTP server for API endpoints
      await this.startHttpServer()
      
      // Start background processes
      this.startRateLimitCleanup()
      
      this.isRunning = true
      this.logger.info('API Gateway Service started successfully')
    } catch (error) {
      this.logger.error('Failed to start API Gateway Service:', error)
      throw error
    }
  }

  async startHttpServer () {
    const express = require('express')
    const cors = require('cors')
    
    const app = express()
    app.use(cors())
    app.use(express.json())
    
    // Request logging middleware
    app.use((req, res, next) => {
      const startTime = Date.now()
      res.on('finish', () => {
        const duration = Date.now() - startTime
        this.logger.info({
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          ip: req.ip || req.connection.remoteAddress
        })
      })
      next()
    })
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'api-gateway',
        uptime: process.uptime(),
        version: '1.0.0'
      })
    })
    
    // Inference endpoint
    app.post('/api/v1/inference/:modelId', async (req, res) => {
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
    })
    
    // List models endpoint
    app.get('/api/v1/models', async (req, res) => {
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
    })
    
    // Get model endpoint
    app.get('/api/v1/models/:modelId', async (req, res) => {
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
    })
    
    // Create model endpoint
    app.post('/api/v1/models', async (req, res) => {
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
    })
    
    // Service status endpoint
    app.get('/api/v1/status', async (req, res) => {
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
    })
    
    // CORS preflight
    app.options('*', (req, res) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
      res.status(200).end()
    })
    
    const port = this.conf.port || 3000
    app.listen(port, () => {
      this.logger.info(`API Gateway HTTP server listening on port ${port}`)
    })
  }

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

  async stop () {
    this.logger.info('Stopping API Gateway Service...')
    this.isRunning = false
  }
}

// Start service if run directly
if (require.main === module) {
  const conf = require('./config/common.json')
  const service = new ApiGatewayService(conf)
  
  service.start().catch(error => {
    console.error('Failed to start service:', error)
    process.exit(1)
  })
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await service.stop()
    process.exit(0)
  })
}

module.exports = ApiGatewayService