Here’s your complete **Markdown document**, professionally formatted and well-structured for presentation or repository README use:

---

# 🧠 Hyperswarm & AI Inference Microservice Architecture

## What is Hyperswarm

Hyperswarm is a **serverless, peer-to-peer networking layer** that replaces the need for traditional servers or WebSocket connections by directly linking peers using **public keys** and **DHT discovery**.

### 🔹 Core Features

* **DHT (Distributed Hash Table):** Used for decentralized peer discovery.
* **NAT Traversal (Hole Punching):** Enables direct peer-to-peer connectivity across firewalls.
* **Secure Encrypted Channels:** Communication between peers is fully encrypted using Noise protocol.

---

## Peer Discovery (HyperDHT)

```js
swarm.join(topic, { announce: true, lookup: true })
```

* **topic:** Unique identifier (hash) representing a shared subject or resource.
* **announce:** “I am available for this topic.”
* **lookup:** “Find peers announcing this topic.”

**Example Workflow**

1. Each peer joins the same topic (e.g., hash of a model or dataset).
2. DHT discovers peers via announcements and lookups.
3. Once discovered, peers connect directly through UDP hole punching.

---

## Connection Layer (TCP/UDP + Noise Protocol)

* Peers first attempt **UDP hole punching** (similar to WebRTC).
* **Noise Protocol** handles encryption and secure handshakes.
* If hole punching fails, peers can **fall back to a relay server (hyperswarm-relay)**.
* Connections are **fully encrypted and multiplexed**, allowing multiple logical channels to share a single physical connection.

---

## Peer Connection Flow

```text
Peer A ------------------- DHT ------------------- Peer B
  │ join(topic, announce)        │        join(topic, lookup)
  │───────────────► Peer Discovery via DHT ◄───────────────│
  │◄───────────── UDP Hole Punching & Handshake ───────────►│
  │◄────────────── Encrypted Noise Channel ───────────────►│
```

### Step-by-Step

1. Both peers share the same **topic hash**.
2. **Peer A:** announces availability.
3. **Peer B:** looks up peers for that topic.
4. **DHT** matches them.
5. **UDP hole punching** creates a direct channel.
6. **Noise protocol** encrypts the connection.
7. **Hyperswarm emits** a `'connection'` event.
8. Application layer starts exchanging data.

---

## Hyperswarm RPC (Remote Procedure Calls)

Hyperswarm RPC builds on top of Hyperswarm networking to allow **function calls between peers** without centralized servers. It powers **decentralized orchestration**, where peers can expose and invoke methods across the mesh securely.

---

## Concept Overview

| Component       | Description                                       |
| --------------- | ------------------------------------------------- |
| **Purpose**     | Decentralized peer discovery and networking layer |
| **Discovery**   | Kademlia DHT via HyperDHT                         |
| **Transport**   | UDP/TCP with NAT traversal                        |
| **Security**    | End-to-end encryption using Noise protocol        |
| **Key Feature** | Topic-based peer grouping                         |
| **Used By**     | Hypercore, Hyperbee, Autobase, Pears, etc.        |
| **Language**    | Node.js (browser compatible via relays)           |

---

# ⚙️ AI Inference Microservice System

## Where is this repository useful?

This repository implements a **lightweight AI inference platform** composed of multiple cooperating microservices:

* **API Gateway**
* **Orchestrator**
* **Inference Workers**
* **Model Manager**

It is ideal for **exposing machine learning models as services** that:

* Accept HTTP calls
* Route requests via RPC
* Balance load across workers
* Manage model storage and metadata

Perfect for **distributed inference orchestration**, **model discovery**, and **operational management** of pretrained models.

---

## What is Inference?

**Inference** is the process of using a trained machine learning model to make predictions on new data.

> 🔍 Training builds the model; inference uses it in production to classify, predict, or analyze new inputs.

---

## Is the Application Centralized or Peer-Based?

Currently, the platform operates in a **centralized microservice architecture**:

* All services (gateway, orchestrator, model manager, inference worker) run as **Node.js processes** on the same host.
* Although **Hyperswarm/DHT** is referenced, the actual implementation **uses centralized RPC mocks**.

---

## Is AI Inference Running on Peer or Server?

AI inference workers are **server-hosted services**.
While the documentation refers to peer discovery via Hyperswarm, the present code functions as a **traditional microservice setup**.

---

## What is an AI Model in this System?

