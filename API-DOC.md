# Service API Reference

## API Gateway

_All `/api/v1/*` routes expect a valid API key (`x-api-key` or Bearer token) unless authentication is disabled. Rate limiting is enforced per client IP when enabled. CORS preflight (`OPTIONS *`) is handled automatically._

### `GET /health`
- **Description:** Lightweight readiness probe returning uptime and service metadata.
- **Typical use:** Container/orchestrator health checks.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "status": "healthy",
    "service": "api-gateway",
    "uptime": 123.45,
    "version": "1.0.0"
  }
  ```

### `POST /api/v1/inference/:modelId`
- **Description:** Authenticated inference request that validates payloads, enforces rate limits, and forwards to the orchestrator.
- **Typical use:** Primary entry point for executing an AI model.
- **Request body:**
  ```json
  {
    "inputData": { "sample": "payload" },
    "options": {
      "timeout": 5000,
      "requirements": {
        "capabilities": ["gpu"],
        "minCapacity": 2
      }
    }
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "modelId": "image-classifier-v1",
    "result": {
      "predictions": [0.1, 0.9],
      "confidence": 0.87,
      "processingTime": 750
    },
    "workerId": "worker-1",
    "timestamp": 1710000000000
  }
  ```

### `GET /api/v1/models`
- **Description:** Authenticated listing of available models with optional filters.
- **Typical use:** Client dashboards or tooling that need model catalog metadata.
- **Query params:** `type` (optional), `limit` (optional)
- **Response:**
  ```json
  {
    "success": true,
    "models": [
      {
        "modelId": "image-classifier-v1",
        "type": "onnx",
        "version": "1.0.0",
        "description": "Image classification model",
        "createdAt": 1709900000000
      }
    ],
    "count": 1,
    "timestamp": 1710000000000
  }
  ```

### `GET /api/v1/models/:modelId`
- **Description:** Retrieves detailed metadata for a specific model.
- **Typical use:** Pre-flight validation before inference or displaying model details.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "success": true,
    "model": {
      "modelId": "image-classifier-v1",
      "type": "onnx",
      "version": "1.0.0",
      "description": "Image classification model",
      "metadata": {
        "inputShape": [1, 3, 224, 224],
        "outputShape": [1, 1000],
        "framework": "onnx"
      },
      "status": "available"
    },
    "timestamp": 1710000000000
  }
  ```

### `POST /api/v1/models`
- **Description:** Uploads a model binary and associated metadata to the platform.
- **Typical use:** Administrative workflow for registering new model versions.
- **Request body:**
  ```json
  {
    "modelId": "image-classifier-v2",
    "modelData": "<base64-encoded-binary>",
    "metadata": {
      "type": "onnx",
      "version": "2.0.0",
      "description": "Updated classifier"
    }
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "modelId": "image-classifier-v2",
    "result": {
      "status": "created",
      "size": 1048576,
      "checksum": "d2c7...",
      "createdAt": 1710000000000
    },
    "timestamp": 1710000000000
  }
  ```

### `GET /api/v1/status`
- **Description:** Aggregated status view compiled from orchestrator, worker, and model manager telemetry.
- **Typical use:** Operational dashboards and monitoring.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "success": true,
    "status": {
      "orchestrator": {
        "status": "healthy",
        "uptime": 3600,
        "workers": 3,
        "activeRequests": 5
      },
      "aiWorkers": {
        "total": 3,
        "healthy": 3,
        "unhealthy": 0,
        "averageLoad": 0.3
      },
      "modelManager": {
        "status": "healthy",
        "totalModels": 2,
        "storageUsed": "150MB"
      }
    },
    "timestamp": 1710000000000
  }
  ```

---

## Orchestrator

_All endpoints consume/produce JSON. Routing currently returns simulated data; replace with real RPC calls to integrate live workers._

### `GET /health`
- **Description:** Basic liveness/readiness response with uptime information.
- **Typical use:** Deployment tooling verifying the orchestrator is running.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "status": "healthy",
    "service": "orchestrator",
    "uptime": 123.45
  }
  ```

### `POST /api/workers/register`
- **Description:** Registers an inference worker and indexes its capabilities.
- **Typical use:** Worker startup announcing availability to the orchestrator.
- **Request body:**
  ```json
  {
    "workerId": "worker-1",
    "address": "http://localhost:8001",
    "capabilities": {
      "models": ["image-classifier-v1"],
      "tags": ["gpu"],
      "capacity": {
        "maxConcurrent": 10
      }
    }
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "workerId": "worker-1",
    "registeredAt": 1710000000000
  }
  ```

### `POST /api/workers/find`
- **Description:** Resolves an appropriate worker for a requested model, honoring optional requirements.
- **Typical use:** API Gateway (or other clients) determining where to route inference.
- **Request body:**
  ```json
  {
    "modelId": "image-classifier-v1",
    "requirements": {
      "capabilities": ["gpu"],
      "minCapacity": 1
    }
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "worker": {
      "id": "worker-2",
      "address": "http://localhost:8001",
      "capabilities": ["gpu", "onnx"]
    }
  }
  ```

