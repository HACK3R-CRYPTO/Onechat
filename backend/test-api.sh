#!/bin/bash

# OneChat API Test Script
# Tests all API endpoints using curl

API_URL="http://localhost:3001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing AgentMarket API"
echo "=========================="
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Check..."
response=$(curl -s -w "\n%{http_code}" "$API_URL/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "Response: $body"
else
    echo -e "${RED}❌ Health check failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 2: Get All Agents
echo "2️⃣  Testing GET /api/agents..."
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/agents")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✅ Get agents passed${NC}"
    agent_count=$(echo "$body" | grep -o '"id"' | wc -l)
    echo "Found $agent_count agents"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Get agents failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 3: Get Specific Agent
echo "3️⃣  Testing GET /api/agents/1..."
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/agents/1")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✅ Get agent 1 passed${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Get agent 1 failed (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 4: Execute Agent (without payment - should return 402)
echo "4️⃣  Testing POST /api/agents/1/execute (without payment)..."
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/agents/1/execute" \
  -H "Content-Type: application/json" \
  -d '{"input": "Test input"}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 402 ]; then
    echo -e "${GREEN}✅ Payment required (expected)${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo -e "${YELLOW}⚠️  Unexpected response (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

# Test 5: Execute Agent (with invalid payment - should return 402)
echo "5️⃣  Testing POST /api/agents/1/execute (with invalid payment)..."
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/agents/1/execute" \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT-SIGNATURE: invalid-signature" \
  -d '{"input": "Test input", "paymentHash": "0x123"}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 402 ]; then
    echo -e "${GREEN}✅ Invalid payment rejected (expected)${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo -e "${YELLOW}⚠️  Unexpected response (HTTP $http_code)${NC}"
    echo "Response: $body"
fi
echo ""

echo "=========================="
echo -e "${GREEN}✅ API Testing Complete${NC}"
echo ""
echo "💡 To test with real payment, use the frontend at http://localhost:3000"