An **AI model** is the deployable artifact of trained intelligence (e.g., ONNX, PyTorch, TensorFlow model).

| Component            | Role                                              |
| -------------------- | ------------------------------------------------- |
| **Model Manager**    | Stores model binaries and metadata                |
| **Inference Worker** | Loads models into memory and performs inference   |
| **Orchestrator**     | Routes requests to available workers              |
| **API Gateway**      | Handles incoming HTTP requests and authentication |

---

# 🧩 Core Class Libraries

### API Server (wrk-api-gateway/workers/lib/api-server.js)

Handles cross-cutting HTTP concerns:

* CORS setup
* Request logging
* Validation
* Error handling

Encapsulates reusable middleware logic for Express applications.

---

### Auth Manager (wrk-api-gateway/workers/lib/auth-manager.js)

Manages API key authentication and permissions:

* Validates `x-api-key` headers
* Creates and revokes API keys
* Tracks usage statistics
* Provides middleware for secured routes

---

### Orchestrator Client (wrk-api-gateway/workers/lib/orchestrator-client.js)

Simulates communication with the orchestrator service:

* Routes inference requests
* Lists and fetches models
* Creates models (mocked with checksum generation)
* Reports system health and service status
* Uses simulated latency and predictions for demo purposes

---

# 🗺️ Real-World Use-Case Diagram

```text
                       ┌───────────────────────────┐
                       │      Mobile / Web App     │
                       │ (Client prompts & input)  │
                       └──────────────┬────────────┘
                                      │  HTTP
                                      ▼
                          ┌────────────────────────────┐
                          │        API Gateway         │
                          │  • Auth / Rate limits      │
                          │  • Validates requests      │
                          │  • Routes to orchestrator  │
                          └──────────────┬─────────────┘
                                         │ RPC / REST
                                         ▼
                           ┌───────────────────────────┐
                           │        Orchestrator       │
                           │  • Finds target model     │
                           │  • Selects healthy worker │
                           │  • Tracks worker health   │
                           └──────────────┬────────────┘
                                          │ RPC / REST
                                          ▼
                ┌──────────────────────────────┐         ┌─────────────────────────────┐
                │   AI Inference Worker (Peer) │◀──RPC──▶│       Model Manager         │
                │  • Loads & runs model        │         │  • Stores binaries & meta   │
                │  • Executes inference        │         │  • Manages versions         │
                └──────────────────────────────┘         └─────────────────────────────┘
                             │
                             │ Result
                             ▼
                       ┌──────────────┐
                       │ API Gateway  │
                       └────┬─────────┘
                            │  HTTP Response
                            ▼
                    ┌───────────────────────┐
                    │    Mobile / Web App   │
                    │   (Displays result)   │
                    └───────────────────────┘
```

---

## Example Scenario

A **logistics company** deploys a **route-optimization model** on one inference peer:

1. Drivers’ mobile apps send daily delivery manifests via the **API Gateway**.
2. The **Orchestrator** forwards the request to the designated worker.
3. The **Worker** runs the optimization model and returns results.
4. The **App** displays optimized routes to drivers.

As traffic increases, they can **add more inference workers** or **enable Hyperswarm peer discovery** for decentralized scaling.

## What is use and reposibility of tpl-wrk-thing in current implementation?


tpl-wrk-thing is the reusable worker template that wrk-book and similar services extend. It layers a full “thing” lifecycle on top of wrk-base, so you get storage, RPC endpoints, and hook points for custom behaviour without rewriting the boilerplate.

Key responsibilities (tpl-wrk-thing/workers/tpl.thing.wrk.js):

- Bootstrapping: In the constructor it demands a rack context, loads additional configuration (base.thing), and anchors storage under store/<rack> while enabling the shared facs (scheduler, interval, Hypercore store).
- “Thing” lifecycle: Provides end-to-end CRUD logic—register, update, list, forget—all backed by the Hyperbee store. It also maintains an in-memory cache (this.mem.things) for quick access.
- Hookable customisation: Exposes override points like getThingType, getThingTags, selectThingInfo, and async hooks (registerThingHook0, updateThingHook0, collectThingSnap, etc.) so subclasses can inject domain-specific behaviour without touching the infrastructure.
- Data persistence & replay: Uses Hyperbee logs (lWrkFunLogs) and the hp-svc-facs-store integration to persist each “thing” and replay them into memory on boot (_setupThings).
- RPC integration: Because it inherits from wrk-base, it automatically exposes RPC endpoints; the template ensures the worker responds to actions like registerThing, updateThing, forgetThing, and so on.

