'use strict'

const pino = require('pino')
const ServiceRegistry = require('./workers/lib/service-registry')
const LoadBalancer = require('./workers/lib/load-balancer')
const HealthMonitor = require('./workers/lib/health-monitor')

/**
 * Simple Orchestrator Service
 * Standalone implementation without complex framework dependencies
 */
class OrchestratorService {
  constructor (conf = {}) {
    this.conf = conf
    this.logger = pino({
      name: 'orchestrator',
      level: conf.debug ? 'debug' : 'info'
    })
    
    this.serviceRegistry = new ServiceRegistry(conf, this.logger)
    this.loadBalancer = new LoadBalancer(conf, this.logger)
    this.healthMonitor = new HealthMonitor(conf, this.logger)
    this.workers = new Map()
    this.isRunning = false
  }

  async start () {
    try {
      this.logger.info('Starting Orchestrator Service...')
      
      // Initialize components
      await this.serviceRegistry.initialize()
      await this.loadBalancer.initialize()
      await this.healthMonitor.initialize()
      
      // Start HTTP server for API endpoints
      await this.startHttpServer()
      
      // Start background processes
      this.startServiceDiscovery()
      this.startHealthMonitoring()
      
      this.isRunning = true
      this.logger.info('Orchestrator Service started successfully')
    } catch (error) {
      this.logger.error('Failed to start Orchestrator Service:', error)
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
      res.json({ 
        status: 'healthy', 
        service: 'orchestrator',
        uptime: process.uptime()
      })
    })
    
    // Register worker endpoint
    app.post('/api/workers/register', async (req, res) => {
      try {
        const { workerId, address, capabilities } = req.body
        
        if (!workerId || !address) {
          return res.status(400).json({ error: 'Worker ID and address are required' })
        }
        
        const result = await this.registerWorker({ workerId, address, capabilities })
        res.json(result)
      } catch (error) {
        this.logger.error('Register worker error:', error)
        res.status(500).json({ error: error.message })
      }
    })
    
    // Find available worker endpoint
    app.post('/api/workers/find', async (req, res) => {
      try {
        const { modelId, requirements = {} } = req.body
        
        if (!modelId) {
          return res.status(400).json({ error: 'Model ID is required' })
        }
        
        const result = await this.findAvailableWorker(modelId, requirements)
        res.json(result)
      } catch (error) {
        this.logger.error('Find worker error:', error)
        res.status(500).json({ error: error.message })
      }
    })
    
    // Route inference request endpoint
    app.post('/api/inference/route', async (req, res) => {
      try {
        const { modelId, inputData, options = {} } = req.body
        
        if (!modelId || !inputData) {
          return res.status(400).json({ error: 'Model ID and input data are required' })
        }
        
        const result = await this.routeInferenceRequest({ modelId, inputData, options })
        res.json(result)
      } catch (error) {
        this.logger.error('Route inference error:', error)
        res.status(500).json({ error: error.message })
      }
    })
    
    // Get service status endpoint
    app.get('/api/status', async (req, res) => {
      try {
        const status = await this.getServiceStatus()
        res.json(status)
      } catch (error) {
        this.logger.error('Get status error:', error)
        res.status(500).json({ error: error.message })
      }
    })
    
