Here’s your content rewritten in clean, professional **Markdown** format (no emojis):

## Overview

**Wrk-API-Gateway** fronts the platform as an **HTTP façade**, wiring default configuration for:

* Port
* Authentication
* Rate limits

During boot, it constructs:

* **Orchestrator** and **Auth** clients
* An **in-memory rate limiter**

**References:**

* [`wrk-api-gateway/worker.js:12`](worker.js#L12)
* [`wrk-api-gateway/config/common.json:2`](config/common.json#L2)

Startup initializes all dependencies, launches the **Express server**, and begins periodic cleanup of throttling state to keep the gateway responsive over time.
**References:**

* [`wrk-api-gateway/worker.js:26`](worker.js#L26)
* [`wrk-api-gateway/worker.js:74`](worker.js#L74)
* [`wrk-api-gateway/worker.js:146`](worker.js#L146)

---

## Request Flow

Each incoming request follows the below sequence:

1. **Logging** — All requests are logged for traceability.
2. **Rate Limiting** — Optional, applied per client IP.
3. **Authentication** — Verified via API key.
4. **Forwarding** — Authorized requests are forwarded to the **Orchestrator Client**.

The gateway exposes endpoints for:

* Inference
* Model CRUD operations
* System status
* Health checks

**References:**

* [`wrk-api-gateway/worker.js:43`](worker.js#L43)
* [`wrk-api-gateway/worker.js:83`](worker.js#L83)
* [`wrk-api-gateway/worker.js:94`](worker.js#L94)
* [`wrk-api-gateway/worker.js:127`](worker.js#L127)

Authentication is handled via in-memory API keys, configurable for trusted environments.
**References:**

* [`wrk-api-gateway/workers/lib/auth-manager.js:9`](workers/lib/auth-manager.js#L9)
* [`wrk-api-gateway/workers/lib/auth-manager.js:24`](workers/lib/auth-manager.js#L24)
* [`wrk-api-gateway/config/common.json:9`](config/common.json#L9)

---

## Service Abstractions

### 1. OrchestratorClient

Acts as the **bridge into the orchestration layer**, providing helper functions for:

* Inference routing
* Model enumeration and lookup
* Model registration
* Service status retrieval

Currently mocked but ready to swap for real RPC integration.
**References:**

* [`wrk-api-gateway/workers/lib/orchestrator-client.js:7`](workers/lib/orchestrator-client.js#L7)
* [`wrk-api-gateway/workers/lib/orchestrator-client.js:31`](workers/lib/orchestrator-client.js#L31)
* [`wrk-api-gateway/workers/lib/orchestrator-client.js:72`](workers/lib/orchestrator-client.js#L72)
* [`wrk-api-gateway/workers/lib/orchestrator-client.js:113`](workers/lib/orchestrator-client.js#L113)

---

### 2. AuthManager

Centralizes authentication logic by handling:

* API key issuance
* Revocation
* Permission checks
* “Last used” metadata tracking for observability

**References:**

* [`wrk-api-gateway/workers/lib/auth-manager.js:24`](workers/lib/auth-manager.js#L24)
* [`wrk-api-gateway/workers/lib/auth-manager.js:53`](workers/lib/auth-manager.js#L53)
* [`wrk-api-gateway/workers/lib/auth-manager.js:92`](workers/lib/auth-manager.js#L92)

---

### 3. ApiServer

Prepares reusable HTTP middleware layers for:

* CORS
* Request logging
* Input validation
* Error handling

Ensures both the worker and standalone modes inherit consistent HTTP behavior.
**References:**

* [`wrk-api-gateway/workers/lib/api-server.js:7`](workers/lib/api-server.js#L7)
* [`wrk-api-gateway/workers/lib/api-server.js:36`](workers/lib/api-server.js#L36)
* [`wrk-api-gateway/workers/lib/api-server.js:54`](workers/lib/api-server.js#L54)

---

## Worker Mode

The **rack-integrated worker version**:

* Boots via **WrkBase**
* Mounts routes on `httpd_h0`
* Shares the same authentication, rate-limiting, and orchestrator integration logic as the standalone service

**References:**

* [`wrk-api-gateway/workers/api.gateway.wrk.js:21`](workers/api.gateway.wrk.js#L21)
* [`wrk-api-gateway/workers/api.gateway.wrk.js:68`](workers/api.gateway.wrk.js#L68)
* [`wrk-api-gateway/workers/api.gateway.wrk.js:108`](workers/api.gateway.wrk.js#L108)

Background cleanup, request caching placeholders, and **CORS preflight handling** mirror the standalone implementation to ensure deployment parity.
**References:**

* [`wrk-api-gateway/workers/api.gateway.wrk.js:30`](workers/api.gateway.wrk.js#L30)
* [`wrk-api-gateway/workers/api.gateway.wrk.js:225`](workers/api.gateway.wrk.js#L225)
* [`wrk-api-gateway/workers/api.gateway.wrk.js:287`](workers/api.gateway.wrk.js#L287)