In this repo, wrk-book derives from the template and only overrides a handful of methods (tags, type, availability snapshot, _start wrapper). The template does the heavy lifting: persistence, concurrency control, and RPC wiring, turning “write a new worker” into “override a few hooks and configure it.”

## what is use and responsibility of wrk-base in current implementation?

wrk-base is the shared foundation the legacy workers sit on. It wraps Bitfinex’s generic worker base (bfx-wrk-base) with the networking and storage facs that Tether’s services expect, and exposes a ready-to-run CLI via bfx-svc-boot-js.

Key responsibilities (wrk-base/workers/base.wrk.js):

- load common configuration and point the worker’s data directory to store/<rack> (or a temp dir under tests);
- auto-initialize the Hyperswarm storage (hp-svc-facs-store) and network (hp-svc-facs-net) feature sets so every derived worker has a persistent Hypercore store and an RPC-capable network stack;
- standardize logging with a pino instance named after the worker type and process ID;
- expose getRpcKey()/getRpcClientKey() helpers so other services can discover the RPC public key of the worker;
- start the RPC server (via hp-svc-facs-net) during _start(), register a simple ping handler, and publish the keys to the worker’s status.

Any higher-level worker (for example the template tpl-wrk-thing, and ultimately wrk-book) extends this class to inherit all of that plumbing. You can think of wrk-base as the platform layer: it guarantees common boot behaviour, storage, networking, and logging so feature-specific workers only worry about their domain logic.

## Where work-book is used in current implementation?

wrk-book is included as a demo “thing” worker rather than being wired into the AI inference flow. You’ll find it documented in SETUP.md, where it’s started with node worker.js --wtype wrk-book-rack … and then registered with the wrk-ork orchestrator. Once registered, the orchestrator can call its template endpoints (list/register/update “things”) over RPC. Beyond that setup guide there’s no other runtime integration—no gateway routes or AI services consume it—so it mainly showcases how to build a domain-specific worker on top of the tpl-wrk-thing base.

## where is wrk-model-manager is used?

wrk-model-manager runs as its own microservice (port 8002) providing REST endpoints to upload, fetch, and list AI models (wrk-model-manager/worker.js). Its HTTP interface feeds into the larger architecture—the orchestrator/gateway conceptually rely on it for model metadata and storage—but in this repo the orchestrator client and inference worker still use mock data, so no live calls are made yet. In practice you launch it alongside the other services (see README.md/scripts) and, once the mocks are replaced, the API gateway and orchestrator will leverage it to persist models and broadcast availability to inference workers.

## what is use of load balancerin this implementation?

The orchestrator’s load balancer (wrk-orchestrator/workers/lib/load-balancer.js) decides which AI worker should handle each inference request. It tracks per-worker metrics (requests served, success/failure counts, average processing time, current load) and supports multiple policies—round-robin, least connections, weighted, random. When a request arrives, the orchestrator filters for eligible workers then asks the load balancer to pick one; after completion, it updates the stats. Even though today’s responses are simulated, this component is ready to enforce balanced routing, drain unhealthy workers, and favour the fastest nodes once real inference calls are wired in.

## what is use of wrk-orchestrator in current implementation?

In the current implementation the orchestrator (wrk-orchestrator) is the coordination control plane for inference workers. It exposes REST endpoints to:
- register AI worker instances and track their capabilities (/api/workers/register);
- find a suitable worker for a given model request (/api/workers/find);
- route inference requests, applying the load balancer and logging simulated execution (/api/inference/route);
- expose system health and stats (/api/status, /health).
Behind those endpoints it maintains a service registry (mapping models/capabilities to workers), a load balancer, and a health monitor. Although the orchestration currently returns simulated inference results instead of calling real workers, it’s the surface that the API gateway uses (via orchestrator-client.js) to orchestrate request routing and worker management.

## what is use or responsibility of wrk-ork service in current implementation

wrk-ork is the template “orchestrator” worker from the legacy Bitfinex stack. It’s wired to register domain racks (like wrk-book) and expose a centralized RPC interface so higher-level services can discover and coordinate those workers. In this repo it’s included mainly for compatibility with the tpl-wrk-thing demo: you start wrk-ork, register book racks with it (per SETUP.md), and it acts as the registry/supervisor that fronts RPC access to those racks. It isn’t part of the newer AI inference path; it’s here to show how the legacy orchestration layer manages traditional workers in the ecosystem.

