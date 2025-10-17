# Wrk-Model-Manager Overview

## What It Does

* Runs as a **rack-aware worker** that owns the AI model catalog, handling:

  * Binary storage
  * Metadata
  * Replication hints
  * Validation hooks
  * **References:**

    * `wrk-model-manager/workers/model.manager.wrk.js:21`
    * `wrk-model-manager/workers/model.manager.wrk.js:40`

* Can also boot as a **standalone HTTP microservice** with REST endpoints for:

  * Health checks
  * Upload
  * Fetch
  * Model listing
  * Useful for lightweight environments or manual operations
  * **References:**

    * `wrk-model-manager/worker.js:24`
    * `wrk-model-manager/worker.js:51`
    * `wrk-model-manager/worker.js:86`

---

## Core Components

### 1. ModelStorage

* Persists raw model blobs on disk
* Enforces size limits
* Maintains checksums for integrity verification

**References:**

* `wrk-model-manager/workers/lib/model-storage.js:17`
* `wrk-model-manager/workers/lib/model-storage.js:45`
* `wrk-model-manager/workers/lib/model-storage.js:124`
* `wrk-model-manager/workers/lib/model-storage.js:156`

---

### 2. ModelRegistry

* Acts as the metadata index and “brain” of the system
* Indexes models by:

  * ID
  * Version
  * Type
* Supports:

  * Updates
  * Search
  * Aggregated statistics for observability

**References:**

* `wrk-model-manager/workers/lib/model-registry.js:13`
* `wrk-model-manager/workers/lib/model-registry.js:35`
* `wrk-model-manager/workers/lib/model-registry.js:73`
* `wrk-model-manager/workers/lib/model-registry.js:101`
* `wrk-model-manager/workers/lib/model-registry.js:187`
* `wrk-model-manager/workers/lib/model-registry.js:224`

---

### 3. Configuration

* Centralized in `config/common.json`
* Controls:

  * Ports
  * Storage paths
  * Size ceilings
  * Validation toggles
* Enables per-rack or environment-based tunability

**Reference:**

* `wrk-model-manager/config/common.json:2`

---

## Worker Responsibilities

* Exposes **rack RPC handlers** for integration with other services (e.g., orchestrator, inference workers):

  * Register new builds
  * Fetch binaries
  * Request metadata
  * Trigger housekeeping (delete, checksum validation)

**References:**
* `wrk-model-manager/workers/model.manager.wrk.js:55`
* `wrk-model-manager/workers/model.manager.wrk.js:82`
* `wrk-model-manager/workers/model.manager.wrk.js:144`
* `wrk-model-manager/workers/model.manager.wrk.js:201`
* `wrk-model-manager/workers/model.manager.wrk.js:242`
* `wrk-model-manager/workers/model.manager.wrk.js:269`
* `wrk-model-manager/workers/model.manager.wrk.js:292`
* `wrk-model-manager/workers/model.manager.wrk.js:333`
* Maintains a small **in-memory cache** of recently stored models to:

  * Avoid repeated lookups
  * Track intended replication peers
  * Prepare for a future multi-node synchronization layer

**References:**

* `wrk-model-manager/workers/model.manager.wrk.js:27`
* `wrk-model-manager/workers/model.manager.wrk.js:117`
* `wrk-model-manager/workers/model.manager.wrk.js:292`

---

## Lifecycle and Operations

### Startup Sequence

* Initializes **storage** and **registry backends** before accepting traffic
* Ensures early failures are caught during boot

**References:**

* `wrk-model-manager/workers/model.manager.wrk.js:48`
* `wrk-model-manager/workers/model.manager.wrk.js:66`

---

### Validation Endpoint

* Recomputes checksums and compares with recorded metadata
* Guards against silent disk corruption when `checksumValidation` is enabled

**References:**

* `wrk-model-manager/workers/model.manager.wrk.js:333`
* `wrk-model-manager/workers/lib/model-storage.js:124`
* `wrk-model-manager/config/common.json:10`

---

### Storage Statistics

* `getStorageStats` aggregates:

  * Disk usage
  * Metadata counts
  * Cache keys
* Provides operators with a complete snapshot of catalog capacity and structure

**Reference:**

* `wrk-model-manager/workers/model.manager.wrk.js:364`