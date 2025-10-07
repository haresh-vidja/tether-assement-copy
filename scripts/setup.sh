#!/bin/bash

# Tether AI Platform Setup Script
# This script sets up the AI inference platform with all required services

set -e

echo "🚀 Setting up Tether AI Inference Platform..."

# Change to project root directory
cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    # Try to find node in common locations
    NODE_PATH=""
    if command -v node &> /dev/null; then
        NODE_PATH=$(which node)
    elif [ -f "/home/$USER/.nvm/versions/node/$(ls /home/$USER/.nvm/versions/node/ | head -1)/bin/node" ]; then
        NODE_PATH="/home/$USER/.nvm/versions/node/$(ls /home/$USER/.nvm/versions/node/ | head -1)/bin/node"
    elif [ -f "/usr/bin/node" ]; then
        NODE_PATH="/usr/bin/node"
    fi
    
    if [ -z "$NODE_PATH" ] || [ ! -x "$NODE_PATH" ]; then
        print_error "Node.js is not installed. Please install Node.js 16+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$($NODE_PATH -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16+ is required. Current version: $($NODE_PATH -v)"
        exit 1
    fi
    
    print_status "Node.js $($NODE_PATH -v) detected at $NODE_PATH"
}

# Check if npm is installed
check_npm() {
    # Try to find npm in common locations
    NPM_PATH=""
    if command -v npm &> /dev/null; then
        NPM_PATH=$(which npm)
    elif [ -f "/home/$USER/.nvm/versions/node/$(ls /home/$USER/.nvm/versions/node/ | head -1)/bin/npm" ]; then
        NPM_PATH="/home/$USER/.nvm/versions/node/$(ls /home/$USER/.nvm/versions/node/ | head -1)/bin/npm"
    elif [ -f "/usr/bin/npm" ]; then
        NPM_PATH="/usr/bin/npm"
    fi
    
    if [ -z "$NPM_PATH" ] || [ ! -x "$NPM_PATH" ]; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    print_status "npm $($NPM_PATH -v) detected at $NPM_PATH"
}

# Install dependencies for a service
install_service_deps() {
    local service=$1
    print_status "Installing dependencies for $service..."
    
    if [ -d "$service" ]; then
        cd "$service"
        if [ -f "package.json" ]; then
            npm install
            print_status "Dependencies installed for $service"
        else
            print_warning "No package.json found in $service"
        fi
        cd ..
    else
        print_warning "Directory $service not found"
    fi
}

