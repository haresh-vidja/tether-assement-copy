# Tether AI Platform - Setup and Testing Guide

This guide provides comprehensive instructions for setting up and testing the Tether AI Inference Platform.

##   Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Setup](#quick-setup)
- [Manual Setup](#manual-setup)
- [Testing the Platform](#testing-the-platform)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Architecture Overview](#architecture-overview)

##   Prerequisites

### System Requirements
- **Node.js**: Version 16 or higher
- **npm**: Version 7 or higher
- **Operating System**: Linux, macOS, or Windows
- **Memory**: Minimum 2GB RAM
- **Storage**: At least 1GB free space

### Check Prerequisites
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check if ports are available
netstat -tulpn | grep -E ':(3000|8001|8002|8003)'
```

##   Quick Setup

### Manual Setup Steps

**Step 1: Navigate to Project Directory**
```bash
cd /path/to/tether-ai-platform
```

**Step 2: Install Dependencies for Each Service**
```bash
# Install API Gateway dependencies
cd wrk-api-gateway
npm install
cd ..

# Install Model Manager dependencies
cd wrk-model-manager
npm install
cd ..

# Install Orchestrator dependencies
cd wrk-orchestrator
npm install
cd ..

# Install AI Inference Worker dependencies
cd wrk-ai-inference
npm install
cd ..
```

**Step 3: Create Required Directories**
```bash
# Create main logs directory
mkdir -p logs

# Create models storage directory
mkdir -p wrk-model-manager/models

# Create data directories for each service
mkdir -p wrk-api-gateway/data
mkdir -p wrk-orchestrator/data
mkdir -p wrk-ai-inference/data
```

**Step 4: Start Services Manually**
```bash
# Terminal 1 - Start API Gateway
cd wrk-api-gateway
npm start &
echo $! > ../logs/wrk-api-gateway.pid
cd ..

# Terminal 2 - Start Model Manager
cd wrk-model-manager
npm start &
echo $! > ../logs/wrk-model-manager.pid
cd ..

# Terminal 3 - Start Orchestrator
cd wrk-orchestrator
npm start &
echo $! > ../logs/wrk-orchestrator.pid
cd ..

# Terminal 4 - Start AI Inference Worker
cd wrk-ai-inference
npm start &
echo $! > ../logs/wrk-ai-inference.pid
cd ..
```

**Step 5: Test the Platform**
```bash
# Wait for services to initialize
sleep 10

# Test API Gateway
curl http://localhost:3000/health

# Test Model Manager
curl http://localhost:8002/health

# Test Orchestrator
curl http://localhost:8003/health

# Test AI Inference Worker
curl http://localhost:8001/health
```

**Step 6: Stop Services When Done**
```bash
# Stop all services
kill $(cat logs/wrk-api-gateway.pid) 2>/dev/null || true
kill $(cat logs/wrk-model-manager.pid) 2>/dev/null || true
kill $(cat logs/wrk-orchestrator.pid) 2>/dev/null || true
kill $(cat logs/wrk-ai-inference.pid) 2>/dev/null || true

# Clean up PID files
rm -f logs/*.pid
```

##   Detailed Manual Setup

### Step 1: Verify Prerequisites
```bash
# Check Node.js version (should be 16+)
node --version

# Check npm version (should be 7+)
npm --version

# Check if required ports are available
netstat -tulpn | grep -E ':(3000|8001|8002|8003)'

# If ports are in use, kill existing processes
sudo kill -9 $(lsof -ti:3000) 2>/dev/null || true
sudo kill -9 $(lsof -ti:8001) 2>/dev/null || true
sudo kill -9 $(lsof -ti:8002) 2>/dev/null || true
sudo kill -9 $(lsof -ti:8003) 2>/dev/null || true
```

### Step 2: Install Dependencies

#### Install Dependencies for Each Service
```bash
# Navigate to project root
cd /path/to/tether-ai-platform

# Install API Gateway dependencies
echo "Installing API Gateway dependencies..."
cd wrk-api-gateway
npm install
if [ $? -eq 0 ]; then
    echo "  API Gateway dependencies installed successfully"
else
    echo "  Failed to install API Gateway dependencies"
    exit 1
fi
cd ..

# Install Model Manager dependencies
echo "Installing Model Manager dependencies..."
cd wrk-model-manager
npm install
if [ $? -eq 0 ]; then
    echo "  Model Manager dependencies installed successfully"
else
    echo "  Failed to install Model Manager dependencies"
    exit 1
fi
cd ..

# Install Orchestrator dependencies
echo "Installing Orchestrator dependencies..."
cd wrk-orchestrator
npm install
if [ $? -eq 0 ]; then
    echo "  Orchestrator dependencies installed successfully"
else
    echo "  Failed to install Orchestrator dependencies"
    exit 1
fi
cd ..

# Install AI Inference Worker dependencies
echo "Installing AI Inference Worker dependencies..."
cd wrk-ai-inference
npm install
if [ $? -eq 0 ]; then
    echo "  AI Inference Worker dependencies installed successfully"
else
    echo "  Failed to install AI Inference Worker dependencies"
    exit 1
fi
cd ..

echo "  All dependencies installed successfully!"
```

### Step 3: Create Required Directories
```bash
# Create main logs directory
echo "Creating logs directory..."
mkdir -p logs
if [ $? -eq 0 ]; then
    echo "  Logs directory created"
else
    echo "  Failed to create logs directory"
    exit 1
fi

# Create models storage directory
echo "Creating models storage directory..."
mkdir -p wrk-model-manager/models
if [ $? -eq 0 ]; then
    echo "  Models storage directory created"
else
    echo "  Failed to create models storage directory"
    exit 1
fi

# Create data directories for each service
echo "Creating service data directories..."
mkdir -p wrk-api-gateway/data
mkdir -p wrk-orchestrator/data
mkdir -p wrk-ai-inference/data
if [ $? -eq 0 ]; then
    echo "  Service data directories created"
else
    echo "  Failed to create service data directories"
    exit 1
fi

echo "  All directories created successfully!"
```

### Step 4: Verify Installation
```bash
# Check if all package.json files exist
echo "Verifying package.json files..."
if [ -f "wrk-api-gateway/package.json" ] && [ -f "wrk-model-manager/package.json" ] && [ -f "wrk-orchestrator/package.json" ] && [ -f "wrk-ai-inference/package.json" ]; then
    echo "  All package.json files found"
else
    echo "  Missing package.json files"
    exit 1
fi

# Check if all node_modules directories exist
echo "Verifying node_modules directories..."
if [ -d "wrk-api-gateway/node_modules" ] && [ -d "wrk-model-manager/node_modules" ] && [ -d "wrk-orchestrator/node_modules" ] && [ -d "wrk-ai-inference/node_modules" ]; then
    echo "  All node_modules directories found"
else
    echo "  Missing node_modules directories - run npm install again"
    exit 1
fi

# Check if all worker.js files exist
echo "Verifying worker.js files..."
if [ -f "wrk-api-gateway/worker.js" ] && [ -f "wrk-model-manager/worker.js" ] && [ -f "wrk-orchestrator/worker.js" ] && [ -f "wrk-ai-inference/worker.js" ]; then
    echo "  All worker.js files found"
else
    echo "  Missing worker.js files"
    exit 1
fi

echo "  Installation verification completed successfully!"
```

### Step 5: Configure Services (Optional)

The services come with default configurations, but you can customize them if needed:

#### API Gateway Configuration
```bash
# Create config directory if it doesn't exist
mkdir -p wrk-api-gateway/config

# Create API Gateway config
cat > wrk-api-gateway/config/common.json << EOF
{
  "port": 3000,
  "orchestratorUrl": "http://localhost:8003",
  "apiKeys": {
    "demo-api-key-123": {
      "name": "Demo API Key",
      "permissions": ["read", "write"],
      "rateLimit": 1000
    }
  },
  "cors": {
    "origin": "*",
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "headers": ["Content-Type", "Authorization", "X-API-Key"]
  }
}
EOF
echo "  API Gateway configuration created"
```

#### Model Manager Configuration
```bash
# Create config directory if it doesn't exist
mkdir -p wrk-model-manager/config

# Create Model Manager config
cat > wrk-model-manager/config/common.json << EOF
{
  "port": 8002,
  "storagePath": "./models",
  "maxModels": 100,
  "supportedFormats": ["onnx", "pytorch", "tensorflow"]
}
EOF
echo "  Model Manager configuration created"
```

#### Orchestrator Configuration
```bash
# Create config directory if it doesn't exist
mkdir -p wrk-orchestrator/config

# Create Orchestrator config
cat > wrk-orchestrator/config/common.json << EOF
{
  "port": 8003,
  "loadBalancingStrategy": "round-robin",
  "healthCheckInterval": 30000,
  "maxWorkers": 10
}
EOF
echo "  Orchestrator configuration created"
```

#### AI Inference Worker Configuration
```bash
# Create config directory if it doesn't exist
mkdir -p wrk-ai-inference/config

# Create AI Inference Worker config
cat > wrk-ai-inference/config/common.json << EOF
{
  "port": 8001,
  "maxConcurrentInferences": 10,
  "modelCacheSize": 5,
  "inferenceTimeout": 30000
}
EOF
echo "  AI Inference Worker configuration created"
```

### Step 6: Start Services

#### Start All Services Manually
```bash
# Start API Gateway (Terminal 1)
echo "Starting API Gateway..."
cd wrk-api-gateway
npm start &
API_PID=$!
echo $API_PID > ../logs/wrk-api-gateway.pid
cd ..
echo "  API Gateway started with PID: $API_PID"

# Start Model Manager (Terminal 2)
echo "Starting Model Manager..."
cd wrk-model-manager
npm start &
MODEL_PID=$!
echo $MODEL_PID > ../logs/wrk-model-manager.pid
cd ..
echo "  Model Manager started with PID: $MODEL_PID"

# Start Orchestrator (Terminal 3)
echo "Starting Orchestrator..."
cd wrk-orchestrator
npm start &
ORCH_PID=$!
echo $ORCH_PID > ../logs/wrk-orchestrator.pid
cd ..
echo "  Orchestrator started with PID: $ORCH_PID"

# Start AI Inference Worker (Terminal 4)
echo "Starting AI Inference Worker..."
cd wrk-ai-inference
npm start &
AI_PID=$!
echo $AI_PID > ../logs/wrk-ai-inference.pid
cd ..
echo "  AI Inference Worker started with PID: $AI_PID"

# Wait for services to initialize
echo "Waiting for services to initialize..."
sleep 10

# Verify services are running
echo "Verifying services are running..."
ps aux | grep node | grep -v grep
if [ $? -eq 0 ]; then
    echo "  Services are running"
else
    echo "  Services failed to start"
    exit 1
fi
```

### Step 7: Verify Setup

#### Test Service Health
```bash
# Test API Gateway
echo "Testing API Gateway health..."
curl -s http://localhost:3000/health > /dev/null
if [ $? -eq 0 ]; then
    echo "  API Gateway is healthy"
else
    echo "  API Gateway is not responding"
fi

# Test Model Manager
echo "Testing Model Manager health..."
curl -s http://localhost:8002/health > /dev/null
if [ $? -eq 0 ]; then
    echo "  Model Manager is healthy"
else
    echo "  Model Manager is not responding"
fi

# Test Orchestrator
echo "Testing Orchestrator health..."
curl -s http://localhost:8003/health > /dev/null
if [ $? -eq 0 ]; then
    echo "  Orchestrator is healthy"
else
    echo "  Orchestrator is not responding"
fi

# Test AI Inference Worker
echo "Testing AI Inference Worker health..."
curl -s http://localhost:8001/health > /dev/null
if [ $? -eq 0 ]; then
    echo "  AI Inference Worker is healthy"
else
    echo "  AI Inference Worker is not responding"
fi

echo "  Setup verification completed!"
```

### Step 8: Setup Complete!

After completing all the above steps, you should have:

  **All dependencies installed** for all 4 services  
  **Required directories created** (logs, models, data)  
  **Configuration files** created (optional)  
  **All services running** and healthy  
  **Platform ready** for testing  

**Next Steps:**
- Test each service individually using the manual testing steps below
- Verify all endpoints are working correctly
- When done, stop services manually using the stop commands

##   Testing the Platform

### Manual Testing Process

#### Step 1: Start Services Manually
```bash
# Start API Gateway
cd wrk-api-gateway
npm start &
echo $! > ../logs/wrk-api-gateway.pid
cd ..

# Start Model Manager
cd wrk-model-manager
npm start &
echo $! > ../logs/wrk-model-manager.pid
cd ..

# Start Orchestrator
cd wrk-orchestrator
npm start &
echo $! > ../logs/wrk-orchestrator.pid
cd ..

# Start AI Inference Worker
cd wrk-ai-inference
npm start &
echo $! > ../logs/wrk-ai-inference.pid
cd ..

# Wait for services to initialize
sleep 10

# Verify services are running
ps aux | grep node
```

#### Step 2: Test Service Health
```bash
# Test API Gateway
curl http://localhost:3000/health

# Test Model Manager
curl http://localhost:8002/health

# Test Orchestrator
curl http://localhost:8003/health

# Test AI Inference Worker
curl http://localhost:8001/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "uptime": 10.5,
  "version": "1.0.0"
}
```

#### Step 3: Test API Gateway Endpoints

##### List Available Models
```bash
curl -H "X-API-Key: demo-api-key-123" \
     http://localhost:3000/api/v1/models
```

**Expected Response:**
```json
{
  "success": true,
  "models": [
    {
      "modelId": "image-classifier-v1",
      "type": "onnx",
      "version": "1.0.0",
      "description": "Image classification model",
      "createdAt": 1759723960464
    },
    {
      "modelId": "text-sentiment-v1",
      "type": "pytorch",
      "version": "1.0.0",
      "description": "Text sentiment analysis model",
      "createdAt": 1759637560464
    }
  ],
  "count": 2,
  "timestamp": 1759810360464
}
```

##### Check Platform Status
```bash
curl -H "X-API-Key: demo-api-key-123" \
     http://localhost:3000/api/v1/status
```

##### Run AI Inference
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-api-key-123" \
  -d '{"inputData": {"image": "test-image-data"}}' \
  http://localhost:3000/api/v1/inference/image-classifier-v1
```

**Expected Response:**
```json
{
  "success": true,
  "modelId": "image-classifier-v1",
  "result": {
    "predictions": [0.28, 0.20, 0.88, 0.11, ...],
    "confidence": 0.84,
    "processingTime": 1490,
    "modelId": "image-classifier-v1"
  },
  "workerId": "worker-1",
  "timestamp": 1759810363322
}
```

#### Step 4: Test Individual Services

##### Test Model Manager Directly
```bash
# List models
curl http://localhost:8002/api/models

# Get specific model info
curl http://localhost:8002/api/models/image-classifier-v1

# Upload a new model (example)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"modelId": "test-model", "type": "onnx", "version": "1.0.0"}' \
  http://localhost:8002/api/models
```

##### Test Orchestrator Directly
```bash
# Check orchestrator status
curl http://localhost:8003/api/status

# List registered workers
curl http://localhost:8003/api/workers

# Get load balancing info
curl http://localhost:8003/api/load-balancer
```

##### Test AI Inference Worker Directly
```bash
# Check worker capacity
curl http://localhost:8001/api/capacity

# Run inference directly
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"inputData": {"image": "test-data"}}' \
  http://localhost:8001/api/inference/image-classifier-v1
```

#### Step 5: Test Error Scenarios

##### Test Authentication
```bash
# Missing API key (should return 401)
curl http://localhost:3000/api/v1/models

# Wrong API key (should return 401)
curl -H "X-API-Key: wrong-key" \
     http://localhost:3000/api/v1/models
```

##### Test Invalid Requests
```bash
# Non-existent model (should return 404)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-api-key-123" \
  -d '{"inputData": {"image": "test"}}' \
  http://localhost:3000/api/v1/inference/non-existent-model

# Malformed request (should return 400)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-api-key-123" \
  -d '{"invalid": "data"}' \
  http://localhost:3000/api/v1/inference/image-classifier-v1
```

##   API Reference

### Authentication
All API requests require an API key in the header:
```
X-API-Key: demo-api-key-123
```

### Endpoints

#### API Gateway (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/models` | List available models |
| GET | `/api/v1/status` | Platform status |
| POST | `/api/v1/inference/{modelId}` | Run inference |

#### Model Manager (Port 8002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/models` | List models |
| GET | `/api/models/{modelId}` | Get model info |
| POST | `/api/models` | Upload model |

#### Orchestrator (Port 8003)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/status` | Service status |
| GET | `/api/workers` | List workers |
| GET | `/api/load-balancer` | Load balancer info |

#### AI Inference Worker (Port 8001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/capacity` | Worker capacity |
| POST | `/api/inference/{modelId}` | Run inference |

##   Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check if ports are in use
lsof -i :3000
lsof -i :8001
lsof -i :8002
lsof -i :8003

# Kill processes using ports
sudo kill -9 $(lsof -ti:3000)
sudo kill -9 $(lsof -ti:8001)
sudo kill -9 $(lsof -ti:8002)
sudo kill -9 $(lsof -ti:8003)
```

#### Missing Dependencies
```bash
# Reinstall dependencies
cd wrk-api-gateway && npm install
cd ../wrk-model-manager && npm install
cd ../wrk-orchestrator && npm install
cd ../wrk-ai-inference && npm install
```

#### Permission Issues
```bash
# Check if you have permission to create directories
ls -la

# If needed, change ownership of project directory
sudo chown -R $USER:$USER /path/to/tether-ai-platform
```

#### Service Not Responding
```bash
# Check service logs
tail -f logs/wrk-api-gateway.log
tail -f logs/wrk-model-manager.log
tail -f logs/wrk-orchestrator.log
tail -f logs/wrk-ai-inference.log

# Restart specific service
cd wrk-api-gateway
npm start
```

### Debug Mode

#### Enable Debug Logging
```bash
# Set debug environment variable
export DEBUG=true

# Start services manually with debug logging
cd wrk-api-gateway && DEBUG=true npm start &
cd ../wrk-model-manager && DEBUG=true npm start &
cd ../wrk-orchestrator && DEBUG=true npm start &
cd ../wrk-ai-inference && DEBUG=true npm start &
```

#### Check Service Status
```bash
# Check if services are running
ps aux | grep node

# Check port usage
netstat -tulpn | grep -E ':(3000|8001|8002|8003)'

# Check service health
curl -s http://localhost:3000/health | jq
curl -s http://localhost:8001/health | jq
curl -s http://localhost:8002/health | jq
curl -s http://localhost:8003/health | jq
```

##   Architecture Overview

### Service Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│   Orchestrator  │────│  AI Inference   │
│   (Port 3000)   │    │   (Port 8003)   │    │   (Port 8001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Model Manager   │
                    │ (Port 8002)    │
                    └─────────────────┘
```

### Data Flow
1. **Client** sends request to **API Gateway**
2. **API Gateway** authenticates and routes to **Orchestrator**
3. **Orchestrator** selects available **AI Inference Worker**
4. **AI Inference Worker** loads model from **Model Manager**
5. **AI Inference Worker** processes inference and returns result
6. **API Gateway** returns response to **Client**

### Key Features
- **Microservice Architecture**: Independent, scalable services
- **Service Discovery**: Dynamic worker registration and health monitoring
- **Load Balancing**: Multiple strategies (round-robin, least-connections)
- **Fault Tolerance**: Health checks and failover mechanisms
- **Authentication**: API key-based security
- **Model Management**: Storage, versioning, and validation
- **Real-time Monitoring**: Service status and performance metrics

##   Additional Resources

- [System Design Document](./SYSTEM_DESIGN.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Main README](./README.md)
- [Task Requirements](./task.md)

##   Support

If you encounter issues not covered in this guide:

1. Check the troubleshooting section above
2. Review service logs in the `logs/` directory
3. Verify all prerequisites are met
4. Ensure all dependencies are installed correctly
5. Check that all required ports are available

For additional help, refer to the comprehensive documentation in the project root directory.