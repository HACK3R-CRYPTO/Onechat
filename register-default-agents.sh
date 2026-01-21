#!/bin/bash

# Register the 4 default agents on-chain
# This will make them part of the contract, not just hardcoded in the API

set -e

echo "🤖 Registering Default Agents On-Chain"
echo "========================================"
echo ""

# Check if we're in the contracts directory
if [ ! -f "foundry.toml" ]; then
  echo "❌ Error: Must run from contracts directory"
  echo "Usage: cd contracts && ../register-default-agents.sh"
  exit 1
fi

# Check for required environment variables
if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ Error: PRIVATE_KEY environment variable not set"
  echo "Set it with: export PRIVATE_KEY=your_private_key_here"
  exit 1
fi

if [ -z "$AGENT_REGISTRY_ADDRESS" ]; then
  echo "⚠️  Warning: AGENT_REGISTRY_ADDRESS not set, using default:"
  AGENT_REGISTRY_ADDRESS="0xd3097577Fa07E7CCD6D53C81460C449D96f736cC"
  echo "   $AGENT_REGISTRY_ADDRESS"
  echo ""
fi

echo "📋 Configuration:"
echo "   Contract: $AGENT_REGISTRY_ADDRESS"
echo "   Network: Cronos Testnet"
echo ""

# Check current state
echo "📊 Checking current state..."
NEXT_ID=$(cast call $AGENT_REGISTRY_ADDRESS "nextAgentId()" --rpc-url https://evm-t3.cronos.org)
NEXT_ID_DEC=$(cast --to-dec $NEXT_ID)
echo "   Current nextAgentId: $NEXT_ID_DEC"
echo ""

if [ "$NEXT_ID_DEC" -gt "1" ]; then
  echo "⚠️  Warning: Agents already exist on-chain!"
  echo "   This will register new agents starting from ID $NEXT_ID_DEC"
  echo "   Press Ctrl+C to cancel, or Enter to continue..."
  read
fi

echo "🚀 Registering agents..."
echo ""

# Run the forge script
forge script script/RegisterAgents.s.sol:RegisterAgentsScript \
  --rpc-url https://evm-t3.cronos.org \
  --broadcast \
  --verify \
  -vvv

echo ""
echo "✅ Done! Default agents should now be registered on-chain."
echo ""
echo "📊 Verify with:"
echo "   cast call $AGENT_REGISTRY_ADDRESS \"nextAgentId()\" --rpc-url https://evm-t3.cronos.org"
echo "   node ../backend/check-agents-onchain.js"
