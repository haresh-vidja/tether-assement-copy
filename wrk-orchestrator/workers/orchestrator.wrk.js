'use strict'

const async = require('async')
const WrkBase = require('wrk-base/workers/base.wrk')
const ServiceRegistry = require('./lib/service-registry')
const LoadBalancer = require('./lib/load-balancer')
const HealthMonitor = require('./lib/health-monitor')

/**
 * Orchestrator Worker class
 * Manages service discovery, load balancing, and request routing
 * @class WrkOrchestrator
 * @extends WrkBase
 */
class WrkOrchestrator extends WrkBase {
  /**
   * Creates an instance of WrkOrchestrator
   * @param {Object} conf - Configuration object
   * @param {Object} ctx - Context object
   * @throws {Error} If required context is missing
   */
  constructor (conf, ctx) {
    super(conf, ctx)

    this.prefix = `orchestrator-${ctx.rack || 'default'}`
    this.serviceRegistry = null
    this.loadBalancer = null
    this.healthMonitor = null
    this.rpcClients = new Map()
    this.requestQueue = new Map()

    this.init()
    this.start()
  }

  /**
   * Initialize the worker
   */
  init () {
    super.init()

    this.serviceRegistry = new ServiceRegistry(this.conf, this.logger)
    this.loadBalancer = new LoadBalancer(this.conf, this.logger)
    this.healthMonitor = new HealthMonitor(this.conf, this.logger)
  }

  /**
   * Start the worker and set up RPC endpoints
   * @param {Function} cb - Callback function
   */
  _start (cb) {
    async.series([
      next => { super._start(next) },
      async () => {
        const rpcServer = this.net_r0.rpcServer

        // Register RPC endpoints
        rpcServer.respond('findAvailableWorker', this.findAvailableWorker.bind(this))
        rpcServer.respond('registerWorker', this.registerWorker.bind(this))
        rpcServer.respond('unregisterWorker', this.unregisterWorker.bind(this))
        rpcServer.respond('routeInferenceRequest', this.routeInferenceRequest.bind(this))
        rpcServer.respond('getServiceStatus', this.getServiceStatus.bind(this))
        rpcServer.respond('getLoadBalancingStats', this.getLoadBalancingStats.bind(this))
        rpcServer.respond('healthCheck', this.healthCheck.bind(this))

        // Initialize components
        await this.serviceRegistry.initialize()
        await this.loadBalancer.initialize()
        await this.healthMonitor.initialize()

        // Start background processes
        this.startServiceDiscovery()
        this.startHealthMonitoring()

        this.logger.info('Orchestrator Worker started successfully')
      }
    ], cb)
  }

