# Wrk-AI-Inference Overview

## Role in Stack

**Wrk-AI-Inference** provides the **execution engine** for AI models.
It can operate in two modes:

* **Standalone Express microservice**, or
* **Rack worker fronted by Hyperswarm RPC**

Both boot paths share the same model-loading and inference logic.

**References:**

* [`wrk-ai-inference/worker.js:12`](worker.js#L12)
* [`wrk-ai-inference/workers/ai.inference.wrk.js:21`](workers/ai.inference.wrk.js#L21)

---

## Key Components

### 1. ModelManager

Handles:

* Model loading and unloading
* Metadata management
* In-memory caching keyed by model ID

Currently uses mocked storage but is structured for future integration with **Hypercore** or remote backends.

**References:**

* [`wrk-ai-inference/workers/lib/model-manager.js:13`](workers/lib/model-manager.js#L13)
* [`wrk-ai-inference/workers/lib/model-manager.js:40`](workers/lib/model-manager.js#L40)
* [`wrk-ai-inference/workers/lib/model-manager.js:78`](workers/lib/model-manager.js#L78)

---

### 2. InferenceEngine

Manages the full **inference lifecycle**, including:

* Validation
* Preprocessing
* Execution with timeout guards
* Postprocessing
* History logging for observability

**References:**

* [`wrk-ai-inference/workers/lib/inference-engine.js:7`](workers/lib/inference-engine.js#L7)
* [`wrk-ai-inference/workers/lib/inference-engine.js:34`](workers/lib/inference-engine.js#L34)
* [`wrk-ai-inference/workers/lib/inference-engine.js:65`](workers/lib/inference-engine.js#L65)
* [`wrk-ai-inference/workers/lib/inference-engine.js:94`](workers/lib/inference-engine.js#L94)

---

### 3. Capacity Tracking

Implements internal mechanisms to:

* Cap **parallel requests**
* Advertise **warmed models**
* Help the orchestrator select healthy and available workers

**References:**

* [`wrk-ai-inference/worker.js:23`](worker.js#L23)
* [`wrk-ai-inference/worker.js:69`](worker.js#L69)
* [`wrk-ai-inference/workers/ai.inference.wrk.js:23`](workers/ai.inference.wrk.js#L23)
* [`wrk-ai-inference/workers/ai.inference.wrk.js:100`](workers/ai.inference.wrk.js#L100)

---

## Standalone HTTP Mode

The HTTP variant exposes the following endpoints:

* `/api/inference/:modelId`
* `/api/models/:modelId/load`
* `/api/capacity`
* `/health`

Each endpoint delegates to shared helpers, with **concurrency checks** and **availability flags** preventing overload or cold model access.

**References:**

* [`wrk-ai-inference/worker.js:54`](worker.js#L54)
* [`wrk-ai-inference/worker.js:86`](worker.js#L86)
* [`wrk-ai-inference/worker.js:116`](worker.js#L116)

**Startup and Health Monitoring:**

* Ensures dependencies are initialized before serving traffic
* Emits periodic diagnostics for observability

**References:**

* [`wrk-ai-inference/worker.js:31`](worker.js#L31)
* [`wrk-ai-inference/worker.js:188`](worker.js#L188)

---

## Rack Worker Mode

Registers RPC endpoints for orchestration, mirroring the HTTP API:

* `runInference`
* `loadModel`
* `checkCapacity`
* `getHealth`

This symmetry allows the **orchestrator** to manage workers uniformly over the network.

**References:**

* [`wrk-ai-inference/workers/ai.inference.wrk.js:52`](workers/ai.inference.wrk.js#L52)
* [`wrk-ai-inference/workers/ai.inference.wrk.js:94`](workers/ai.inference.wrk.js#L94)
* [`wrk-ai-inference/workers/ai.inference.wrk.js:143`](workers/ai.inference.wrk.js#L143)

Maintains:

* `activeInferences` list
* Periodic cleanup
* Health logging

These mechanisms make it easy to extend the system with richer metrics or heartbeat reporting to the control plane.

**References:**

* [`wrk-ai-inference/workers/ai.inference.wrk.js:24`](workers/ai.inference.wrk.js#L24)
* [`wrk-ai-inference/workers/ai.inference.wrk.js:202`](workers/ai.inference.wrk.js#L202)

---

## Configuration

Runtime configuration parameters are defined in `config/common.json`, including:

* Port
* Maximum concurrent inferences
* Timeout duration
* Cache size
* Health check interval

These options enable flexible tuning per deployment or environment.

**Reference:**

* [`wrk-ai-inference/config/common.json:2`](config/common.json#L2)
