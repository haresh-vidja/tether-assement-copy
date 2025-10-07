'use strict'

const async = require('async')
const WrkBase = require('wrk-base/workers/base.wrk')
const ModelManager = require('./lib/model-manager')
const InferenceEngine = require('./lib/inference-engine')

/**
 * AI Inference Worker class
 * Handles AI model inference requests using Hyperswarm RPC
 * @class WrkAiInference
 * @extends WrkBase
 */
class WrkAiInference extends WrkBase {
  /**
   * Creates an instance of WrkAiInference
   * @param {Object} conf - Configuration object
   * @param {Object} ctx - Context object
   * @throws {Error} If required context is missing
   */
  constructor (conf, ctx) {
    super(conf, ctx)

    this.prefix = `ai-inference-${ctx.rack || 'default'}`
    this.modelManager = null
    this.inferenceEngine = null
    this.activeInferences = new Map()
    this.modelCache = new Map()
    this.capacity = {
      maxConcurrent: this.conf.maxConcurrentInferences || 10,
      currentLoad: 0,
      availableModels: new Set()
    }

    this.init()
    this.start()
  }

  /**
   * Initialize the worker
   */
  init () {
    super.init()

    this.modelManager = new ModelManager(this.conf, this.logger)
    this.inferenceEngine = new InferenceEngine(this.conf, this.logger)
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
        rpcServer.respond('runInference', this.runInference.bind(this))
        rpcServer.respond('checkCapacity', this.checkCapacity.bind(this))
        rpcServer.respond('getAvailableModels', this.getAvailableModels.bind(this))
        rpcServer.respond('loadModel', this.loadModel.bind(this))
        rpcServer.respond('unloadModel', this.unloadModel.bind(this))
        rpcServer.respond('getHealth', this.getHealth.bind(this))

        // Start health monitoring
        this.startHealthMonitoring()

        this.logger.info('AI Inference Worker started successfully')
      }
    ], cb)
  }

  /**
   * Run inference on a model
   * @param {Object} params - Inference parameters
   * @param {string} params.modelId - Model identifier
   * @param {Object} params.inputData - Input data for inference
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Inference result
   */
  async runInference (params) {
    const { modelId, inputData, options = {} } = params

    try {
      // Check capacity
      if (this.capacity.currentLoad >= this.capacity.maxConcurrent) {
        throw new Error('ERR_CAPACITY_EXCEEDED')
      }

      // Check if model is available
      if (!this.capacity.availableModels.has(modelId)) {
        throw new Error('ERR_MODEL_NOT_AVAILABLE')
      }

      // Increment load counter
      this.capacity.currentLoad++

      // Get or load model
      let model = this.modelCache.get(modelId)
      if (!model) {
        model = await this.modelManager.loadModel(modelId)
        this.modelCache.set(modelId, model)
      }

      // Run inference
      const result = await this.inferenceEngine.runInference(model, inputData, options)

      // Decrement load counter
      this.capacity.currentLoad--

      return {
        success: true,
        result: result,
        modelId: modelId,
        timestamp: Date.now()
      }
    } catch (error) {
      this.capacity.currentLoad--
      this.logger.error('Inference failed:', error)
      throw error
    }
  }

  /**
   * Check current capacity and availability
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Optional model ID to check
   * @returns {Object} Capacity information
   */
  async checkCapacity (params) {
    const { modelId } = params || {}

    const capacity = {
      maxConcurrent: this.capacity.maxConcurrent,
      currentLoad: this.capacity.currentLoad,
      available: this.capacity.currentLoad < this.capacity.maxConcurrent,
      availableModels: Array.from(this.capacity.availableModels),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }

    if (modelId) {
      capacity.modelAvailable = this.capacity.availableModels.has(modelId)
      capacity.modelLoaded = this.modelCache.has(modelId)
    }

    return capacity
  }

  /**
   * Get list of available models
   * @returns {Array<string>} List of available model IDs
   */
  async getAvailableModels () {
    return Array.from(this.capacity.availableModels)
  }

  /**
   * Load a model into memory
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Model identifier
   * @returns {Object} Load result
   */
  async loadModel (params) {
    const { modelId } = params

    try {
      if (this.modelCache.has(modelId)) {
        return { success: true, message: 'Model already loaded' }
      }

      const model = await this.modelManager.loadModel(modelId)
      this.modelCache.set(modelId, model)
      this.capacity.availableModels.add(modelId)

      return { success: true, message: 'Model loaded successfully' }
    } catch (error) {
      this.logger.error('Failed to load model:', error)
      throw error
    }
  }

  /**
   * Unload a model from memory
   * @param {Object} params - Parameters
   * @param {string} params.modelId - Model identifier
   * @returns {Object} Unload result
   */
  async unloadModel (params) {
    const { modelId } = params

    try {
      if (this.modelCache.has(modelId)) {
        this.modelCache.delete(modelId)
        this.capacity.availableModels.delete(modelId)
        return { success: true, message: 'Model unloaded successfully' }
      }

      return { success: true, message: 'Model not loaded' }
    } catch (error) {
      this.logger.error('Failed to unload model:', error)
      throw error
    }
  }

  /**
   * Get health status
   * @returns {Object} Health information
   */
  async getHealth () {
    return {
      status: 'healthy',
      capacity: this.capacity,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: Date.now()
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring () {
    setInterval(() => {
      // Clean up completed inferences
      this.activeInferences.forEach((inference, id) => {
        if (inference.completed) {
          this.activeInferences.delete(id)
        }
      })

      // Log health status
      this.logger.debug('Health check:', {
        currentLoad: this.capacity.currentLoad,
        maxConcurrent: this.capacity.maxConcurrent,
        availableModels: this.capacity.availableModels.size,
        memoryUsage: process.memoryUsage()
      })
    }, this.conf.healthCheckInterval || 10000)
  }
}

module.exports = WrkAiInference