    const port = this.conf.port || 8003
    app.listen(port, () => {
      this.logger.info(`Orchestrator HTTP server listening on port ${port}`)
    })
  }

  async registerWorker (params) {
    const { workerId, address, capabilities } = params

    const workerInfo = {
      id: workerId,
      address,
      capabilities: capabilities || [],
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      status: 'active'
    }

    // Register in service registry
    await this.serviceRegistry.registerWorker(workerInfo)

    // Add to load balancer
    await this.loadBalancer.addWorker(workerInfo)

    // Start health monitoring
    await this.healthMonitor.startMonitoring(workerId, address)

    this.workers.set(workerId, workerInfo)

    this.logger.info(`Worker registered successfully: ${workerId}`)

    return {
      success: true,
      workerId,
      registeredAt: workerInfo.registeredAt
    }
  }

  async findAvailableWorker (modelId, requirements = {}) {
    // Get available workers for this model
    const availableWorkers = await this.serviceRegistry.getWorkersForModel(modelId)

    if (availableWorkers.length === 0) {
      throw new Error('No workers available')
    }

    // Filter by requirements
    const filteredWorkers = this.filterWorkersByRequirements(availableWorkers, requirements)

    if (filteredWorkers.length === 0) {
      throw new Error('No workers match requirements')
    }

    // Use load balancer to select worker
    const selectedWorker = await this.loadBalancer.selectWorker(filteredWorkers, modelId)

    return {
      success: true,
      worker: {
        id: selectedWorker.id,
        address: selectedWorker.address,
        capabilities: selectedWorker.capabilities
      }
    }
  }

  async routeInferenceRequest (params) {
    const { modelId, inputData, options = {} } = params

    // Find available worker
    const workerResult = await this.findAvailableWorker(modelId, options.requirements)

    if (!workerResult.success) {
      throw new Error('No workers available')
    }

    const { worker } = workerResult

    // Simulate routing to worker (in real implementation, this would make HTTP call)
    const inferenceResult = await this.simulateWorkerInference(worker, { modelId, inputData, options })

    // Update load balancer with result
    await this.loadBalancer.updateWorkerStats(worker.id, {
      requestCount: 1,
      processingTime: inferenceResult.processingTime || 0,
      success: inferenceResult.success !== false
    })

    return {
      success: true,
      result: inferenceResult,
      workerId: worker.id,
      routedAt: Date.now()
    }
  }

  async simulateWorkerInference (worker, params) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))

    return {
      success: true,
      result: {
        predictions: Array.from({ length: 1000 }, () => Math.random()),
        confidence: Math.random(),
        processingTime: Math.random() * 1000 + 500,
        modelId: params.modelId
      }
    }
  }

  filterWorkersByRequirements (workers, requirements) {
    return workers.filter(worker => {
      // Check capacity requirements
      if (requirements.minCapacity && worker.capacity && worker.capacity.currentLoad >= requirements.minCapacity) {
        return false
      }

      // Check capability requirements
      if (requirements.capabilities) {
        for (const capability of requirements.capabilities) {
          if (!worker.capabilities.includes(capability)) {
            return false
          }
        }
      }

      return true
    })
  }

  async getServiceStatus () {
    const registryStats = await this.serviceRegistry.getStats()
    const loadBalancerStats = await this.loadBalancer.getStats()
    const healthStats = await this.healthMonitor.getStats()

    return {
      success: true,
      status: 'healthy',
      timestamp: Date.now(),
      registry: registryStats,
      loadBalancer: loadBalancerStats,
      health: healthStats,
      workers: {
        total: this.workers.size,
        active: Array.from(this.workers.values()).filter(w => w.status === 'active').length
      }
    }
  }

  startServiceDiscovery () {
    setInterval(async () => {
      try {
        await this.serviceRegistry.discoverServices()
        await this.healthMonitor.checkAllWorkers()
      } catch (error) {
        this.logger.error('Service discovery failed:', error)
      }
    }, this.conf.serviceDiscoveryInterval || 10000)
  }

  startHealthMonitoring () {
    setInterval(async () => {
      try {
        await this.healthMonitor.performHealthChecks()
      } catch (error) {
        this.logger.error('Health monitoring failed:', error)
      }
    }, this.conf.healthCheckInterval || 5000)
  }

  async stop () {
    this.logger.info('Stopping Orchestrator Service...')
    this.isRunning = false
  }
}

// Start service if run directly
if (require.main === module) {
  const conf = require('./config/common.json')
  const service = new OrchestratorService(conf)
  
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

module.exports = OrchestratorService