## **bfx-svc-boot-js**

**Bitfinex’s “Service Bootstrapping” Kit**

* Handles the **early lifecycle** of a Node.js microservice:

  * Reads layered configuration files
  * Wires up `pino` logging
  * Applies standard error handling
  * Exposes a consistent `start()` / `stop()` contract

* Provides helper methods so every worker **starts and exits consistently**, keeping monitoring and deployment scripts simple.

* Inherits conventions around:

  * Environment variables
  * Secrets
  * Health probes
  * Configuration layering

**In short:**

> A standardized, reusable way to start and manage Node.js microservices across the Bitfinex ecosystem.

---

## **bfx-wrk-base**

**Core Worker Framework of the Bitfinex Stack**

* Defines the **`wrk` abstraction** — a foundation for all backend workers.

* Provides:

  * Dependency injection container
  * IPC/event bus hooks
  * Async job helpers
  * Service registry integration
  * Lifecycle events (`onReady`, `onStop`, etc.)

* Includes built-in patterns for:

  * Message routing
  * Timeouts and retries
  * Metrics collection

When creating a new worker, you **subclass this base** and only implement service-specific logic — no need to re-implement core behavior.

**In short:**

> The base class that all Bitfinex and Tether workers extend, defining lifecycle, messaging, and runtime behavior.

---

## **hp-svc-facs-net**

**Hyperswarm Service Networking Layer (Tether Team)**

* Provides a standardized **Hyperswarm/DHT communication layer**:

  * Bootstraps a swarm
  * Handles peer discovery and announcements
  * Manages cryptographic keys
  * Reads from `facs/net.config.json`

* Adds **health and telemetry hooks** so orchestrators can track live peer states.

* Allows any worker to adopt **peer-to-peer networking conventions** simply by enabling the feature in config.

**In short:**

> A reusable networking stack for Hyperswarm-based peer discovery and communication.

---

## **hp-svc-facs-store**

**Storage Layer Paired with `hp-svc-facs-net`**

* Wraps **Hypercore** and **Hyperbee** primitives to provide:

  * Data replication and integrity
  * Storage path management
  * Background synchronization tasks
  * Eviction and retention policies
  * Statistics reporting

* Lets services replicate **models or metadata** reliably between peers.

Workers can mount a **consistent read/write store** without manually managing Hypercore APIs.

**In short:**

> A distributed, fault-tolerant storage framework for peer-based services.

---

## **pino**

**Fast and Structured Logging for Node.js**

* **Performance:**
  Writes logs as newline-delimited JSON with minimal overhead — one of the fastest loggers available.

* **JSON Output:**
  Each log entry is a structured JSON object (e.g.

  ```json
  {"level":30,"time":1694288000,"msg":"Starting API Gateway"}
  ```

  ), which makes it easy to parse and index.

* **Structured Fields:**
  Supports context-rich logs:

  ```js
  logger.info({ workerId }, 'registered worker')
  ```

* **Log Levels:**
  Supports `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

* **Child Loggers:**
  Derive scoped loggers with automatic metadata (e.g. per-request context).

* **Transport Pipeline:**
  In modern versions (v7+), logs can stream through a separate process (e.g. to Elasticsearch or Loki) without blocking the main thread.

* **Pretty Print (Dev Mode):**
  Pair with `pino-pretty` for human-readable console output during development.

* **Integrations:**
  Works seamlessly with frameworks like **Fastify** and **Express**, and observability tools like **Grafana Loki**.

**In short:**

> High-performance structured logging with production-ready JSON output and excellent ecosystem support.

---

## **Overall Integration**

Together, these dependencies provide the **plumbing and lifecycle management** for every worker in the Tether/Bitfinex platform:

| Layer                | Responsibility                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| **Boot**             | `bfx-svc-boot-js` handles configuration, startup, and graceful shutdown |
| **Worker Lifecycle** | `bfx-wrk-base` standardizes service logic, events, and metrics          |
| **Networking**       | `hp-svc-facs-net` manages Hyperswarm peer discovery and connections     |
| **Storage**          | `hp-svc-facs-store` provides consistent replication and data storage    |
| **Logging**          | `pino` delivers fast, structured observability                          |

**Result:**

> Developers focus on *business logic* (inference, orchestration, HTTP APIs) while these packages handle startup, communication, and persistence consistently across all services.

---

**End of Document**