  /**
   * Find an available worker for a specific model
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Model identifier
   * @param {Object} params.requirements - Optional requirements
   * @returns {Promise<Object>} Worker information
   */
  async findAvailableWorker (params) {
    const { modelId, requirements = {} } = params

    try {
      this.logger.info(`Finding available worker for model: ${modelId}`)

      // Get available workers for this model
      const availableWorkers = await this.serviceRegistry.getWorkersForModel(modelId)

      if (availableWorkers.length === 0) {
        throw new Error('ERR_NO_WORKERS_AVAILABLE')
      }

      // Filter by requirements
      const filteredWorkers = this.filterWorkersByRequirements(availableWorkers, requirements)

      if (filteredWorkers.length === 0) {
        throw new Error('ERR_NO_WORKERS_MATCH_REQUIREMENTS')
      }

      // Use load balancer to select worker
      const selectedWorker = await this.loadBalancer.selectWorker(filteredWorkers, modelId)

      // Get RPC client for selected worker
      const rpcClient = await this.getRpcClient(selectedWorker)

      return {
        success: true,
        worker: {
          id: selectedWorker.id,
          address: selectedWorker.address,
          publicKey: selectedWorker.publicKey,
          capacity: selectedWorker.capacity,
          capabilities: selectedWorker.capabilities
        },
        rpcClient: rpcClient
      }
    } catch (error) {
      this.logger.error(`Failed to find available worker for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Register a new worker
   * @param {Object} params - Parameters
   * @param {string} params.workerId - Worker identifier
   * @param {string} params.address - Worker address
   * @param {string} params.publicKey - Worker public key
   * @param {Object} params.capabilities - Worker capabilities
   * @returns {Promise<Object>} Registration result
   */
  async registerWorker (params) {
    const { workerId, address, publicKey, capabilities } = params

    try {
      this.logger.info(`Registering worker: ${workerId}`)

      const workerInfo = {
        id: workerId,
        address,
        publicKey,
        capabilities,
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

      this.logger.info(`Worker registered successfully: ${workerId}`)

      return {
        success: true,
        workerId,
        registeredAt: workerInfo.registeredAt
      }
    } catch (error) {
      this.logger.error(`Failed to register worker ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Unregister a worker
   * @param {Object} params - Parameters
   * @param {string} params.workerId - Worker identifier
   * @returns {Promise<Object>} Unregistration result
   */
  async unregisterWorker (params) {
    const { workerId } = params

    try {
      this.logger.info(`Unregistering worker: ${workerId}`)

      // Remove from service registry
      await this.serviceRegistry.unregisterWorker(workerId)

      // Remove from load balancer
      await this.loadBalancer.removeWorker(workerId)

      // Stop health monitoring
      await this.healthMonitor.stopMonitoring(workerId)

      // Close RPC client if exists
      const rpcClient = this.rpcClients.get(workerId)
      if (rpcClient) {
        await rpcClient.close()
        this.rpcClients.delete(workerId)
      }

      this.logger.info(`Worker unregistered successfully: ${workerId}`)

      return {
        success: true,
        workerId,
        unregisteredAt: Date.now()
      }
    } catch (error) {
      this.logger.error(`Failed to unregister worker ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Route inference request to appropriate worker
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Model identifier
   * @param {Object} params.inputData - Input data
   * @param {Object} params.options - Request options
   * @returns {Promise<Object>} Inference result
   */
  async routeInferenceRequest (params) {
    const { modelId, inputData, options = {} } = params

    try {
      this.logger.info(`Routing inference request for model: ${modelId}`)

      // Find available worker
      const workerResult = await this.findAvailableWorker({ modelId, requirements: options.requirements })

      if (!workerResult.success) {
        throw new Error('ERR_NO_WORKERS_AVAILABLE')
      }

      const { worker, rpcClient } = workerResult

      // Route request to worker
      const inferenceResult = await rpcClient.request('runInference', {
        modelId,
        inputData,
        options
      }, { timeout: this.conf.requestTimeout || 60000 })

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
    } catch (error) {
      this.logger.error(`Failed to route inference request for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Get service status
   * @returns {Promise<Object>} Service status
   */
  async getServiceStatus () {
    try {
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
        rpcClients: {
          active: this.rpcClients.size,
          keys: Array.from(this.rpcClients.keys())
        }
      }
    } catch (error) {
      this.logger.error('Failed to get service status:', error)
      throw error
    }
  }

  /**
   * Get load balancing statistics
   * @returns {Promise<Object>} Load balancing stats
   */
  async getLoadBalancingStats () {
    try {
      return await this.loadBalancer.getStats()
    } catch (error) {
      this.logger.error('Failed to get load balancing stats:', error)
      throw error
    }
  }

  /**
   * Health check endpoint
   * @returns {Promise<Object>} Health status
   */
  async healthCheck () {
    try {
      const registryHealthy = await this.serviceRegistry.isHealthy()
      const loadBalancerHealthy = await this.loadBalancer.isHealthy()
      const healthMonitorHealthy = await this.healthMonitor.isHealthy()

      const overallHealth = registryHealthy && loadBalancerHealthy && healthMonitorHealthy

      return {
        success: true,
        healthy: overallHealth,
        components: {
          registry: registryHealthy,
          loadBalancer: loadBalancerHealthy,
          healthMonitor: healthMonitorHealthy
        },
        timestamp: Date.now()
      }
    } catch (error) {
      this.logger.error('Health check failed:', error)
      throw error
    }
  }

  /**
   * Filter workers by requirements
   * @param {Array} workers - Available workers
   * @param {Object} requirements - Requirements
   * @returns {Array} Filtered workers
   */
  filterWorkersByRequirements (workers, requirements) {
    return workers.filter(worker => {
      // Check capacity requirements
      if (requirements.minCapacity && worker.capacity.currentLoad >= requirements.minCapacity) {
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

      // Check model availability
      if (requirements.modelId && !worker.capabilities.includes(requirements.modelId)) {
        return false
      }

      return true
    })
  }

  /**
   * Get or create RPC client for worker
   * @param {Object} worker - Worker information
   * @returns {Promise<Object>} RPC client
   */
  async getRpcClient (worker) {
    try {
      let rpcClient = this.rpcClients.get(worker.id)

      if (!rpcClient) {
        // Create new RPC client
        rpcClient = await this.net_r0.createRpcClient(worker.address, worker.publicKey)
        this.rpcClients.set(worker.id, rpcClient)
      }

      return rpcClient
    } catch (error) {
      this.logger.error(`Failed to get RPC client for worker ${worker.id}:`, error)
      throw error
    }
  }

  /**
   * Start service discovery process
   */
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

  /**
   * Start health monitoring process
   */
  startHealthMonitoring () {
    setInterval(async () => {
      try {
        await this.healthMonitor.performHealthChecks()
      } catch (error) {
        this.logger.error('Health monitoring failed:', error)
      }
    }, this.conf.healthCheckInterval || 5000)
  }
}

module.exports = WrkOrchestrator