### `POST /api/inference/route`
- **Description:** Convenience endpoint that combines worker selection with a proxied inference call (currently simulated).
- **Typical use:** Simplifies orchestration for clients preferring a single request.
- **Request body:**
  ```json
  {
    "modelId": "image-classifier-v1",
    "inputData": { "sample": "payload" },
    "options": {
      "requirements": {
        "capabilities": ["gpu"]
      }
    }
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "result": {
      "success": true,
      "result": {
        "predictions": [0.1, 0.9],
        "confidence": 0.87,
        "processingTime": 750,
        "modelId": "image-classifier-v1"
      }
    },
    "workerId": "worker-2",
    "routedAt": 1710000000000
  }
  ```

### `GET /api/status`
- **Description:** Provides registry, load balancer, and health monitor statistics.
- **Typical use:** Operations dashboards and troubleshooting workflows.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "success": true,
    "status": "healthy",
    "timestamp": 1710000000000,
    "registry": {
      "totalWorkers": 3,
      "activeWorkers": 3,
      "inactiveWorkers": 0,
      "totalModels": 5,
      "totalCapabilities": 4,
      "modelDistribution": {
        "image-classifier-v1": 2
      }
    },
    "loadBalancer": {
      "strategy": "round-robin",
      "totalWorkers": 3,
      "workerStats": {
        "worker-1": {
          "requestCount": 20,
          "averageProcessingTime": 800,
          "successCount": 19,
          "failureCount": 1
        }
      }
    },
    "health": {
      "totalWorkers": 3,
      "healthyWorkers": 3,
      "unhealthyWorkers": 0,
      "totalChecks": 30,
      "successfulChecks": 30,
      "failedChecks": 0
    },
    "workers": {
      "total": 3,
      "active": 3
    }
  }
  ```

---

## AI Inference Worker

_All endpoints accept and return JSON. The worker enforces a `maxConcurrent` guard; preload models ahead of time to avoid “Model not available” responses._

### `GET /health`
- **Description:** Reports service health along with current capacity snapshot.
- **Typical use:** Orchestrator or deployment probes verifying worker readiness.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "status": "healthy",
    "service": "ai-inference",
    "capacity": {
      "maxConcurrent": 10,
      "currentLoad": 0,
      "availableModels": ["image-classifier-v1"]
    },
    "uptime": 120.5
  }
  ```

### `POST /api/inference/:modelId`
- **Description:** Executes inference using a preloaded model, tracking performance and history.
- **Typical use:** Direct dispatch from orchestrator or gateway when serving inference traffic.
- **Request body:**
  ```json
  {
    "inputData": { "sample": "payload" },
    "options": {
      "timeout": 5000
    }
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "result": {
      "inferenceId": "inf_1710000000000_abc123",
      "result": {
        "predictions": [0.1, 0.9],
        "confidence": 0.87,
        "metadata": {
          "modelVersion": "1.0.0",
          "processedAt": 1710000000000
        }
      },
      "processingTime": 750,
      "modelId": "image-classifier-v1",
      "timestamp": 1710000000000
    },
    "modelId": "image-classifier-v1",
    "timestamp": 1710000000000
  }
  ```

### `GET /api/capacity`
- **Description:** Returns concurrency limits, current load, and available models for the worker.
- **Typical use:** Capacity planning and routing heuristics before assigning work.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "maxConcurrent": 10,
    "currentLoad": 0,
    "available": true,
    "availableModels": ["image-classifier-v1", "text-sentiment-v1"]
  }
  ```

### `POST /api/models/:modelId/load`
- **Description:** Preloads a model into memory/cache to prepare for real-time inference.
- **Typical use:** Warm-up routines executed before routing traffic to the worker.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "success": true,
    "message": "Model loaded successfully"
  }
  ```

---

## Model Manager

_All endpoints consume/produce JSON. Binaries are written to the configured `models/` directory, while metadata is tracked via the in-memory registry (extend or persist as needed)._ 

### `GET /health`
- **Description:** Simple liveness indicator for the model manager service.
- **Typical use:** Deployment probes and monitoring tools ensuring availability.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "status": "healthy",
    "service": "model-manager"
  }
  ```

### `POST /api/models`
- **Description:** Persists a model binary and metadata to storage.
- **Typical use:** Administrative publishing of new or updated model versions.
- **Request body:**
  ```json
  {
    "modelId": "image-classifier-v1",
    "modelData": "<base64-encoded-binary>",
    "metadata": {
      "type": "onnx",
      "version": "1.0.0",
      "description": "Image classification model"
    }
  }
  ```
- **Response:**
  ```json
  {
    "key": "abc123.model",
    "path": "./models/abc123.model",
    "checksum": "d2c7...",
    "size": 1048576
  }
  ```

### `GET /api/models/:modelId`
- **Description:** Fetches stored metadata and Base64-encoded binary for a specific model.
- **Typical use:** AI workers retrieving model assets ahead of loading into memory.
- **Request body:** _None_
- **Response:**
  ```json
  {
    "modelId": "image-classifier-v1",
    "metadata": {
      "type": "onnx",
      "version": "1.0.0",
      "description": "Image classification model"
    },
      "modelData": "<base64-encoded-binary>"
  }
  ```

### `GET /api/models`
- **Description:** Lists available models with optional filtering.
- **Typical use:** Catalog views, orchestrator discovery, or audit tooling.
- **Query params:** `type` (optional), `limit` (optional)
- **Response:**
  ```json
  {
    "models": [
      {
        "modelId": "image-classifier-v1",
        "metadata": {
          "type": "onnx",
          "version": "1.0.0",
          "description": "Image classification model"
        }
      }
    ],
    "count": 1
  }
  ```
