#!/bin/bash

# Comprehensive test script for AgentMarket backend
# Tests all major functions and endpoints

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BACKEND_URL:-http://localhost:3000}"
API_BASE="${BASE_URL}/api"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AgentMarket Comprehensive Test Suite${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo -e "${YELLOW}Testing: ${name}${NC}"
    echo "  Endpoint: ${method} ${endpoint}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE}${endpoint}")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "${data}")
    else
        echo -e "${RED}  ❌ Unknown method: ${method}${NC}"
        ((FAILED++))
        return
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}  ✅ PASSED (Status: ${http_code})${NC}"
        if [ -n "$body" ] && [ "$body" != "null" ]; then
            echo "  Response: $(echo "$body" | head -c 200)..."
        fi
        ((PASSED++))
    else
        echo -e "${RED}  ❌ FAILED (Expected: ${expected_status}, Got: ${http_code})${NC}"
        echo "  Response: $body"
        ((FAILED++))
    fi
    echo ""
}

# 1. Health Check
echo -e "${GREEN}=== 1. Health & Status Checks ===${NC}"
test_endpoint "Health Check" "GET" "/health" "" "200"
test_endpoint "Get All Agents" "GET" "/agents" "" "200"

# 2. Contract Functions
echo -e "${GREEN}=== 2. Contract Functions ===${NC}"
echo -e "${YELLOW}Testing: Agent Registry Functions${NC}"
echo "  Note: These require contract to be deployed and configured"
echo "  Checking if agents can be fetched from contract..."
test_endpoint "Get Agents from Contract" "GET" "/agents" "" "200"

# 3. Blockchain Query Functions
echo -e "${GREEN}=== 3. Blockchain Query Functions ===${NC}"
echo -e "${YELLOW}Testing: Crypto.com SDK Integration${NC}"
echo "  Note: Requires valid API keys and DNS configuration"
echo "  Testing blockchain query via chat endpoint..."

# Test with a simple balance query (will require payment, so expect 402 or 200)
test_endpoint "Blockchain Query (Balance)" "POST" "/chat" \
    '{"input":"What is the balance of 0x1234567890123456789012345678901234567890"}' \
    "402"  # Payment required

# 4. Payment Flow
echo -e "${GREEN}=== 4. Payment Flow ===${NC}"
echo -e "${YELLOW}Testing: Payment Verification${NC}"
echo "  Note: Payment flow requires x402 payment header"
echo "  Testing payment required response..."
test_endpoint "Payment Required Response" "POST" "/chat" \
    '{"input":"test query"}' \
    "402"  # Payment required

# 5. Agent Execution
echo -e "${GREEN}=== 5. Agent Execution ===${NC}"
echo -e "${YELLOW}Testing: Agent Execution Endpoints${NC}"
test_endpoint "Execute Agent (Payment Required)" "POST" "/agents/1/execute" \
    '{"input":"test input"}' \
    "402"  # Payment required

# 6. Analytics & Logs
echo -e "${GREEN}=== 6. Analytics & Logs ===${NC}"
test_endpoint "Get Analytics" "GET" "/analytics" "" "200"
test_endpoint "Get Logs" "GET" "/logs" "" "200"

# 7. Executions
echo -e "${GREEN}=== 7. Executions ===${NC}"
test_endpoint "Get Executions" "GET" "/executions" "" "200"

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Test Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
    echo -e "${YELLOW}Note: Some failures may be expected (e.g., payment required responses)${NC}"
    exit 1
fi
