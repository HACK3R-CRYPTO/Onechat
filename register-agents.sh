#!/bin/bash
# Register default agents on-chain
# Usage: PRIVATE_KEY=0xYOUR_KEY ./register-agents.sh

set -e

if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ Error: PRIVATE_KEY environment variable required"
  echo ""
  echo "Usage:"
  echo "  PRIVATE_KEY=0xYOUR_KEY ./register-agents.sh"
  echo ""
  exit 1
fi

export AGENT_REGISTRY_ADDRESS=0xd3097577Fa07E7CCD6D53C81460C449D96f736cC

echo "🤖 Registering default agents on-chain..."
echo "Contract: $AGENT_REGISTRY_ADDRESS"
echo ""

cd contracts
forge script script/RegisterAgents.s.sol:RegisterAgentsScript \
  --rpc-url https://evm-t3.cronos.org \
  --broadcast \
  -vvv

echo ""
echo "✅ Registration complete!"
echo ""
echo "Verify with:"
echo "  cast call $AGENT_REGISTRY_ADDRESS \"nextAgentId()\" --rpc-url https://evm-t3.cronos.org"
