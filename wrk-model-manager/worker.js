'use strict'

const pino = require('pino')
const ModelStorage = require('./workers/lib/model-storage')
const ModelRegistry = require('./workers/lib/model-registry')

/**
 * Simple Model Manager Service
 * Standalone implementation without complex framework dependencies
 */
class ModelManagerService {
  constructor (conf = {}) {
    this.conf = conf
    this.logger = pino({
      name: 'model-manager',
      level: conf.debug ? 'debug' : 'info'
    })
    
    this.modelStorage = new ModelStorage(conf, this.logger)
    this.modelRegistry = new ModelRegistry(conf, this.logger)
    this.isRunning = false
  }

  async start () {
    try {
      this.logger.info('Starting Model Manager Service...')
      
      // Initialize components
      await this.modelStorage.initialize()
      await this.modelRegistry.initialize()
      
      // Start HTTP server for API endpoints
      await this.startHttpServer()
      
      this.isRunning = true
      this.logger.info('Model Manager Service started successfully')
    } catch (error) {
      this.logger.error('Failed to start Model Manager Service:', error)
      throw error
    }
  }

  async startHttpServer () {
    const express = require('express')
    const cors = require('cors')
    
    const app = express()
    app.use(cors())
    app.use(express.json())
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'model-manager' })
    })
    
    // Store model endpoint
    app.post('/api/models', async (req, res) => {
      try {
        const { modelId, modelData, metadata } = req.body
        
        if (!modelId || !modelData || !metadata) {
          return res.status(400).json({ error: 'Missing required fields' })
        }
        
        const result = await this.storeModel(modelId, Buffer.from(modelData, 'base64'), metadata)
        res.json(result)
      } catch (error) {
        this.logger.error('Store model error:', error)
        res.status(500).json({ error: error.message })
      }
    })
    
    // Get model endpoint
    app.get('/api/models/:modelId', async (req, res) => {
      try {
        const { modelId } = req.params
        const result = await this.getModel(modelId)
        res.json(result)
      } catch (error) {
        this.logger.error('Get model error:', error)
        res.status(500).json({ error: error.message })
      }
    })
    
    // List models endpoint
    app.get('/api/models', async (req, res) => {
      try {
        const { type, limit } = req.query
        const result = await this.listModels({ type, limit: limit ? parseInt(limit) : undefined })
        res.json(result)
      } catch (error) {
        this.logger.error('List models error:', error)
        res.status(500).json({ error: error.message })
      }
    })
    
    const port = this.conf.port || 8002
    app.listen(port, () => {
      this.logger.info(`Model Manager HTTP server listening on port ${port}`)
    })
  }

  async storeModel (modelId, modelData, metadata) {
    return await this.modelStorage.storeModel(modelId, modelData)
  }

  async getModel (modelId) {
    const metadata = await this.modelRegistry.getMetadata(modelId)
    if (!metadata) {
      throw new Error('Model not found')
    }
    
    const modelData = await this.modelStorage.getModel(metadata.storageKey)
    return {
      modelId,
      metadata,
      modelData: modelData.toString('base64')
    }
  }

  async listModels (params = {}) {
    const models = await this.modelRegistry.listModels(params.type, params.limit)
    return {
      models,
      count: models.length
    }
  }

  async stop () {
    this.logger.info('Stopping Model Manager Service...')
    this.isRunning = false
  }
}

// Start service if run directly
if (require.main === module) {
  const conf = require('./config/common.json')
  const service = new ModelManagerService(conf)
  
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

module.exports = ModelManagerService