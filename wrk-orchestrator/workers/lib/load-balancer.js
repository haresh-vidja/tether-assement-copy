'use strict'

/**
 * Load Balancer class for distributing requests across workers
 * @class LoadBalancer
 */
class LoadBalancer {
  /**
   * Creates an instance of LoadBalancer
   * @param {Object} conf - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor (conf, logger) {
    this.conf = conf
    this.logger = logger
    this.strategy = conf.loadBalancingStrategy || 'round-robin'
    this.workerStats = new Map()
    this.roundRobinIndex = new Map()
  }

  /**
   * Initialize load balancer
   * @returns {Promise<void>}
   */
  async initialize () {
    this.logger.info(`Load balancer initialized with strategy: ${this.strategy}`)
  }

  /**
   * Add a worker to the load balancer
   * @param {Object} worker - Worker information
   * @returns {Promise<void>}
   */
  async addWorker (worker) {
    try {
      const { id } = worker

      // Initialize worker stats
      this.workerStats.set(id, {
        requestCount: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        successCount: 0,
        failureCount: 0,
        lastRequestTime: null,
        currentLoad: 0
      })

      // Initialize round-robin index
      this.roundRobinIndex.set(id, 0)

      this.logger.info(`Worker added to load balancer: ${id}`)
    } catch (error) {
      this.logger.error(`Failed to add worker ${worker.id} to load balancer:`, error)
      throw error
    }
  }

  /**
   * Remove a worker from the load balancer
   * @param {string} workerId - Worker identifier
   * @returns {Promise<void>}
   */
  async removeWorker (workerId) {
    try {
      this.workerStats.delete(workerId)
      this.roundRobinIndex.delete(workerId)

      this.logger.info(`Worker removed from load balancer: ${workerId}`)
    } catch (error) {
      this.logger.error(`Failed to remove worker ${workerId} from load balancer:`, error)
      throw error
    }
  }

  /**
   * Select a worker based on the load balancing strategy
   * @param {Array} workers - Available workers
   * @param {string} modelId - Model identifier
   * @returns {Promise<Object>} Selected worker
   */
  async selectWorker (workers, modelId) {
    try {
      if (workers.length === 0) {
        throw new Error('ERR_NO_WORKERS_AVAILABLE')
      }

      if (workers.length === 1) {
        return workers[0]
      }

      switch (this.strategy) {
        case 'round-robin':
          return this.selectRoundRobin(workers, modelId)
        case 'least-connections':
          return this.selectLeastConnections(workers)
        case 'weighted':
          return this.selectWeighted(workers)
        case 'random':
          return this.selectRandom(workers)
        default:
          return this.selectRoundRobin(workers, modelId)
      }
    } catch (error) {
      this.logger.error('Failed to select worker:', error)
      throw error
    }
  }

  /**
   * Select worker using round-robin strategy
   * @param {Array} workers - Available workers
   * @param {string} modelId - Model identifier
   * @returns {Object} Selected worker
   */
  selectRoundRobin (workers, modelId) {
    const key = modelId || 'default'
    let index = this.roundRobinIndex.get(key) || 0

    const selectedWorker = workers[index % workers.length]
    this.roundRobinIndex.set(key, (index + 1) % workers.length)

    return selectedWorker
  }

  /**
   * Select worker with least connections
   * @param {Array} workers - Available workers
   * @returns {Object} Selected worker
   */
  selectLeastConnections (workers) {
    return workers.reduce((least, worker) => {
      const stats = this.workerStats.get(worker.id)
      const leastStats = this.workerStats.get(least.id)

      if (!stats || !leastStats) {
        return least
      }

      return stats.currentLoad < leastStats.currentLoad ? worker : least
    })
  }

  /**
   * Select worker using weighted strategy
   * @param {Array} workers - Available workers
   * @returns {Object} Selected worker
   */
  selectWeighted (workers) {
    // Calculate weights based on capacity and performance
    const weightedWorkers = workers.map(worker => {
      const stats = this.workerStats.get(worker.id)
      if (!stats) {
        return { worker, weight: 1 }
      }

      // Weight based on success rate and average processing time
      const successRate = stats.requestCount > 0 ? stats.successCount / stats.requestCount : 1
      const avgTime = stats.averageProcessingTime || 1000
      const weight = successRate * (1000 / avgTime)

      return { worker, weight }
    })

    // Select based on weights
    const totalWeight = weightedWorkers.reduce((sum, w) => sum + w.weight, 0)
    let random = Math.random() * totalWeight

    for (const { worker, weight } of weightedWorkers) {
      random -= weight
      if (random <= 0) {
        return worker
      }
    }

    return workers[0]
  }

  /**
   * Select worker randomly
   * @param {Array} workers - Available workers
   * @returns {Object} Selected worker
   */
  selectRandom (workers) {
    const index = Math.floor(Math.random() * workers.length)
    return workers[index]
  }

  /**
   * Update worker statistics
   * @param {string} workerId - Worker identifier
   * @param {Object} stats - Statistics to update
   * @returns {Promise<void>}
   */
  async updateWorkerStats (workerId, stats) {
    try {
      const currentStats = this.workerStats.get(workerId)
      if (!currentStats) {
        return
      }

      // Update statistics
      if (stats.requestCount) {
        currentStats.requestCount += stats.requestCount
      }

      if (stats.processingTime) {
        currentStats.totalProcessingTime += stats.processingTime
        currentStats.averageProcessingTime = currentStats.totalProcessingTime / currentStats.requestCount
      }

      if (stats.success !== undefined) {
        if (stats.success) {
          currentStats.successCount++
        } else {
          currentStats.failureCount++
        }
      }

      currentStats.lastRequestTime = Date.now()

      this.workerStats.set(workerId, currentStats)

      this.logger.debug(`Worker stats updated: ${workerId}`)
    } catch (error) {
      this.logger.error(`Failed to update worker stats ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Get load balancer statistics
   * @returns {Promise<Object>} Load balancer statistics
   */
  async getStats () {
    try {
      const stats = {
        strategy: this.strategy,
        totalWorkers: this.workerStats.size,
        workerStats: Object.fromEntries(this.workerStats.entries()),
        roundRobinIndices: Object.fromEntries(this.roundRobinIndex.entries())
      }

      // Calculate aggregate statistics
      const allStats = Array.from(this.workerStats.values())
      if (allStats.length > 0) {
        stats.aggregate = {
          totalRequests: allStats.reduce((sum, s) => sum + s.requestCount, 0),
          totalSuccesses: allStats.reduce((sum, s) => sum + s.successCount, 0),
          totalFailures: allStats.reduce((sum, s) => sum + s.failureCount, 0),
          averageProcessingTime: allStats.reduce((sum, s) => sum + s.averageProcessingTime, 0) / allStats.length
        }

        stats.aggregate.successRate = stats.aggregate.totalRequests > 0
          ? stats.aggregate.totalSuccesses / stats.aggregate.totalRequests
          : 0
      }

      return stats
    } catch (error) {
      this.logger.error('Failed to get load balancer stats:', error)
      throw error
    }
  }

  /**
   * Check if load balancer is healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy () {
    try {
      return this.workerStats.size > 0
    } catch (error) {
      this.logger.error('Load balancer health check failed:', error)
      return false
    }
  }
}

module.exports = LoadBalancer
