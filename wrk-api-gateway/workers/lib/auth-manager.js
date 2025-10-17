'use strict'

/**
 * Authentication Manager class for handling API authentication
 * @class AuthManager
 */
class AuthManager {
  /**
   * Creates an instance of AuthManager
   * @param {Object} conf - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor (conf, logger) {
    this.conf = conf
    this.logger = logger
    this.apiKeys = new Map()
    this.sessions = new Map()
  }

  /**
   * Initialize authentication manager
   * @returns {Promise<void>}
   */
  async initialize () {
    try {
      // Initialize with some default API keys for demonstration
      this.apiKeys.set('demo-api-key-123', {
        name: 'Demo Client',
        permissions: ['inference', 'models:read', 'models:write'],
        createdAt: Date.now(),
        lastUsed: null
      })

      this.apiKeys.set('admin-key-456', {
        name: 'Admin Client',
        permissions: ['*'],
        createdAt: Date.now(),
        lastUsed: null
      })

      this.logger.info('Authentication manager initialized')
    } catch (error) {
      this.logger.error('Failed to initialize authentication manager:', error)
      throw error
    }
  }

  /**
   * Authenticate request
   * @param {Object} req - HTTP request
   * @returns {Promise<boolean>} Authentication result
   */
  async authenticate (req) {
    try {
      if (!this.conf.authentication?.enabled) {
        return true
      }

      // Check for API key in header
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')

      if (!apiKey) {
        this.logger.warn('Authentication failed: No API key provided')
        return false
      }

      // Validate API key
      const keyInfo = this.apiKeys.get(apiKey)
      if (!keyInfo) {
        this.logger.warn(`Authentication failed: Invalid API key`)
        return false
      }

      // Update last used timestamp
      keyInfo.lastUsed = Date.now()
      this.apiKeys.set(apiKey, keyInfo)

      // Store user info in request for later use
      req.user = {
        apiKey,
        name: keyInfo.name,
        permissions: keyInfo.permissions
      }

      this.logger.debug(`Authentication successful for: ${keyInfo.name}`)
      return true
    } catch (error) {
      this.logger.error('Authentication error:', error)
      return false
    }
  }

  /**
   * Check if user has permission
   * @param {Object} user - User object
   * @param {string} permission - Permission to check
   * @returns {boolean} Permission result
   */
  hasPermission (user, permission) {
    if (!user || !user.permissions) {
      return false
    }

    // Check for wildcard permission
    if (user.permissions.includes('*')) {
      return true
    }

    // Check for specific permission
    return user.permissions.includes(permission)
  }

  /**
   * Create new API key
   * @param {Object} params - Key parameters
   * @returns {Promise<Object>} Created key info
   */
  async createApiKey (params) {
    try {
      const { name, permissions = [] } = params

      // Generate new API key
      const apiKey = this.generateApiKey()

      const keyInfo = {
        name,
        permissions,
        createdAt: Date.now(),
        lastUsed: null
      }

      this.apiKeys.set(apiKey, keyInfo)

      this.logger.info(`API key created for: ${name}`)

      return {
        apiKey,
        keyInfo
      }
    } catch (error) {
      this.logger.error('Failed to create API key:', error)
      throw error
    }
  }

  /**
   * Revoke API key
   * @param {string} apiKey - API key to revoke
   * @returns {Promise<boolean>} Revocation result
   */
  async revokeApiKey (apiKey) {
    try {
      const keyInfo = this.apiKeys.get(apiKey)
      if (!keyInfo) {
        return false
      }

      this.apiKeys.delete(apiKey)
      this.logger.info(`API key revoked for: ${keyInfo.name}`)
      return true
    } catch (error) {
      this.logger.error('Failed to revoke API key:', error)
      throw error
    }
  }

  /**
   * List API keys
   * @returns {Promise<Array>} List of API keys
   */
  async listApiKeys () {
    try {
      const keys = []
      for (const [apiKey, info] of this.apiKeys.entries()) {
        keys.push({
          apiKey: apiKey.substring(0, 8) + '...', // Mask the key
          name: info.name,
          permissions: info.permissions,
          createdAt: info.createdAt,
          lastUsed: info.lastUsed
        })
      }
      return keys
    } catch (error) {
      this.logger.error('Failed to list API keys:', error)
      throw error
    }
  }

  /**
   * Generate new API key
   * @returns {string} Generated API key
   */
  generateApiKey () {
    const crypto = require('crypto')
    const randomBytes = crypto.randomBytes(32)
    return randomBytes.toString('hex')
  }

  /**
   * Get authentication statistics
   * @returns {Promise<Object>} Auth statistics
   */randomBytes
  async getStats () {
    try {
      const totalKeys = this.apiKeys.size
      const activeKeys = Array.from(this.apiKeys.values()).filter(key => {
        const oneDayAgo = Date.now() - 86400000
        return key.lastUsed && key.lastUsed > oneDayAgo
      }).length

      return {
        totalApiKeys: totalKeys,
        activeApiKeys: activeKeys,
        inactiveApiKeys: totalKeys - activeKeys,
        authenticationEnabled: this.conf.authentication?.enabled || false
      }
    } catch (error) {
      this.logger.error('Failed to get auth stats:', error)
      throw error
    }
  }
}

module.exports = AuthManager
