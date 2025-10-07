'use strict'

const crypto = require('crypto')
const fs = require('fs').promises
const path = require('path')

/**
 * Model Storage class for handling model data storage
 * @class ModelStorage
 */
class ModelStorage {
  /**
   * Creates an instance of ModelStorage
   * @param {Object} conf - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor (conf, logger) {
    this.conf = conf
    this.logger = logger
    this.storagePath = conf.storagePath || './models'
    this.maxModelSize = this.parseSize(conf.maxModelSize || '1GB')
    this.compressionEnabled = conf.compressionEnabled || false
  }

  /**
   * Initialize storage
   * @returns {Promise<void>}
   */
  async initialize () {
    try {
      await fs.mkdir(this.storagePath, { recursive: true })
      this.logger.info(`Model storage initialized at: ${this.storagePath}`)
    } catch (error) {
      this.logger.error('Failed to initialize storage:', error)
      throw error
    }
  }

  /**
   * Store model data
   * @param {string} modelId - Model identifier
   * @param {Buffer} modelData - Model binary data
   * @returns {Promise<Object>} Storage result
   */
  async storeModel (modelId, modelData) {
    try {
      // Validate model size
      if (modelData.length > this.maxModelSize) {
        throw new Error('ERR_MODEL_TOO_LARGE')
      }

      // Generate storage key
      const storageKey = this.generateStorageKey(modelId)
      const filePath = path.join(this.storagePath, storageKey)

      // Calculate checksum
      const checksum = this.calculateChecksum(modelData)

      // Store model data
      await fs.writeFile(filePath, modelData)

      this.logger.info(`Model stored: ${modelId} -> ${storageKey}`)

      return {
        key: storageKey,
        path: filePath,
        checksum,
        size: modelData.length
      }
    } catch (error) {
      this.logger.error(`Failed to store model ${modelId}:`, error)
      throw error
    }
  }

  /**
   * Retrieve model data
   * @param {string} storageKey - Storage key
   * @returns {Promise<Buffer>} Model data
   */
  async getModel (storageKey) {
    try {
      const filePath = path.join(this.storagePath, storageKey)
      const modelData = await fs.readFile(filePath)
      return modelData
    } catch (error) {
      this.logger.error(`Failed to retrieve model ${storageKey}:`, error)
      throw error
    }
  }

  /**
   * Delete model data
   * @param {string} storageKey - Storage key
   * @returns {Promise<boolean>} Success status
   */
  async deleteModel (storageKey) {
    try {
      const filePath = path.join(this.storagePath, storageKey)
      await fs.unlink(filePath)
      this.logger.info(`Model deleted: ${storageKey}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to delete model ${storageKey}:`, error)
      throw error
    }
  }

  /**
   * Generate storage key for model
   * @param {string} modelId - Model identifier
   * @returns {string} Storage key
   */
  generateStorageKey (modelId) {
    const hash = crypto.createHash('sha256').update(modelId).digest('hex')
    return `${hash}.model`
  }

  /**
   * Calculate checksum for data
   * @param {Buffer} data - Data to checksum
   * @returns {string} Checksum
   */
  calculateChecksum (data) {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Parse size string to bytes
   * @param {string} sizeStr - Size string (e.g., "1GB", "500MB")
   * @returns {number} Size in bytes
   */
  parseSize (sizeStr) {
    const units = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024
    }

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i)
    if (!match) {
      return 1024 * 1024 * 1024 // Default to 1GB
    }

    const size = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    return size * units[unit]
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStats () {
    try {
      const files = await fs.readdir(this.storagePath)
      let totalSize = 0
      let fileCount = 0

      for (const file of files) {
        const filePath = path.join(this.storagePath, file)
        const stats = await fs.stat(filePath)
        if (stats.isFile()) {
          totalSize += stats.size
          fileCount++
        }
      }

      return {
        totalFiles: fileCount,
        totalSize,
        totalSizeFormatted: this.formatSize(totalSize),
        maxModelSize: this.maxModelSize,
        maxModelSizeFormatted: this.formatSize(this.maxModelSize),
        compressionEnabled: this.compressionEnabled
      }
    } catch (error) {
      this.logger.error('Failed to get storage stats:', error)
      throw error
    }
  }

  /**
   * Format size in bytes to human readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatSize (bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }
}

module.exports = ModelStorage
