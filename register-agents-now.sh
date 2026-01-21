#!/bin/bash

# Register default agents on-chain
# This script will register the 4 default agents

set -e

CONTRACT="0xd3097577Fa07E7CCD6D53C81460C449D96f736cC"
RPC="https://evm-t3.cronos.org"

echo "🤖 Register Default Agents On-Chain"
echo "===================================="
echo ""

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ PRIVATE_KEY environment variable not set"
  echo ""
  echo "Please set it first:"
  echo "  export PRIVATE_KEY=your_private_key_here"
  echo ""
  echo "Then run this script again."
  exit 1
fi

echo "📋 Configuration:"
echo "   Contract: $CONTRACT"
echo "   RPC: $RPC"
echo ""

# Check current state
echo "📊 Checking current state..."
NEXT_ID_HEX=$(cast call $CONTRACT "nextAgentId()" --rpc-url $RPC)
NEXT_ID=$(cast --to-dec $NEXT_ID_HEX)
echo "   Current nextAgentId: $NEXT_ID"
echo ""

if [ "$NEXT_ID" -gt "1" ]; then
  echo "⚠️  Warning: Agents already exist!"
  echo "   This will register new agents starting from ID $NEXT_ID"
  echo ""
fi

# Try using Node.js script first (easier)
if [ -f "backend/register-agents.js" ]; then
  echo "🚀 Using Node.js script to register agents..."
  echo ""
  cd backend
  node register-agents.js
  exit $?
fi

# Fallback to forge script
echo "🚀 Using Forge script to register agents..."
echo ""

cd contracts

# Export for forge
export AGENT_REGISTRY_ADDRESS=$CONTRACT

# Run forge script
forge script script/RegisterAgents.s.sol:RegisterAgentsScript \
  --rpc-url $RPC \
  --broadcast \
  -vvv

echo ""
echo "✅ Registration complete!"
echo ""
echo "📊 Verify with:"
echo "   cast call $CONTRACT \"nextAgentId()\" --rpc-url $RPC"
