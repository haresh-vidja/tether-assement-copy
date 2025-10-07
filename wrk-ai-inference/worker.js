'use strict'

const pino = require('pino')
const ModelManager = require('./workers/lib/model-manager')
const InferenceEngine = require('./workers/lib/inference-engine')

/**
 * Simple AI Inference Service
 * Standalone implementation without complex framework dependencies
 */
class AIInferenceService {
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