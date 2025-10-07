# Tether AI Platform - Code Structure Analysis

## Project Overview
The Tether AI Platform is a microservice-based architecture implementing an AI inference platform as a service, communicating over Hyperswarm RPC.

## Directory Structure

```
tether/
├── .gitignore                    # Comprehensive ignore patterns
├── README.md                     # Main project documentation
├── SYSTEM_DESIGN.md              # System architecture documentation
├── IMPLEMENTATION_SUMMARY.md     # Implementation details
├── SETUP.md                      # Setup instructions
├── task.md                       # Original requirements
├── scripts/                       # Shell scripts directory
│   ├── setup.sh                  # Automated setup script
│   ├── start-services.sh         # Service startup script
│   ├── stop-services.sh          # Service shutdown script
│   └── test-platform.sh          # Platform testing script
├── logs/                         # Runtime logs and PID files
├── models/                       # AI model storage directory
├── app-node/                     # Legacy Node.js application
├── tpl-wrk-thing/               # Template worker implementation
└── wrk-*/                       # Microservice workers
```

## Microservice Architecture

### Core Services

#### 1. API Gateway (`wrk-api-gateway/`)
- **Purpose**: Entry point for external HTTP requests
- **Port**: 3000
- **Responsibilities**:
  - HTTP to RPC conversion
  - Authentication and rate limiting
  - Request routing to orchestrator
- **Key Files**:
  - `worker.js` - Main service entry point
  - `workers/api.gateway.wrk.js` - API gateway implementation
  - `workers/lib/api-server.js` - HTTP server logic
  - `workers/lib/auth-manager.js` - Authentication handling
  - `workers/lib/orchestrator-client.js` - RPC client for orchestrator

#### 2. Orchestrator (`wrk-orchestrator/`)
- **Purpose**: Central coordination and load balancing
- **Port**: 8003
- **Responsibilities**:
  - Service discovery and registration
  - Load balancing across AI workers
  - Health monitoring and failover
- **Key Files**:
  - `worker.js` - Main service entry point
  - `workers/orchestrator.wrk.js` - Orchestrator implementation
  - `workers/lib/service-registry.js` - Service discovery
  - `workers/lib/load-balancer.js` - Load balancing logic
  - `workers/lib/health-monitor.js` - Health checking

#### 3. AI Inference Worker (`wrk-ai-inference/`)
- **Purpose**: Execute AI model inference locally
- **Port**: 8001
- **Responsibilities**:
  - Model loading and caching
  - Inference execution
  - Capacity reporting
- **Key Files**:
  - `worker.js` - Main service entry point
  - `workers/ai.inference.wrk.js` - Inference worker implementation
  - `workers/lib/inference-engine.js` - Inference logic
  - `workers/lib/model-manager.js` - Model management

#### 4. Model Manager (`wrk-model-manager/`)
- **Purpose**: AI model storage and distribution
- **Port**: 8002
- **Responsibilities**:
  - Model storage and versioning
  - Model replication across workers
  - Metadata management
- **Key Files**:
  - `worker.js` - Main service entry point
  - `workers/model.manager.wrk.js` - Model manager implementation
  - `workers/lib/model-storage.js` - Storage logic
  - `workers/lib/model-registry.js` - Model registry

### Legacy Components

#### App Node (`app-node/`)
- **Purpose**: Legacy Node.js application
- **Structure**: Traditional Express.js application
- **Files**:
  - `worker.js` - Main application entry
  - `workers/http.node.wrk.js` - HTTP worker
  - `workers/lib/server.js` - Server implementation
  - `workers/lib/auth.js` - Authentication
  - `workers/lib/schema/` - Database schemas

#### Template Workers
- **`tpl-wrk-thing/`**: Template worker implementation
- **`wrk-base/`**: Base worker class
- **`wrk-book/`**: Book management worker
- **`wrk-ork/`**: Orchestration template

## Configuration Structure

### Service Configuration Pattern
Each service follows a consistent configuration structure:

```
wrk-service-name/
├── config/
│   ├── common.json              # Main configuration
│   ├── common.json.example      # Configuration template
│   └── facs/                    # Feature-specific configs
│       ├── net.config.json      # Network configuration
│       └── *.config.json.example
├── workers/
│   ├── service.wrk.js          # Main worker implementation
│   └── lib/                     # Worker libraries
│       ├── *.js                # Service-specific modules
└── package.json                 # Dependencies and scripts
```

### Configuration Files
- **`common.json`**: Main service configuration (ignored by git)
- **`common.json.example`**: Template configuration (tracked by git)
- **`facs/net.config.json`**: Network-specific settings
- **`package.json`**: Node.js dependencies and scripts

## Data Storage Strategy

### Model Storage (`models/`)
- **Purpose**: AI model files and metadata
- **Structure**:
  - `*.bin`, `*.onnx`, `*.pt` - Model files (ignored)
  - `*.json`, `*.txt`, `*.md` - Metadata (tracked)

### Runtime Data
- **`logs/`**: Service logs and PID files (ignored)
- **`data/`**: Service-specific runtime data (ignored)
- **`temp/`**: Temporary files (ignored)

## Communication Architecture

### Inter-Service Communication
- **Protocol**: Hyperswarm RPC
- **Discovery**: Hyperswarm DHT
- **Load Balancing**: Round-robin with health checks
- **Failover**: Automatic service failover

### Request Flow
```
Client → API Gateway → Orchestrator → AI Worker → Model Manager
```

## Development Workflow

### Setup Process
1. **Dependencies**: `npm install` in each service directory
2. **Configuration**: Copy `.example` files to actual configs
3. **Directories**: Create required data and log directories
4. **Services**: Start services in dependency order
5. **Testing**: Verify all endpoints and functionality

### Scripts
- **`scripts/setup.sh`**: Automated setup and dependency installation
- **`scripts/start-services.sh`**: Start all services with proper ordering
- **`scripts/stop-services.sh`**: Graceful shutdown of all services
- **`scripts/test-platform.sh`**: Comprehensive platform testing

## Security Considerations

### Authentication
- **API Keys**: Required for external API access
- **RPC Authentication**: Cryptographic keys for inter-service communication
- **Model Access Control**: Permission-based model access

### Data Privacy
- **Encrypted Communication**: All RPC calls encrypted via Hyperswarm
- **Data Isolation**: Separate model instances per client when required
- **Audit Logging**: Track all inference requests and model access

## Monitoring and Observability

### Health Monitoring
- **Service Health**: Each service exposes `/health` endpoint
- **Resource Utilization**: CPU, memory, and model performance tracking
- **Service Availability**: Uptime and response time monitoring

### Logging Strategy
- **Structured Logging**: Pino logger for all services
- **Request/Response Logging**: Track all API calls
- **Error Tracking**: Comprehensive error logging and alerting

## Scalability Features

### Horizontal Scaling
- **AI Workers**: Add more workers to handle increased load
- **Orchestrators**: Multiple orchestrator instances for redundancy
- **Model Replication**: Distribute models across multiple workers

### Fault Tolerance
- **Service Failover**: Automatic routing to healthy workers
- **Data Replication**: Models stored redundantly across workers
- **Graceful Degradation**: Continue operation with reduced capacity

## Technology Stack

- **Runtime**: Node.js 16+
- **RPC Framework**: Hyperswarm RPC
- **Data Storage**: Hypercore, Hyperbee
- **Networking**: Hyperswarm DHT
- **AI Models**: PyTorch, ONNX Runtime
- **Logging**: Pino
- **Configuration**: JSON-based config files
- **Process Management**: PID files and process monitoring
