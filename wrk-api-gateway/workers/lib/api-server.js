'use strict'

/**
 * API Server class for handling HTTP server setup and middleware
 * @class ApiServer
 */
class ApiServer {
  /**
   * Creates an instance of ApiServer
   * @param {Object} conf - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor (conf, logger) {
    this.conf = conf
    this.logger = logger
    this.middleware = []
  }

  /**
   * Add middleware to the server
   * @param {Function} middleware - Middleware function
   */
  addMiddleware (middleware) {
    this.middleware.push(middleware)
  }

  /**
   * Set up CORS middleware
   */
  setupCors () {
    if (!this.conf.cors?.enabled) {
      return
    }

    const corsMiddleware = (req, res, next) => {
      const origins = this.conf.cors.origins || ['*']
      const origin = req.headers.origin

      if (origins.includes('*') || origins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*')
      }

      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
      res.header('Access-Control-Allow-Credentials', 'true')

      if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
      }

      next()
    }

    this.addMiddleware(corsMiddleware)
  }

  /**
   * Set up request logging middleware
   */
  setupRequestLogging () {
    const loggingMiddleware = (req, res, next) => {
      const startTime = Date.now()

      res.on('finish', () => {
        const duration = Date.now() - startTime
        this.logger.info({
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress
        })
      })

      next()
    }

    this.addMiddleware(loggingMiddleware)
  }

  /**
   * Set up error handling middleware
   */
  setupErrorHandling () {
    const errorMiddleware = (err, req, res, next) => {
      this.logger.error('Request error:', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress
      })

      if (res.headersSent) {
        return next(err)
      }

      res.status(500).json({
        error: 'Internal server error',
        timestamp: Date.now()
      })
    }

    this.addMiddleware(errorMiddleware)
  }

  /**
   * Set up request validation middleware
   */
  setupRequestValidation () {
    const validationMiddleware = (req, res, next) => {
      // Basic request validation
      if (req.method === 'POST' || req.method === 'PUT') {
        if (!req.headers['content-type']?.includes('application/json')) {
          return res.status(400).json({
            error: 'Content-Type must be application/json'
          })
        }
      }

      // Validate JSON for POST/PUT requests
      if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
        try {
          JSON.stringify(req.body)
        } catch (error) {
          return res.status(400).json({
            error: 'Invalid JSON in request body'
          })
        }
      }

      next()
    }

    this.addMiddleware(validationMiddleware)
  }

  /**
   * Initialize all middleware
   */
  initializeMiddleware () {
    this.setupCors()
    this.setupRequestLogging()
    this.setupRequestValidation()
    this.setupErrorHandling()
  }

  /**
   * Get all configured middleware
   * @returns {Array} Middleware functions
   */
  getMiddleware () {
    return this.middleware
  }
}

module.exports = ApiServer
