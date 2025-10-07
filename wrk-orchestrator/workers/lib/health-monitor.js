'use strict'

/**
 * Health Monitor class for monitoring worker health
 * @class HealthMonitor
 */
class HealthMonitor {
  /**
   * Creates an instance of HealthMonitor
   * @param {Object} conf - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor (conf, logger) {
    this.conf = conf
    this.logger = logger
    this.monitoredWorkers = new Map()
    this.healthChecks = new Map()
    this.healthCheckInterval = conf.healthCheckInterval || 5000
    this.workerTimeout = conf.workerTimeout || 30000
  }

  /**
   * Initialize health monitor
   * @returns {Promise<void>}
   */
  async initialize () {
    this.logger.info('Health monitor initialized')
  }

  /**
   * Start monitoring a worker
   * @param {string} workerId - Worker identifier
   * @param {string} address - Worker address
   * @returns {Promise<void>}
   */
  async startMonitoring (workerId, address) {
    try {
      const workerInfo = {
        id: workerId,
        address,
        status: 'healthy',
        lastCheck: Date.now(),
        consecutiveFailures: 0,
        totalChecks: 0,
        successfulChecks: 0
      }

      this.monitoredWorkers.set(workerId, workerInfo)

      this.logger.info(`Started monitoring worker: ${workerId}`)
    } catch (error) {
      this.logger.error(`Failed to start monitoring worker ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Stop monitoring a worker
   * @param {string} workerId - Worker identifier
   * @returns {Promise<void>}
   */
  async stopMonitoring (workerId) {
    try {
      this.monitoredWorkers.delete(workerId)
      this.healthChecks.delete(workerId)

      this.logger.info(`Stopped monitoring worker: ${workerId}`)
    } catch (error) {
      this.logger.error(`Failed to stop monitoring worker ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Perform health check on a specific worker
   * @param {string} workerId - Worker identifier
   * @returns {Promise<Object>} Health check result
   */
  async performHealthCheck (workerId) {
    try {
      const worker = this.monitoredWorkers.get(workerId)
      if (!worker) {
        throw new Error('ERR_WORKER_NOT_MONITORED')
      }

      const startTime = Date.now()
      let healthStatus = 'healthy'
      let error = null

      try {
        // In a real implementation, this would make an RPC call to the worker
        // For now, we'll simulate a health check
        await this.simulateHealthCheck(worker.address)

        worker.consecutiveFailures = 0
        worker.successfulChecks++
        worker.lastCheck = Date.now()

        this.logger.debug(`Health check passed for worker: ${workerId}`)
      } catch (checkError) {
        worker.consecutiveFailures++
        healthStatus = 'unhealthy'
        error = checkError.message

        this.logger.warn(`Health check failed for worker ${workerId}: ${error}`)

        // Mark worker as unhealthy if too many consecutive failures
        if (worker.consecutiveFailures >= 3) {
          worker.status = 'unhealthy'
          this.logger.error(`Worker marked as unhealthy: ${workerId}`)
        }
      }

      worker.totalChecks++
      const checkDuration = Date.now() - startTime

      const result = {
        workerId,
        status: healthStatus,
        checkDuration,
        consecutiveFailures: worker.consecutiveFailures,
        lastCheck: worker.lastCheck,
        error
      }

      this.healthChecks.set(workerId, result)
      return result
    } catch (error) {
      this.logger.error(`Failed to perform health check for worker ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Perform health checks on all monitored workers
   * @returns {Promise<Array>} Health check results
   */
  async performHealthChecks () {
    try {
      const workers = Array.from(this.monitoredWorkers.keys())
      const results = await Promise.allSettled(
        workers.map(workerId => this.performHealthCheck(workerId))
      )

      const successfulChecks = results.filter(r => r.status === 'fulfilled').length
      const failedChecks = results.filter(r => r.status === 'rejected').length

      this.logger.debug(`Health checks completed: ${successfulChecks} successful, ${failedChecks} failed`)

      return results.map(result => result.status === 'fulfilled' ? result.value : result.reason)
    } catch (error) {
      this.logger.error('Failed to perform health checks:', error)
      throw error
    }
  }

  /**
   * Check all workers (discovery and health check)
   * @returns {Promise<void>}
   */
  async checkAllWorkers () {
    try {
      await this.performHealthChecks()
    } catch (error) {
      this.logger.error('Failed to check all workers:', error)
      throw error
    }
  }

  /**
   * Simulate health check (replace with actual RPC call)
   * @param {string} address - Worker address
   * @returns {Promise<void>}
   */
  async simulateHealthCheck (address) {
    // Simulate network delay and occasional failures
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100))

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Simulated health check failure')
    }
  }

  /**
   * Get health status for a worker
   * @param {string} workerId - Worker identifier
   * @returns {Promise<Object>} Health status
   */
  async getWorkerHealth (workerId) {
    try {
      const worker = this.monitoredWorkers.get(workerId)
      const lastCheck = this.healthChecks.get(workerId)

      if (!worker) {
        throw new Error('ERR_WORKER_NOT_MONITORED')
      }

      return {
        workerId,
        status: worker.status,
        lastCheck: worker.lastCheck,
        consecutiveFailures: worker.consecutiveFailures,
        totalChecks: worker.totalChecks,
        successfulChecks: worker.successfulChecks,
        lastHealthCheck: lastCheck
      }
    } catch (error) {
      this.logger.error(`Failed to get health status for worker ${workerId}:`, error)
      throw error
    }
  }

  /**
   * Get health monitor statistics
   * @returns {Promise<Object>} Health monitor statistics
   */
  async getStats () {
    try {
      const workers = Array.from(this.monitoredWorkers.values())
      const totalWorkers = workers.length
      const healthyWorkers = workers.filter(w => w.status === 'healthy').length
      const unhealthyWorkers = workers.filter(w => w.status === 'unhealthy').length

      const totalChecks = workers.reduce((sum, w) => sum + w.totalChecks, 0)
      const successfulChecks = workers.reduce((sum, w) => sum + w.successfulChecks, 0)
      const failedChecks = totalChecks - successfulChecks

      return {
        totalWorkers,
        healthyWorkers,
        unhealthyWorkers,
        totalChecks,
        successfulChecks,
        failedChecks,
        successRate: totalChecks > 0 ? successfulChecks / totalChecks : 0,
        healthCheckInterval: this.healthCheckInterval,
        workerTimeout: this.workerTimeout
      }
    } catch (error) {
      this.logger.error('Failed to get health monitor stats:', error)
      throw error
    }
  }

  /**
   * Check if health monitor is healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy () {
    try {
      const stats = await this.getStats()
      return stats.healthyWorkers > 0
    } catch (error) {
      this.logger.error('Health monitor health check failed:', error)
      return false
    }
  }
}

module.exports = HealthMonitor
