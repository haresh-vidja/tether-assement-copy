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
