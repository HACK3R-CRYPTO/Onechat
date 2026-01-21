#!/usr/bin/env node

/**
 * Check agents on-chain using ethers.js
 * This provides better tuple decoding than cast
 */

const { ethers } = require("ethers");

const CONTRACT_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || "0xd3097577Fa07E7CCD6D53C81460C449D96f736cC";
const RPC_URL = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";

// Minimal ABI for what we need
const ABI = [
  "function nextAgentId() external view returns (uint256)",
  "function getAgent(uint256 agentId) external view returns (tuple(address developer, string name, string description, uint256 pricePerExecution, uint256 totalExecutions, uint256 successfulExecutions, uint256 reputation, bool active))"
];

async function checkAgents() {
  console.log("🔍 Checking AgentRegistry contract on-chain");
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log("");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  try {
    // Check nextAgentId
    console.log("📊 Checking nextAgentId...");
    const nextAgentId = await contract.nextAgentId();
    const nextAgentIdNum = Number(nextAgentId);
    console.log(`nextAgentId: ${nextAgentId} (${nextAgentIdNum})`);
    console.log("");

    if (nextAgentIdNum === 0) {
      console.log("⚠️  No agents registered yet (nextAgentId is 0)");
      return;
    }

    // Check each agent
    console.log(`📋 Checking agents 1 to ${nextAgentIdNum - 1}...`);
    console.log("");

    for (let i = 1; i < nextAgentIdNum; i++) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`Agent ID: ${i}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      try {
        const agent = await contract.getAgent(i);
        
        console.log("Developer:", agent.developer);
        console.log("Name:", agent.name);
        console.log("Description:", agent.description);
        console.log("Price per execution:", ethers.formatUnits(agent.pricePerExecution, 6), "USDC");
        console.log("Total executions:", agent.totalExecutions.toString());
        console.log("Successful executions:", agent.successfulExecutions.toString());
        console.log("Reputation:", agent.reputation.toString());
        console.log("Active:", agent.active);
        console.log("");
        
        // Check if agent exists (developer is not zero address)
        if (agent.developer === "0x0000000000000000000000000000000000000000") {
          console.log("⚠️  Agent slot exists but is empty (zero address)");
        }
      } catch (error) {
        console.error(`❌ Error fetching agent ${i}:`, error.message);
      }
      console.log("");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }

  console.log("✅ Done!");
}

checkAgents();
