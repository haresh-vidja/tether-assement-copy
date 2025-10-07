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
