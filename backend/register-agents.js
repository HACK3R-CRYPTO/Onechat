#!/usr/bin/env node

/**
 * Register the 4 default agents on-chain
 * This makes them part of the contract, not just hardcoded in the API
 */

const { ethers } = require("ethers");

const CONTRACT_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || "0xd3097577Fa07E7CCD6D53C81460C449D96f736cC";
const RPC_URL = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("❌ Error: PRIVATE_KEY environment variable required");
  console.error("Set it with: export PRIVATE_KEY=your_private_key_here");
  process.exit(1);
}

// ABI for registerAgent function
const ABI = [
  "function registerAgent(string memory name, string memory description, uint256 pricePerExecution) external returns (uint256 agentId)",
  "function nextAgentId() external view returns (uint256)",
  "function getAgent(uint256 agentId) external view returns (tuple(address developer, string name, string description, uint256 pricePerExecution, uint256 totalExecutions, uint256 successfulExecutions, uint256 reputation, bool active))"
];

// Default agents to register
const DEFAULT_AGENTS = [
  {
    name: "Smart Contract Analyzer",
    description: "Analyzes Solidity contracts for vulnerabilities and security issues",
    price: 100000, // 0.10 USDC (6 decimals)
  },
  {
    name: "Market Data Agent",
    description: "Fetches and analyzes Crypto.com market data and price trends",
    price: 50000, // 0.05 USDC (6 decimals)
  },
  {
    name: "Content Generator",
    description: "Creates marketing content for Web3 projects",
    price: 20000, // 0.02 USDC (6 decimals)
  },
  {
    name: "Portfolio Analyzer",
    description: "Analyzes DeFi portfolios and suggests optimization strategies",
    price: 150000, // 0.15 USDC (6 decimals)
  },
];

async function registerAgents() {
  console.log("🤖 Registering Default Agents On-Chain");
  console.log("========================================");
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log("");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  // Check current state
  console.log("📊 Checking current state...");
  const nextAgentId = await contract.nextAgentId();
  const nextAgentIdNum = Number(nextAgentId);
  console.log(`Current nextAgentId: ${nextAgentIdNum}`);
  console.log("");

  if (nextAgentIdNum > 1) {
    console.log("⚠️  Warning: Agents already exist on-chain!");
    console.log(`   This will register new agents starting from ID ${nextAgentIdNum}`);
    console.log("   Press Ctrl+C to cancel, or wait 5 seconds to continue...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log("🚀 Registering agents...");
  console.log("");

  for (let i = 0; i < DEFAULT_AGENTS.length; i++) {
    const agent = DEFAULT_AGENTS[i];
    const expectedId = nextAgentIdNum + i;

    try {
      console.log(`Registering Agent ${i + 1}/${DEFAULT_AGENTS.length}: ${agent.name}`);
      console.log(`   Expected ID: ${expectedId}`);
      
      const tx = await contract.registerAgent(
        agent.name,
        agent.description,
        agent.price
      );
      
      console.log(`   Transaction: ${tx.hash}`);
      console.log("   Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
      
      // Verify the agent was registered
      const registeredAgent = await contract.getAgent(expectedId);
      if (registeredAgent.developer === wallet.address) {
        console.log(`   ✅ Verified: Agent ${expectedId} registered successfully`);
      } else {
        console.log(`   ⚠️  Warning: Agent ${expectedId} developer mismatch`);
      }
      console.log("");
    } catch (error) {
      console.error(`   ❌ Error registering agent ${i + 1}:`, error.message);
      if (error.reason) {
        console.error(`   Reason: ${error.reason}`);
      }
      console.log("");
    }
  }

  // Final check
  console.log("📊 Final state:");
  const finalNextId = await contract.nextAgentId();
  console.log(`   nextAgentId: ${Number(finalNextId)}`);
  console.log("");

  console.log("✅ Done! Default agents registered on-chain.");
  console.log("");
  console.log("📋 Verify with:");
  console.log(`   cast call ${CONTRACT_ADDRESS} "nextAgentId()" --rpc-url ${RPC_URL}`);
  console.log(`   node check-agents-onchain.js`);
}

registerAgents().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
