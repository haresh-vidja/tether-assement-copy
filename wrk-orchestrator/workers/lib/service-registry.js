'use strict'

/**
 * Service Registry class for managing worker registrations and discovery
 * @class ServiceRegistry
 */
class ServiceRegistry {
  /**
   * Creates an instance of ServiceRegistry
   * @param {Object} conf - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor (conf, logger) {
    this.conf = conf
    this.logger = logger
    this.workers = new Map()
    this.modelIndex = new Map()
    this.capabilityIndex = new Map()
  }

  /**
   * Initialize registry
   * @returns {Promise<void>}
   */
  async initialize () {
    this.logger.info('Service registry initialized')
  }

  /**
   * Register a worker
   * @param {Object} workerInfo - Worker information
   * @returns {Promise<void>}
   */
  async registerWorker (workerInfo) {
    try {
      const { id, capabilities } = workerInfo

      // Store worker information
      this.workers.set(id, workerInfo)

      // Index by capabilities
      if (capabilities && Array.isArray(capabilities)) {
        for (const capability of capabilities) {
          if (!this.capabilityIndex.has(capability)) {
            this.capabilityIndex.set(capability, new Set())
          }
          this.capabilityIndex.get(capability).add(id)
        }
      }

      // Index by supported models
      if (capabilities && capabilities.models) {
        for (const modelId of capabilities.models) {
          if (!this.modelIndex.has(modelId)) {
            this.modelIndex.set(modelId, new Set())
          }
          this.modelIndex.get(modelId).add(id)
        }
      }

      this.logger.info(`Worker registered: ${id}`)
    } catch (error) {
      this.logger.error(`Failed to register worker ${workerInfo.id}:`, error)
      throw error
    }
  }

  /**
   * Unregister a worker
   * @param {string} workerId - Worker identifier
   * @returns {Promise<void>}
   */
  async unregisterWorker (workerId) {
    try {
      const worker = this.workers.get(workerId)
      if (!worker) {
        return
      }

      // Remove from capability index
      if (worker.capabilities && Array.isArray(worker.capabilities)) {
        for (const capability of worker.capabilities) {
          const capabilitySet = this.capabilityIndex.get(capability)
          if (capabilitySet) {
            capabilitySet.delete(workerId)
            if (capabilitySet.size === 0) {
              this.capabilityIndex.delete(capability)
            }
          }
        }
      }

      // Remove from model index
      if (worker.capabilities && worker.capabilities.models) {
        for (const modelId of worker.capabilities.models) {
          const modelSet = this.modelIndex.get(modelId)
          if (modelSet) {
            modelSet.delete(workerId)
            if (modelSet.size === 0) {
              this.modelIndex.delete(modelId)
            }
          }
        }
      }

      // Remove from main registry
      this.workers.delete(workerId)

      this.logger.info(`Worker unregistered: ${workerId}`)
    } catch (error) {
      this.logger.error(`Failed to unregister worker ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Get workers for a specific model
   * @param {string} modelId - Model identifier
   * @returns {Promise<Array>} Available workers
   */
  async getWorkersForModel (modelId) {
    try {
      const workerIds = this.modelIndex.get(modelId) || new Set()
      const workers = []

      for (const workerId of workerIds) {
        const worker = this.workers.get(workerId)
        if (worker && worker.status === 'active') {
          workers.push(worker)
        }
      }

      return workers
    } catch (error) {
      this.logger.error(`Failed to get workers for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Get workers by capability
   * @param {string} capability - Capability name
   * @returns {Promise<Array>} Workers with capability
   */
  async getWorkersByCapability (capability) {
    try {
      const workerIds = this.capabilityIndex.get(capability) || new Set()
      const workers = []

      for (const workerId of workerIds) {
        const worker = this.workers.get(workerId)
        if (worker && worker.status === 'active') {
          workers.push(worker)
        }
      }

      return workers
    } catch (error) {
      this.logger.error(`Failed to get workers by capability ${capability}:`, error)
      throw error
    }
  }

  /**
   * Get all registered workers
   * @returns {Promise<Array>} All workers
   */
  async getAllWorkers () {
    try {
      return Array.from(this.workers.values()).filter(worker => worker.status === 'active')
    } catch (error) {
      this.logger.error('Failed to get all workers:', error)
      throw error
    }
  }

  /**
   * Update worker status
   * @param {string} workerId - Worker identifier
   * @param {Object} updates - Status updates
   * @returns {Promise<void>}
   */
  async updateWorkerStatus (workerId, updates) {
    try {
      const worker = this.workers.get(workerId)
      if (!worker) {
        throw new Error('ERR_WORKER_NOT_FOUND')
      }

      Object.assign(worker, updates, { lastSeen: Date.now() })
      this.workers.set(workerId, worker)

      this.logger.debug(`Worker status updated: ${workerId}`)
    } catch (error) {
      this.logger.error(`Failed to update worker status ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Discover services in the network
   * @returns {Promise<void>}
   */
  async discoverServices () {
    try {
      // In a real implementation, this would use Hyperswarm DHT
      // to discover new services and register them
      this.logger.debug('Service discovery completed')
    } catch (error) {
      this.logger.error('Service discovery failed:', error)
      throw error
    }
  }

  /**
   * Get registry statistics
   * @returns {Promise<Object>} Registry statistics
   */
  async getStats () {
    try {
      const totalWorkers = this.workers.size
      const activeWorkers = Array.from(this.workers.values()).filter(w => w.status === 'active').length
      const totalModels = this.modelIndex.size
      const totalCapabilities = this.capabilityIndex.size

      return {
        totalWorkers,
        activeWorkers,
        inactiveWorkers: totalWorkers - activeWorkers,
        totalModels,
        totalCapabilities,
        modelDistribution: Object.fromEntries(
          Array.from(this.modelIndex.entries()).map(([model, workers]) => [model, workers.size])
        )
      }
    } catch (error) {
      this.logger.error('Failed to get registry stats:', error)
      throw error
    }
  }

  /**
   * Check if registry is healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy () {
    try {
      const stats = await this.getStats()
      return stats.activeWorkers > 0
    } catch (error) {
      this.logger.error('Health check failed:', error)
      return false
    }
  }
}

module.exports = ServiceRegistry
