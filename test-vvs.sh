#!/bin/bash

# VVS Finance Test Script
# Tests VVS Finance swap endpoints

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing VVS Finance Integration"
echo "===================================="
echo ""

# Test 1: Get Quote - CRO to USDC
echo "${YELLOW}Test 1: Get Quote (CRO to USDC)${NC}"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/vvs-swap/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "CRO",
    "tokenOut": "USDC",
    "amountIn": "1.0"
  }')

if echo "$RESPONSE" | grep -q "amountOut"; then
  echo "${GREEN}✅ Quote successful${NC}"
  echo "$RESPONSE" | jq '.'
else
  echo "${RED}❌ Quote failed${NC}"
  echo "$RESPONSE"
fi
echo ""

# Test 2: Get Quote - USDC to CRO
echo "${YELLOW}Test 2: Get Quote (USDC to CRO)${NC}"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/vvs-swap/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "USDC",
    "tokenOut": "CRO",
    "amountIn": "10.0"
  }')

if echo "$RESPONSE" | grep -q "amountOut"; then
  echo "${GREEN}✅ Quote successful${NC}"
  echo "$RESPONSE" | jq '.'
else
  echo "${RED}❌ Quote failed${NC}"
  echo "$RESPONSE"
fi
echo ""

# Test 3: Get Quote - CRO to VVS
echo "${YELLOW}Test 3: Get Quote (CRO to VVS)${NC}"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/vvs-swap/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "CRO",
    "tokenOut": "VVS",
    "amountIn": "1.0"
  }')

if echo "$RESPONSE" | grep -q "amountOut"; then
  echo "${GREEN}✅ Quote successful${NC}"
  echo "$RESPONSE" | jq '.'
else
  echo "${RED}❌ Quote failed${NC}"
  echo "$RESPONSE"
fi
echo ""

# Test 4: Invalid token pair
echo "${YELLOW}Test 4: Invalid Token Pair${NC}"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/vvs-swap/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "INVALID",
    "tokenOut": "USDC",
    "amountIn": "1.0"
  }')

if echo "$RESPONSE" | grep -q "error\|Failed"; then
  echo "${GREEN}✅ Error handling works${NC}"
  echo "$RESPONSE" | jq '.'
else
  echo "${YELLOW}⚠️  Unexpected response${NC}"
  echo "$RESPONSE"
fi
echo ""

# Test 5: Missing parameters
echo "${YELLOW}Test 5: Missing Parameters${NC}"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/vvs-swap/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "CRO"
  }')

if echo "$RESPONSE" | grep -q "Missing required"; then
  echo "${GREEN}✅ Validation works${NC}"
  echo "$RESPONSE" | jq '.'
else
  echo "${YELLOW}⚠️  Unexpected response${NC}"
  echo "$RESPONSE"
fi
echo ""

# Test 6: Execute endpoint (without payment - should fail)
echo "${YELLOW}Test 6: Execute Without Payment (Should Fail)${NC}"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/vvs-swap/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "CRO",
    "tokenOut": "USDC",
    "amountIn": "1.0",
    "recipient": "0x1234567890123456789012345678901234567890"
  }')

if echo "$RESPONSE" | grep -q "Payment\|402"; then
  echo "${GREEN}✅ Payment requirement enforced${NC}"
  echo "$RESPONSE" | jq '.'
else
  echo "${YELLOW}⚠️  Unexpected response${NC}"
  echo "$RESPONSE"
fi
echo ""

echo "===================================="
echo "✅ Basic tests complete!"
echo ""
echo "To test execute endpoint with payment:"
echo "1. Create x402 payment for \$0.15"
echo "2. Use X-PAYMENT header in request"
echo "3. See VVS_FINANCE_TEST_GUIDE.md for details"
echo ""
