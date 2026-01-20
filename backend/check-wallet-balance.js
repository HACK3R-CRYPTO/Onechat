/**
 * Check backend wallet balance and contract access
 */

require('dotenv').config();
const { ethers } = require('ethers');

const CRONOS_RPC_URL = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY || process.env.PRIVATE_KEY;
const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || "0x0f764437ffBE1fcd0d0d276a164610422710B482";

async function checkWallet() {
  if (!BACKEND_PRIVATE_KEY) {
    console.error("❌ BACKEND_PRIVATE_KEY not set in .env");
    return;
  }

  const provider = new ethers.JsonRpcProvider(CRONOS_RPC_URL);
  const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);
  const address = wallet.address;

  console.log("🔍 Checking backend wallet...");
  console.log("  Address:", address);
  console.log("  Network:", CRONOS_RPC_URL);

  try {
    const balance = await provider.getBalance(address);
    const balanceInCRO = ethers.formatEther(balance);
    
    console.log("  Balance:", balanceInCRO, "CRO");
    
    if (balance === 0n) {
      console.error("\n❌ WALLET HAS NO BALANCE!");
      console.error("   You need TCRO (testnet CRO) for gas fees.");
      console.error("   Get testnet tokens from: https://cronos.org/faucet");
      console.error("   Send to address:", address);
    } else {
      console.log("  ✅ Wallet has balance for gas");
    }

    // Check contract access
    console.log("\n🔍 Checking contract access...");
    const contract = new ethers.Contract(
      AGENT_REGISTRY_ADDRESS,
      ["function nextAgentId() external view returns (uint256)"],
      provider
    );

    try {
      const nextId = await contract.nextAgentId();
      console.log("  ✅ Can read contract (nextAgentId:", nextId.toString() + ")");
    } catch (error) {
      console.error("  ❌ Cannot read contract:", error.message);
    }

    // Try to estimate gas for a write operation
    console.log("\n🔍 Testing write access...");
    const writeContract = new ethers.Contract(
      AGENT_REGISTRY_ADDRESS,
      ["function getAgent(uint256 agentId) external view returns (tuple(address developer, string name, string description, uint256 pricePerExecution, uint256 totalExecutions, uint256 successfulExecutions, uint256 reputation, bool active))"],
      wallet
    );

    try {
      const agent = await writeContract.getAgent(1);
      console.log("  ✅ Can call contract with signer");
      console.log("  Agent 1 name:", agent.name);
    } catch (error) {
      console.error("  ❌ Cannot call contract with signer:", error.message);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkWallet().catch(console.error);
