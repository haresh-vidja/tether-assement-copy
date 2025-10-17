'use strict'

const pino = require('pino')
const ModelManager = require('./workers/lib/model-manager')
const InferenceEngine = require('./workers/lib/inference-engine')

/**
 * Simple AI Inference Service
 * Standalone implementation without complex framework dependencies
 */
class AIInferenceService {
  /**
   * Create a new AI inference worker instance.
   * The constructor prepares shared collaborators (model manager, inference engine)
   * and in-memory bookkeeping used to enforce runtime limits.
   *
   * @param {Object} conf - Service configuration derived from `config/common.json`.
   */
  constructor (conf = {}) {
    this.conf = conf
    this.logger = pino({
      name: 'ai-inference',
      level: conf.debug ? 'debug' : 'info'
    })

    this.modelManager = new ModelManager(conf, this.logger)
    this.inferenceEngine = new InferenceEngine(conf, this.logger)
    this.modelCache = new Map()
    this.capacity = {
      maxConcurrent: conf.maxConcurrentInferences || 10,
      currentLoad: 0,
      availableModels: new Set()
    }
    this.isRunning = false
  }

  /**
   * Bootstraps the worker by initialising dependencies, exposing HTTP endpoints,
   * and starting background monitors. This method is safe to call exactly once
   * during service startup.
   *
   * @returns {Promise<void>}
   */
  async start () {
    try {
      this.logger.info('Starting AI Inference Service...')

      // Initialize components
      await this.modelManager.initialize()
      await this.inferenceEngine.initialize()

      // Start HTTP server for API endpoints
      await this.startHttpServer()

      // Start health monitoring
      this.startHealthMonitoring()

      this.isRunning = true
      this.logger.info('AI Inference Service started successfully')
    } catch (error) {
      this.logger.error('Failed to start AI Inference Service:', error)
      throw error
    }
  }

  /**
   * Configure and start the Express HTTP server that exposes service capabilities.
   * Handlers are intentionally lightweight and delegate business logic to the
   * worker methods so that API behaviour remains easy to reason about.
   *
   * @returns {Promise<void>}
   */
  async startHttpServer () {
    try {
      const express = require('express')
      const cors = require('cors')

      const app = express()
      app.use(cors())
      app.use(express.json())

      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({
          status: 'healthy',
          service: 'ai-inference',
          capacity: this.capacity,
          uptime: process.uptime()
        })
      })

      // Run inference endpoint
      app.post('/api/inference/:modelId', async (req, res) => {
        try {
          const { modelId } = req.params
          const { inputData, options = {} } = req.body

          if (!inputData) {
            return res.status(400).json({ error: 'Input data is required' })
          }

          const result = await this.runInference(modelId, inputData, options)
          res.json(result)
        } catch (error) {
          this.logger.error('Inference error:', error)
          res.status(500).json({ error: error.message })
        }
      })

      // Check capacity endpoint
      app.get('/api/capacity', (req, res) => {
        res.json({
          maxConcurrent: this.capacity.maxConcurrent,
          currentLoad: this.capacity.currentLoad,
          available: this.capacity.currentLoad < this.capacity.maxConcurrent,
          availableModels: Array.from(this.capacity.availableModels)
        })
      })

      // Load model endpoint
      app.post('/api/models/:modelId/load', async (req, res) => {
        try {
          const { modelId } = req.params
          const result = await this.loadModel(modelId)
          res.json(result)
        } catch (error) {
          this.logger.error('Load model error:', error)
          res.status(500).json({ error: error.message })
        }
      })

      const port = this.conf.port || 8001
      app.listen(port, () => {
        this.logger.info(`AI Inference HTTP server listening on port ${port}`)
      })
    } catch (error) {
      this.logger.error('Failed to start HTTP server:', error)
      throw error
    }
  }

  /**
   * Execute an inference request against a cached or freshly loaded model.
   * Basic resource controls ensure the worker honours the configured concurrency
   * limits and only serves requests for models that have been preloaded.
   *
   * @param {string} modelId - Identifier of the model to run.
   * @param {Object} inputData - Raw inference payload supplied by the caller.
   * @param {Object} [options] - Optional inference hints (timeout, post-processing, etc.).
   * @returns {Promise<Object>} Success envelope containing inference results.
   */
  async runInference (modelId, inputData, options = {}) {
    // Check capacity
    if (this.capacity.currentLoad >= this.capacity.maxConcurrent) {
      throw new Error('Capacity exceeded')
    }

    // Check if model is available
    if (!this.capacity.availableModels.has(modelId)) {
      throw new Error('Model not available')
    }

    // Increment load counter
    this.capacity.currentLoad++

    try {
      // Get or load model
      let model = this.modelCache.get(modelId)
      if (!model) {
        // Models are lazily loaded on first use and then cached to avoid repeated I/O.
        model = await this.modelManager.loadModel(modelId)
        this.modelCache.set(modelId, model)
      }

      // Run inference
      const result = await this.inferenceEngine.runInference(model, inputData, options)

      return {
        success: true,
        result: result,
        modelId: modelId,
        timestamp: Date.now()
      }
    } finally {
      // Decrement load counter
      this.capacity.currentLoad--
    }
  }

  /**
   * Load a model into memory ahead of receiving inference traffic. This method
   * primes both the local cache and the advertised availability list so that
   * orchestrators know the worker is ready to accept requests.
   *
   * @param {string} modelId - Identifier of the model to load.
   * @returns {Promise<Object>} Result describing the load outcome.
   */
  async loadModel (modelId) {
    try {
      if (this.modelCache.has(modelId)) {
        return { success: true, message: 'Model already loaded' }
      }

      const model = await this.modelManager.loadModel(modelId)
      this.modelCache.set(modelId, model)
      this.capacity.availableModels.add(modelId)

      return { success: true, message: 'Model loaded successfully' }
    } catch (error) {
      this.logger.error('Failed to load model:', error)
      throw error
    }
  }

  /**
   * Periodically emit a structured health snapshot. The current implementation
   * logs diagnostic data, but the hook can be extended to publish metrics or
   * push heartbeat updates to the orchestrator layer.
   */
  startHealthMonitoring () {
    setInterval(() => {
      this.logger.debug('Health check:', {
        currentLoad: this.capacity.currentLoad,
        maxConcurrent: this.capacity.maxConcurrent,
        availableModels: this.capacity.availableModels.size,
        memoryUsage: process.memoryUsage()
      })
    }, this.conf.healthCheckInterval || 10000)
  }

  /**
   * Gracefully stop the worker. Resources such as open sockets are handled by
   * Express, while we simply flip the `isRunning` flag so management layers
   * can observe the shutdown state.
   *
   * @returns {Promise<void>}
   */
  async stop () {
    this.logger.info('Stopping AI Inference Service...')
    this.isRunning = false
  }
}

// Start service if run directly
if (require.main === module) {
  const conf = require('./config/common.json')
  const service = new AIInferenceService(conf)

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

module.exports = AIInferenceService
