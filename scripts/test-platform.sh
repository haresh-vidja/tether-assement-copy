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
