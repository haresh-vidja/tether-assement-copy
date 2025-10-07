'use strict'

const async = require('async')
const WrkBase = require('wrk-base/workers/base.wrk')
const ModelStorage = require('./lib/model-storage')
const ModelRegistry = require('./lib/model-registry')

/**
 * Model Manager Worker class
 * Handles AI model storage, distribution, and metadata management
 * @class WrkModelManager
 * @extends WrkBase
 */
class WrkModelManager extends WrkBase {
  /**
   * Creates an instance of WrkModelManager
   * @param {Object} conf - Configuration object
   * @param {Object} ctx - Context object
   * @throws {Error} If required context is missing
   */
  constructor (conf, ctx) {
    super(conf, ctx)

    this.prefix = `model-manager-${ctx.rack || 'default'}`
    this.modelStorage = null
    this.modelRegistry = null
    this.modelCache = new Map()
    this.replicationPeers = new Set()

    this.init()
    this.start()
  }

  /**
   * Initialize the worker
   */
  init () {
    super.init()

    this.modelStorage = new ModelStorage(this.conf, this.logger)
    this.modelRegistry = new ModelRegistry(this.conf, this.logger)
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
        rpcServer.respond('storeModel', this.storeModel.bind(this))
        rpcServer.respond('getModel', this.getModel.bind(this))
        rpcServer.respond('listModels', this.listModels.bind(this))
        rpcServer.respond('deleteModel', this.deleteModel.bind(this))
        rpcServer.respond('getModelMetadata', this.getModelMetadata.bind(this))
        rpcServer.respond('updateModelMetadata', this.updateModelMetadata.bind(this))
        rpcServer.respond('replicateModel', this.replicateModel.bind(this))
        rpcServer.respond('validateModel', this.validateModel.bind(this))
        rpcServer.respond('getStorageStats', this.getStorageStats.bind(this))

        // Initialize storage
        await this.modelStorage.initialize()
        await this.modelRegistry.initialize()

        this.logger.info('Model Manager Worker started successfully')
      }
    ], cb)
  }

  /**
   * Store a new model
   * @param {Object} params - Store parameters
   * @param {string} params.modelId - Model identifier
   * @param {Buffer} params.modelData - Model binary data
   * @param {Object} params.metadata - Model metadata
   * @returns {Promise<Object>} Store result
   */
  async storeModel (params) {
    const { modelId, modelData, metadata } = params

    try {
      this.logger.info(`Storing model: ${modelId}`)

      // Validate model data
      if (!modelData || !Buffer.isBuffer(modelData)) {
        throw new Error('ERR_INVALID_MODEL_DATA')
      }

      // Validate metadata
      if (!metadata || !metadata.type) {
        throw new Error('ERR_INVALID_METADATA')
      }

      // Check if model already exists
      if (await this.modelRegistry.hasModel(modelId)) {
        throw new Error('ERR_MODEL_ALREADY_EXISTS')
      }

      // Store model data
      const storageResult = await this.modelStorage.storeModel(modelId, modelData)

      // Store metadata
      const registryResult = await this.modelRegistry.storeMetadata(modelId, {
        ...metadata,
        storageKey: storageResult.key,
        size: modelData.length,
        checksum: storageResult.checksum,
        createdAt: Date.now(),
        version: metadata.version || '1.0.0'
      })

      // Cache model info
      this.modelCache.set(modelId, {
        metadata: registryResult,
        storageKey: storageResult.key
      })

      this.logger.info(`Model stored successfully: ${modelId}`)

      return {
        success: true,
        modelId,
        storageKey: storageResult.key,
        checksum: storageResult.checksum,
        size: modelData.length
      }
    } catch (error) {
      this.logger.error(`Failed to store model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Retrieve a model
   * @param {Object} params - Get parameters
   * @param {string} params.modelId - Model identifier
   * @param {string} params.version - Optional version
   * @returns {Promise<Object>} Model data and metadata
   */
  async getModel (params) {
    const { modelId, version } = params

    try {
      this.logger.info(`Retrieving model: ${modelId}`)

      // Get model metadata
      const metadata = await this.modelRegistry.getMetadata(modelId, version)
      if (!metadata) {
        throw new Error('ERR_MODEL_NOT_FOUND')
      }

      // Get model data
      const modelData = await this.modelStorage.getModel(metadata.storageKey)

      return {
        success: true,
        modelId,
        metadata,
        modelData
      }
    } catch (error) {
      this.logger.error(`Failed to retrieve model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * List all available models
   * @param {Object} params - List parameters
   * @param {string} params.type - Optional model type filter
   * @param {number} params.limit - Optional limit
   * @returns {Promise<Array>} List of models
   */
  async listModels (params = {}) {
    const { type, limit } = params

    try {
      const models = await this.modelRegistry.listModels(type, limit)
      return {
        success: true,
        models,
        count: models.length
      }
    } catch (error) {
      this.logger.error('Failed to list models:', error)
      throw error
    }
  }

  /**
   * Delete a model
   * @param {Object} params - Delete parameters
   * @param {string} params.modelId - Model identifier
   * @param {string} params.version - Optional version
   * @returns {Promise<Object>} Delete result
   */
  async deleteModel (params) {
    const { modelId, version } = params

    try {
      this.logger.info(`Deleting model: ${modelId}`)

      // Get metadata to find storage key
      const metadata = await this.modelRegistry.getMetadata(modelId, version)
      if (!metadata) {
        throw new Error('ERR_MODEL_NOT_FOUND')
      }

      // Delete from storage
      await this.modelStorage.deleteModel(metadata.storageKey)

      // Delete from registry
      await this.modelRegistry.deleteMetadata(modelId, version)

      // Remove from cache
      this.modelCache.delete(modelId)

      this.logger.info(`Model deleted successfully: ${modelId}`)

      return {
        success: true,
        modelId,
        deletedAt: Date.now()
      }
    } catch (error) {
      this.logger.error(`Failed to delete model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Get model metadata
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Model identifier
   * @param {string} params.version - Optional version
   * @returns {Promise<Object>} Model metadata
   */
  async getModelMetadata (params) {
    const { modelId, version } = params

    try {
      const metadata = await this.modelRegistry.getMetadata(modelId, version)
      if (!metadata) {
        throw new Error('ERR_MODEL_NOT_FOUND')
      }

      return {
        success: true,
        modelId,
        metadata
      }
    } catch (error) {
      this.logger.error(`Failed to get metadata for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Update model metadata
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Model identifier
   * @param {Object} params.metadata - Updated metadata
   * @returns {Promise<Object>} Update result
   */
  async updateModelMetadata (params) {
    const { modelId, metadata } = params

    try {
      const result = await this.modelRegistry.updateMetadata(modelId, metadata)
      return {
        success: true,
        modelId,
        metadata: result
      }
    } catch (error) {
      this.logger.error(`Failed to update metadata for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Replicate model to other peers
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Model identifier
   * @param {Array} params.peers - Target peer addresses
   * @returns {Promise<Object>} Replication result
   */
  async replicateModel (params) {
    const { modelId, peers } = params

    try {
      this.logger.info(`Replicating model ${modelId} to ${peers.length} peers`)

      // Get model data
      const modelResult = await this.getModel({ modelId })
      const { modelData, metadata } = modelResult

      // Replicate to each peer
      const replicationResults = await Promise.allSettled(
        peers.map(async (peerAddress) => {
          // In a real implementation, this would use RPC to send model to peer
          this.logger.debug(`Replicating to peer: ${peerAddress}`)
          return { peer: peerAddress, success: true }
        })
      )

      const successful = replicationResults.filter(r => r.status === 'fulfilled').length
      const failed = replicationResults.filter(r => r.status === 'rejected').length

      return {
        success: true,
        modelId,
        totalPeers: peers.length,
        successfulReplications: successful,
        failedReplications: failed
      }
    } catch (error) {
      this.logger.error(`Failed to replicate model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Validate model integrity
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Model identifier
   * @returns {Promise<Object>} Validation result
   */
  async validateModel (params) {
    const { modelId } = params

    try {
      const metadata = await this.modelRegistry.getMetadata(modelId)
      if (!metadata) {
        throw new Error('ERR_MODEL_NOT_FOUND')
      }

      const modelData = await this.modelStorage.getModel(metadata.storageKey)
      const currentChecksum = this.modelStorage.calculateChecksum(modelData)

      const isValid = currentChecksum === metadata.checksum

      return {
        success: true,
        modelId,
        isValid,
        expectedChecksum: metadata.checksum,
        actualChecksum: currentChecksum
      }
    } catch (error) {
      this.logger.error(`Failed to validate model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats () {
    try {
      const stats = await this.modelStorage.getStats()
      const registryStats = await this.modelRegistry.getStats()

      return {
        success: true,
        storage: stats,
        registry: registryStats,
        cache: {
          size: this.modelCache.size,
          keys: Array.from(this.modelCache.keys())
        }
      }
    } catch (error) {
      this.logger.error('Failed to get storage stats:', error)
      throw error
    }
  }
}

module.exports = WrkModelManager
