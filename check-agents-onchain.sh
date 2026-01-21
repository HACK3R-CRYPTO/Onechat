#!/bin/bash

# Check agents on-chain using cast
# Usage: ./check-agents-onchain.sh

CONTRACT_ADDRESS="0xd3097577Fa07E7CCD6D53C81460C449D96f736cC"
RPC_URL="${CRONOS_RPC_URL:-https://evm-t3.cronos.org}"

echo "🔍 Checking AgentRegistry contract on-chain"
echo "Contract: $CONTRACT_ADDRESS"
echo "RPC: $RPC_URL"
echo ""

# Check nextAgentId (how many agents are registered)
echo "📊 Checking nextAgentId..."
NEXT_AGENT_ID=$(cast call $CONTRACT_ADDRESS "nextAgentId()" --rpc-url $RPC_URL)
NEXT_AGENT_ID_DEC=$(cast --to-dec $NEXT_AGENT_ID)
echo "nextAgentId: $NEXT_AGENT_ID ($NEXT_AGENT_ID_DEC)"
echo ""

# Check each agent
if [ "$NEXT_AGENT_ID_DEC" -gt "0" ]; then
  echo "📋 Checking agents 1 to $NEXT_AGENT_ID_DEC..."
  echo ""
  
  for i in $(seq 1 $NEXT_AGENT_ID_DEC); do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Agent ID: $i"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Call getAgent function
    RESULT=$(cast call $CONTRACT_ADDRESS "getAgent(uint256)" $i --rpc-url $RPC_URL 2>&1)
    
    if echo "$RESULT" | grep -q "Error"; then
      echo "❌ Error: $RESULT"
    else
      # Parse the tuple result
      # getAgent returns: (address developer, string name, string description, uint256 pricePerExecution, uint256 totalExecutions, uint256 successfulExecutions, uint256 reputation, bool active)
      echo "Raw result:"
      echo "$RESULT"
      echo ""
      
      # Try to decode the tuple
      echo "Decoded (attempt):"
      # Note: Cast doesn't easily decode tuples, so we'll show the raw data
      # The result is a tuple, so we need to parse it manually
      echo "$RESULT" | head -20
    fi
    echo ""
  done
else
  echo "⚠️  No agents registered yet (nextAgentId is 0 or 1)"
fi

echo ""
echo "✅ Done!"
