# Concept Notes — Hyperswarm & Tether AI Platform

## 1. Rapid Facts
- Platform ships as a **Node.js microservice bundle** (API Gateway, Orchestrator, Model Manager, AI Inference Worker).
- Current code operates **centrally on a single host**; Hyperswarm hooks are scaffolded but mocked.
- AI inference = **running trained models on new inputs** (training happens elsewhere).
- Default ports: Gateway `3000`, AI Inference Worker `8001`, Model Manager `8002`, Orchestrator `8003`.

---

## 2. Hyperswarm Essentials
Hyperswarm provides peer discovery, encrypted connectivity, and NAT traversal over a DHT so services can rendezvous without central servers.

### 2.1 Discovery Primitive
```js
swarm.join(topic, { announce: true, lookup: true })
```
- `topic`: hashed identifier for the capability or dataset.
- `announce`: advertise presence.
- `lookup`: find peers already announcing.

### 2.2 Connection Flow
```text
Peer A ──announce──► DHT ◄──lookup── Peer B
     └─ hole punching + Noise handshake ─┘
     └───── encrypted multiplexed channel ─────┘
```
- UDP hole punching first; fallback to relay if needed.
- Noise protocol provides mutual authentication and encryption.

### 2.3 Hyperswarm RPC
Built atop Hyperswarm sockets to enable request/response calls between peers. In this repo the client/server pieces are mocked.

---

## 3. Platform Architecture Overview

| Layer | Responsibility | Key Files |
| --- | --- | --- |
| API Gateway | HTTP entry point, authentication, rate limiting, routes to orchestrator | `wrk-api-gateway/worker.js`, `workers/lib/auth-manager.js`, `workers/lib/orchestrator-client.js` |
| Orchestrator | Registers workers, balances requests, tracks health | `wrk-orchestrator/worker.js`, `workers/lib/service-registry.js`, `workers/lib/load-balancer.js`, `workers/lib/health-monitor.js` |
| AI Inference Worker | Loads models, enforces capacity, executes inference | `wrk-ai-inference/worker.js`, `workers/lib/model-manager.js`, `workers/lib/inference-engine.js` |
| Model Manager | Stores model binaries and metadata via REST | `wrk-model-manager/worker.js`, `workers/lib/model-storage.js`, `workers/lib/model-registry.js` |

### 3.1 Current Request Path
```text
Client HTTP → API Gateway → (mocked) Orchestrator call → simulated AI Worker + Model Manager → Response
```
> **Reality check:** orchestrator client, health checks, and inference results are stubbed. Replace with real RPC/model loading for production.

---

## 4. Service Responsibilities

### 4.1 API Gateway
- Initializes orchestrator client and auth manager during `start()`.
- Exposes `/health`, `POST /api/v1/inference/:modelId`, model catalogue CRUD, and `/api/v1/status`.
- `startRateLimitCleanup()` prunes stale client entries from the in-memory limiter.

### 4.2 Orchestrator
- `/api/workers/register` captures worker metadata and indexes capabilities/models.
- `/api/inference/route` finds eligible workers via load balancer, simulates inference, updates worker stats.
- Background loops: `startServiceDiscovery()` (discover + check) and `startHealthMonitoring()` (active probes).

### 4.3 AI Inference Worker
- Tracks `maxConcurrent` vs `currentLoad`, caches models in-memory.
- `loadModel()` lazily loads mock models; `runInference()` validates, delegates to inference engine, records history.
- HTTP endpoints: `/health`, `POST /api/inference/:modelId`, `/api/capacity`, `/api/models/:modelId/load`.

### 4.4 Model Manager
- REST endpoints: upload (`POST /api/models`), fetch (`GET /api/models/:modelId`), list (`GET /api/models`).
- `ModelStorage` writes binaries to disk with checksum + size validation.
- `ModelRegistry` maintains metadata/indices (type, version) in memory—extend for persistence.

---

## 5. Supporting Libraries & Templates

| Component | Role in Repo |
| --- | --- |
| `wrk-base` | Base worker wiring Hyperswarm facs (store + network), exposing RPC keys, and configuring `pino` logging (`wrk-base/workers/base.wrk.js`). |
| `tpl-wrk-thing` | Template worker supplying CRUD + persistence hooks for generic "things"; `wrk-book` extends it. |
| `wrk-book` | Example worker using the template; demonstrates registering racks with legacy orchestrator (`wrk-ork`). |
| `AuthManager` | In-memory API-key manager; seeds demo keys and authenticates gateway requests. |
| `OrchestratorClient` | Mock orchestrator proxy used by the gateway; replace `simulateInferenceRequest` with real RPC when wiring live services. |
| `LoadBalancer` | Strategy engine (round-robin, least-connections, weighted, random) tracking per-worker stats. |

---

## 6. Shared Packages Reference

| Package | Purpose |
| --- | --- |
| `bfx-svc-boot-js` | Boots workers with layered config, logging, start/stop lifecycle. |
| `bfx-wrk-base` | Canonical Bitfinex worker base providing DI, IPC hooks, lifecycle events, and metrics scaffolding. |
| `hp-svc-facs-net` | Hyperswarm feature set: DHT join/announce, key management, RPC server wiring. |
| `hp-svc-facs-store` | Hypercore/Hyperbee storage helper with replication, retention policies, and stats. |
| `pino` | High-performance JSON logger used across services. |

---

## 7. Interview Talking Points
1. **Request flow** – Gateway → Orchestrator → Worker; note mocked components today.
2. **Scaling story** – Add workers, orchestrator + load balancer distribute load; health monitor can quarantine failures.
3. **Hyperswarm roadmap** – Replace REST with peer-announced RPC once mocks become real.
4. **Model lifecycle** – Upload via Model Manager, workers cache models, orchestrator tracks capabilities.
5. **Extensibility** – New worker extends `tpl-wrk-thing`/`wrk-base`, registers via orchestrator.

---

## 8. Quick Scenario
> Logistics fleet uploads a route-optimization ONNX model to the Model Manager. API Gateway exposes `/api/v1/inference/route-opt`. Requests authenticate, route through the orchestrator to the worker, which runs inference and returns optimized routes. As demand grows, new workers spin up and the orchestrator/load balancer share the traffic automatically.

---

*Keep these notes handy to answer architecture, responsibility, and roadmap questions during interviews.*
