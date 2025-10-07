'use strict'

/**
 * Model Registry class for managing model metadata
 * @class ModelRegistry
 */
class ModelRegistry {
  /**
   * Creates an instance of ModelRegistry
   * @param {Object} conf - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor (conf, logger) {
    this.conf = conf
    this.logger = logger
    this.metadataStore = new Map()
    this.versionIndex = new Map()
    this.typeIndex = new Map()
  }

  /**
   * Initialize registry
   * @returns {Promise<void>}
   */
  async initialize () {
    this.logger.info('Model registry initialized')
  }

  /**
   * Store model metadata
   * @param {string} modelId - Model identifier
   * @param {Object} metadata - Model metadata
   * @returns {Promise<Object>} Stored metadata
   */
  async storeMetadata (modelId, metadata) {
    try {
      const fullMetadata = {
        ...metadata,
        modelId,
        createdAt: metadata.createdAt || Date.now(),
        updatedAt: Date.now()
      }

      // Store in main registry
      this.metadataStore.set(modelId, fullMetadata)

      // Index by version
      if (!this.versionIndex.has(modelId)) {
        this.versionIndex.set(modelId, new Set())
      }
      this.versionIndex.get(modelId).add(metadata.version || '1.0.0')

      // Index by type
      if (!this.typeIndex.has(metadata.type)) {
        this.typeIndex.set(metadata.type, new Set())
      }
      this.typeIndex.get(metadata.type).add(modelId)

      this.logger.info(`Metadata stored for model: ${modelId}`)
      return fullMetadata
    } catch (error) {
      this.logger.error(`Failed to store metadata for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Get model metadata
   * @param {string} modelId - Model identifier
   * @param {string} version - Optional version
   * @returns {Promise<Object|null>} Model metadata
   */
  async getMetadata (modelId, version) {
    try {
      const metadata = this.metadataStore.get(modelId)
      if (!metadata) {
        return null
      }

      // If version specified, check if it exists
      if (version && metadata.version !== version) {
        const versions = this.versionIndex.get(modelId)
        if (!versions || !versions.has(version)) {
          return null
        }
      }

      return metadata
    } catch (error) {
      this.logger.error(`Failed to get metadata for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Update model metadata
   * @param {string} modelId - Model identifier
   * @param {Object} updates - Metadata updates
   * @returns {Promise<Object>} Updated metadata
   */
  async updateMetadata (modelId, updates) {
    try {
      const existing = this.metadataStore.get(modelId)
      if (!existing) {
        throw new Error('ERR_MODEL_NOT_FOUND')
      }

      const updatedMetadata = {
        ...existing,
        ...updates,
        updatedAt: Date.now()
      }

      this.metadataStore.set(modelId, updatedMetadata)

      // Update type index if type changed
      if (updates.type && updates.type !== existing.type) {
        // Remove from old type index
        const oldTypeSet = this.typeIndex.get(existing.type)
        if (oldTypeSet) {
          oldTypeSet.delete(modelId)
        }

        // Add to new type index
        if (!this.typeIndex.has(updates.type)) {
          this.typeIndex.set(updates.type, new Set())
        }
        this.typeIndex.get(updates.type).add(modelId)
      }

      this.logger.info(`Metadata updated for model: ${modelId}`)
      return updatedMetadata
    } catch (error) {
      this.logger.error(`Failed to update metadata for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Delete model metadata
   * @param {string} modelId - Model identifier
   * @param {string} version - Optional version
   * @returns {Promise<boolean>} Success status
   */
  async deleteMetadata (modelId, version) {
    try {
      const metadata = this.metadataStore.get(modelId)
      if (!metadata) {
        return false
      }

      // Remove from main registry
      this.metadataStore.delete(modelId)

      // Remove from version index
      this.versionIndex.delete(modelId)

      // Remove from type index
      const typeSet = this.typeIndex.get(metadata.type)
      if (typeSet) {
        typeSet.delete(modelId)
      }

      this.logger.info(`Metadata deleted for model: ${modelId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to delete metadata for model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Check if model exists
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>} Existence status
   */
  async hasModel (modelId) {
    return this.metadataStore.has(modelId)
  }

  /**
   * List models with optional filtering
   * @param {string} type - Optional model type filter
   * @param {number} limit - Optional limit
   * @returns {Promise<Array>} List of models
   */
  async listModels (type, limit) {
    try {
      let models = []

      if (type) {
        // Filter by type
        const typeSet = this.typeIndex.get(type)
        if (typeSet) {
          models = Array.from(typeSet).map(modelId => ({
            modelId,
            metadata: this.metadataStore.get(modelId)
          }))
        }
      } else {
        // Return all models
        models = Array.from(this.metadataStore.entries()).map(([modelId, metadata]) => ({
          modelId,
          metadata
        }))
      }

      // Apply limit if specified
      if (limit && limit > 0) {
        models = models.slice(0, limit)
      }

      return models
    } catch (error) {
      this.logger.error('Failed to list models:', error)
      throw error
    }
  }

  /**
   * Get registry statistics
   * @returns {Promise<Object>} Registry statistics
   */
  async getStats () {
    try {
      const totalModels = this.metadataStore.size
      const typeStats = {}

      // Count models by type
      for (const [type, modelSet] of this.typeIndex.entries()) {
        typeStats[type] = modelSet.size
      }

      return {
        totalModels,
        typeStats,
        versionIndexSize: this.versionIndex.size,
        typeIndexSize: this.typeIndex.size
      }
    } catch (error) {
      this.logger.error('Failed to get registry stats:', error)
      throw error
    }
  }

  /**
   * Search models by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Matching models
   */
  async searchModels (criteria) {
    try {
      const results = []

      for (const [modelId, metadata] of this.metadataStore.entries()) {
        let matches = true

        // Check each criterion
        for (const [key, value] of Object.entries(criteria)) {
          if (metadata[key] !== value) {
            matches = false
            break
          }
        }

        if (matches) {
          results.push({
            modelId,
            metadata
          })
        }
      }

      return results
    } catch (error) {
      this.logger.error('Failed to search models:', error)
      throw error
    }
  }
}

module.exports = ModelRegistry
