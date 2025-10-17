# Wrk-Orchestrator Overview

**Wrk-Orchestrator** acts as the control plane for AI workers.
It can run either as:

* A **standalone HTTP service** (`wrk-orchestrator/worker.js`), or
* A **rack-integrated worker** (`wrk-orchestrator/workers/orchestrator.wrk.js`)

On boot, it spins up **discovery**, **load balancing**, and **health routines**.

* Standalone start: [`wrk-orchestrator/worker.js:27`](worker.js#L27)
* Worker version start: [`wrk-orchestrator/workers/orchestrator.wrk.js:51`](workers/orchestrator.wrk.js#L51)

The worker version inherits networking from `wrk-base`, exposing **RPC handlers** that allow other racks to:

* Register workers
* Request routing
* Query status (without HTTP)

---

## Core Components

### 1. ServiceRegistry

Tracks every registered worker and indexes them by capability/model.
Provides lookup helpers for **model-aware routing**.

**Files:**

* [`wrk-orchestrator/workers/lib/service-registry.js:13`](workers/lib/service-registry.js#L13)
* [`wrk-orchestrator/workers/lib/service-registry.js:34`](workers/lib/service-registry.js#L34)
* [`wrk-orchestrator/workers/lib/service-registry.js:121`](workers/lib/service-registry.js#L121)

---

### 2. LoadBalancer

Selects a worker per request using the configured strategy (**round robin** by default).
Maintains per-worker metrics for smarter strategies like **least-connections** or **weighted choices**.

**Files:**

* [`wrk-orchestrator/workers/lib/load-balancer.js:13`](workers/lib/load-balancer.js#L13)
* [`wrk-orchestrator/workers/lib/load-balancer.js:82`](workers/lib/load-balancer.js#L82)
* [`wrk-orchestrator/workers/lib/load-balancer.js:195`](workers/lib/load-balancer.js#L195)
* [`wrk-orchestrator/workers/lib/load-balancer.js:235`](workers/lib/load-balancer.js#L235)

---

### 3. HealthMonitor

Runs heartbeat probes, tracks health states, and flags flapping or unhealthy workers.
Produces aggregated health stats for system-level visibility.

**Files:**

* [`wrk-orchestrator/workers/lib/health-monitor.js:13`](workers/lib/health-monitor.js#L13)
* [`wrk-orchestrator/workers/lib/health-monitor.js:36`](workers/lib/health-monitor.js#L36)
* [`wrk-orchestrator/workers/lib/health-monitor.js:79`](workers/lib/health-monitor.js#L79)
* [`wrk-orchestrator/workers/lib/health-monitor.js:218`](workers/lib/health-monitor.js#L218)

---

## Worker Lifecycle and Networking

1. **Initialization**
   Constructors wire up core components and rack-specific prefixes.
   Startup begins automatically when the context is ready.

   * [`wrk-orchestrator/workers/orchestrator.wrk.js:22`](workers/orchestrator.wrk.js#L22)

2. **RPC Endpoints**
   On startup, the worker exposes RPC methods such as:

   * `registerWorker`
   * `routeInferenceRequest`
   * `getServiceStatus`
   * `healthCheck`
   * [`wrk-orchestrator/workers/orchestrator.wrk.js:58`](workers/orchestrator.wrk.js#L58)
   * [`wrk-orchestrator/workers/orchestrator.wrk.js:64`](workers/orchestrator.wrk.js#L64)

3. **Inference Routing Flow**

   * Finds candidate workers via **ServiceRegistry**
   * Filters by capability/requirements
   * Selects via **LoadBalancer**
   * Forwards the RPC to the target worker
   * Updates performance stats
   * [`wrk-orchestrator/workers/orchestrator.wrk.js:87`](workers/orchestrator.wrk.js#L87)
   * [`wrk-orchestrator/workers/orchestrator.wrk.js:249`](workers/orchestrator.wrk.js#L249)

4. **Connection Management**
   RPC clients are cached per worker so repeated inference calls reuse connections.

   * [`wrk-orchestrator/workers/orchestrator.wrk.js:372`](workers/orchestrator.wrk.js#L372)

---

## Standalone HTTP Mode

The HTTP variant provides REST endpoints for:

* Health checks
* Worker registration
* Worker discovery
* Inference routing
* Status reporting

**Files:**

* [`wrk-orchestrator/worker.js:51`](worker.js#L51)
* [`wrk-orchestrator/worker.js:120`](worker.js#L120)

The inference path can simulate downstream processing, useful for testing when real workers are not connected.

* [`wrk-orchestrator/worker.js:226`](worker.js#L226)

---

## Background Processes and Observability

* **Service Discovery and Health Loops**
  Periodic tasks refresh the registry and automatically quarantine unhealthy workers.

  * [`wrk-orchestrator/worker.js:280`](worker.js#L280)
  * [`wrk-orchestrator/worker.js:291`](worker.js#L291)
  * [`wrk-orchestrator/workers/orchestrator.wrk.js:392`](workers/orchestrator.wrk.js#L392)
  * [`wrk-orchestrator/workers/orchestrator.wrk.js:406`](workers/orchestrator.wrk.js#L406)

* **Status Aggregation**
  Consolidated status calls return:

  * Registry metrics
  * Balancer stats
  * Health data
  * Active RPC clients
  * [`wrk-orchestrator/worker.js:261`](worker.js#L261)
  * [`wrk-orchestrator/workers/orchestrator.wrk.js:271`](workers/orchestrator.wrk.js#L271)

---

## Configuration

Behavior is defined in `config/common.json`, including:

* Health check intervals
* Load-balancing strategies
* Timeouts

Each setting can be tuned per deployment.

* [`wrk-orchestrator/config/common.json:2`](config/common.json#L2)

---

Would you like me to extend this into a full **README.md** version (with introduction, setup, usage, and architecture diagram placeholders)?