# Setup configuration for a service
setup_service_config() {
    local service=$1
    print_status "Setting up configuration for $service..."
    
    if [ -d "$service/config" ]; then
        # Copy example configs if they don't exist
        if [ -f "$service/config/common.json.example" ] && [ ! -f "$service/config/common.json" ]; then
            cp "$service/config/common.json.example" "$service/config/common.json"
            print_status "Created $service/config/common.json"
        fi
        
        # Setup facs configs
        if [ -d "$service/config/facs" ]; then
            for config_file in "$service/config/facs"/*.example; do
                if [ -f "$config_file" ]; then
                    config_name=$(basename "$config_file" .example)
                    if [ ! -f "$service/config/facs/$config_name" ]; then
                        cp "$config_file" "$service/config/facs/$config_name"
                        print_status "Created $service/config/facs/$config_name"
                    fi
                fi
            done
        fi
    else
        print_warning "Config directory not found for $service"
    fi
}

# Create logs directory
create_logs_dir() {
    print_status "Creating logs directory..."
    mkdir -p logs
    print_status "Logs directory created"
}

# Create models directory
create_models_dir() {
    print_status "Creating models directory..."
    mkdir -p models
    print_status "Models directory created"
}

# Create startup script
create_startup_script() {
    print_status "Creating startup script..."
    
    cat > scripts/start-services.sh << 'EOF'
#!/bin/bash

# Tether AI Platform Service Startup Script

echo "🚀 Starting Tether AI Platform Services..."

# Function to start a service
start_service() {
    local service=$1
    local port=$2
    
    echo "Starting $service on port $port..."
    cd "$service"
    npm start &
    echo $! > "../logs/${service}.pid"
    cd ..
    echo "✅ $service started (PID: $(cat logs/${service}.pid))"
}

# Start services in order
start_service "wrk-model-manager" "8002"
sleep 2

start_service "wrk-orchestrator" "8003" 
sleep 2

start_service "wrk-ai-inference" "8001"
sleep 2

start_service "wrk-api-gateway" "3000"

echo ""
echo "🎉 All services started!"
echo ""
echo "Service Status:"
echo "- API Gateway: http://localhost:3000"
echo "- Health Check: http://localhost:3000/health"
echo "- Model Manager: Port 8002"
echo "- Orchestrator: Port 8003" 
echo "- AI Inference Worker: Port 8001"
echo ""
echo "Test the platform:"
echo "curl -H 'X-API-Key: demo-api-key-123' http://localhost:3000/api/v1/models"
echo ""
echo "To stop services: ./scripts/stop-services.sh"
EOF

    chmod +x scripts/start-services.sh
    print_status "Startup script created: scripts/start-services.sh"
}

# Create stop script
create_stop_script() {
    print_status "Creating stop script..."
    
    cat > scripts/stop-services.sh << 'EOF'
#!/bin/bash

# Tether AI Platform Service Stop Script

echo "🛑 Stopping Tether AI Platform Services..."

# Function to stop a service
stop_service() {
    local service=$1
    local pid_file="logs/${service}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping $service (PID: $pid)..."
            kill "$pid"
            rm "$pid_file"
            echo "✅ $service stopped"
        else
            echo "⚠️  $service process not running"
            rm "$pid_file"
        fi
    else
        echo "⚠️  No PID file found for $service"
    fi
}

# Stop services
stop_service "wrk-api-gateway"
stop_service "wrk-ai-inference"
stop_service "wrk-orchestrator"
stop_service "wrk-model-manager"

echo ""
echo "🎉 All services stopped!"
EOF

    chmod +x scripts/stop-services.sh
    print_status "Stop script created: scripts/stop-services.sh"
}

# Create test script
create_test_script() {
    print_status "Creating test script..."
    
    cat > scripts/test-platform.sh << 'EOF'
#!/bin/bash

# Tether AI Platform Test Script

echo "🧪 Testing Tether AI Platform..."

BASE_URL="http://localhost:3000"
API_KEY="demo-api-key-123"

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    echo "Testing $method $endpoint..."
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo "✅ Success ($http_code)"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        echo "❌ Failed ($http_code)"
        echo "$body"
    fi
    echo ""
}

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Test endpoints
test_endpoint "GET" "/health"
test_endpoint "GET" "/api/v1/models"
test_endpoint "GET" "/api/v1/status"

# Test inference (if models are available)
echo "Testing inference endpoint..."
test_endpoint "POST" "/api/v1/inference/image-classifier-v1" '{"inputData": {"image": "test-data"}}'

echo "🎉 Platform testing completed!"
EOF

    chmod +x scripts/test-platform.sh
    print_status "Test script created: scripts/test-platform.sh"
}

# Main setup function
main() {
    print_status "Starting Tether AI Platform setup..."
    
    # Check prerequisites
    check_nodejs
    check_npm
    
    # Create necessary directories
    create_logs_dir
    create_models_dir
    
    # Setup each service
    services="wrk-model-manager wrk-orchestrator wrk-ai-inference wrk-api-gateway"
    
    for service in $services; do
        print_status "Setting up $service..."
        install_service_deps "$service"
        setup_service_config "$service"
    done
    
    # Create utility scripts
    create_startup_script
    create_stop_script
    create_test_script
    
    print_status "Setup completed successfully!"
    echo ""
    echo "🎉 Tether AI Platform is ready!"
    echo ""
    echo "Next steps:"
    echo "1. Start services: ./scripts/start-services.sh"
    echo "2. Test platform: ./scripts/test-platform.sh"
    echo "3. Stop services: ./scripts/stop-services.sh"
    echo ""
    echo "API Gateway will be available at: http://localhost:3000"
    echo "Health check: http://localhost:3000/health"
    echo ""
    echo "Default API Keys:"
    echo "- demo-api-key-123 (Demo Client)"
    echo "- admin-key-456 (Admin Client)"
    echo ""
}

# Run main function
main "$@"
