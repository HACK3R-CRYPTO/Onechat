#!/bin/bash

# Check agents on-chain using cast
# Usage: ./check-agents-cast.sh

CONTRACT="0xd3097577Fa07E7CCD6D53C81460C449D96f736cC"
RPC="https://evm-t3.cronos.org"

echo "🔍 Checking AgentRegistry contract on-chain"
echo "Contract: $CONTRACT"
echo "RPC: $RPC"
echo ""

# Check nextAgentId
echo "📊 Checking nextAgentId..."
NEXT_ID_HEX=$(cast call $CONTRACT "nextAgentId()" --rpc-url $RPC)
NEXT_ID=$(cast --to-dec $NEXT_ID_HEX)
echo "nextAgentId: $NEXT_ID_HEX (decimal: $NEXT_ID)"
echo ""

# Check each agent
if [ "$NEXT_ID" -gt "0" ]; then
  echo "📋 Checking agents 1 to $((NEXT_ID - 1))..."
  echo ""
  
  for i in $(seq 1 $((NEXT_ID - 1))); do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Agent ID: $i"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Get raw result
    RESULT=$(cast call $CONTRACT "getAgent(uint256)" $i --rpc-url $RPC)
    
    # Decode the tuple - the structure is:
    # (address developer, string name, string description, uint256 pricePerExecution, 
    #  uint256 totalExecutions, uint256 successfulExecutions, uint256 reputation, bool active)
    
    # Extract developer (first 32 bytes after offset)
    DEVELOPER_OFFSET=$(echo $RESULT | cut -c 3-66)
    DEVELOPER="0x$(echo $RESULT | cut -c 67-106)"
    
    # Check if developer is zero address
    if [ "$DEVELOPER" = "0x0000000000000000000000000000000000000000" ]; then
      echo "⚠️  Agent $i does NOT exist (zero address)"
      echo ""
      continue
    fi
    
    echo "✅ Agent $i EXISTS"
    echo "Developer: $DEVELOPER"
    
    # Extract name offset and length
    NAME_OFFSET_HEX=$(echo $RESULT | cut -c 107-170)
    NAME_OFFSET=$(cast --to-dec "0x$NAME_OFFSET_HEX")
    
    # Extract description offset
    DESC_OFFSET_HEX=$(echo $RESULT | cut -c 171-234)
    DESC_OFFSET=$(cast --to-dec "0x$DESC_OFFSET_HEX")
    
    # Extract price (4th element, after 3 offsets)
    PRICE_HEX=$(echo $RESULT | cut -c 235-298)
    PRICE=$(cast --to-dec "0x$PRICE_HEX")
    PRICE_USDC=$(echo "scale=6; $PRICE / 1000000" | bc)
    
    # Extract executions
    TOTAL_EXEC_HEX=$(echo $RESULT | cut -c 299-362)
    TOTAL_EXEC=$(cast --to-dec "0x$TOTAL_EXEC_HEX")
    
    SUCCESS_EXEC_HEX=$(echo $RESULT | cut -c 363-426)
    SUCCESS_EXEC=$(cast --to-dec "0x$SUCCESS_EXEC_HEX")
    
    # Extract reputation
    REP_HEX=$(echo $RESULT | cut -c 427-490)
    REP=$(cast --to-dec "0x$REP_HEX")
    
    # Extract active (last byte)
    ACTIVE_HEX=$(echo $RESULT | cut -c 491-554)
    ACTIVE=$(cast --to-dec "0x$ACTIVE_HEX")
    
    echo "Price: $PRICE_USDC USDC ($PRICE in 6 decimals)"
    echo "Total executions: $TOTAL_EXEC"
    echo "Successful executions: $SUCCESS_EXEC"
    echo "Reputation: $REP"
    echo "Active: $([ "$ACTIVE" = "1" ] && echo "true" || echo "false")"
    echo ""
    
    # For name and description, we'd need to decode the string from the data section
    # This is complex with just bash, so let's use the Node.js script for full decoding
    echo "💡 For full name/description decoding, run: node backend/check-agents-onchain.js"
    echo ""
  done
else
  echo "⚠️  No agents registered yet"
fi

echo "✅ Done!"
