/**
 * Helper script to find VVS Router on Cronos Testnet
 * 
 * This script attempts to find the VVS Router contract by:
 * 1. Checking known VVS contracts
 * 2. Testing if they have router functions
 * 3. Identifying the correct router address
 */

const { ethers } = require("ethers");

const TESTNET_RPC = "https://evm-t3.cronos.org";
const MAINNET_ROUTER = "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae";

// VVS Router ABI (minimal - just to check if contract exists)
const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] path) external view returns (uint[] memory amounts)",
];

// Known VVS contracts on testnet (from your search results)
const KNOWN_VVS_CONTRACTS = [
  "0xda732210809bf932e79cf07966771c0f5d009fee", // VVS Finance LPs
  "0x71f67b48b4c7bfde2415a1cea48a06518ffa8fcc", // VVS-LP
  "0x6aadf95de81f91f095d803144dd784952df2133a", // xVVS
  "0xc0c2e7eab6d39d1471b259a9ce379f29cbdf5c47", // VVS Finance LPs
  "0x33196778e45ba37c21834df43acc7d9dda626933", // VVS Finance LPs
  "0xbc31a16ad26ea2251d2a821d97048ad718a4f11e", // VVSToken
  // Add more addresses from testnet.cronoscan.com search
];

async function checkIfRouter(address) {
  try {
    const provider = new ethers.JsonRpcProvider(TESTNET_RPC);
    const contract = new ethers.Contract(address, ROUTER_ABI, provider);
    
    // Try to call getAmountsOut with a simple path
    // Use CRO (native) to USDC path
    const croAddress = "0x0000000000000000000000000000000000000000";
    const usdcAddress = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";
    const path = [croAddress, usdcAddress];
    const amountIn = ethers.parseUnits("1", 18);
    
    const amounts = await contract.getAmountsOut(amountIn, path);
    
    console.log(`✅ ${address} - IS A ROUTER!`);
    console.log(`   Quote: 1 CRO = ${ethers.formatUnits(amounts[1], 18)} USDC`);
    return true;
  } catch (error) {
    // Not a router or doesn't have the function
    return false;
  }
}

async function findRouter() {
  console.log("🔍 Searching for VVS Router on Cronos Testnet...\n");
  console.log(`RPC: ${TESTNET_RPC}`);
  console.log(`Mainnet Router (for reference): ${MAINNET_ROUTER}\n`);
  
  console.log("Checking known VVS contracts...\n");
  
  for (const address of KNOWN_VVS_CONTRACTS) {
    process.stdout.write(`Checking ${address}... `);
    const isRouter = await checkIfRouter(address);
    if (!isRouter) {
      console.log("❌ Not a router");
    }
  }
  
  console.log("\n💡 If no router found:");
  console.log("1. Visit https://testnet.cronoscan.com");
  console.log("2. Search for 'VVS Router' or 'VVS Finance Router'");
  console.log("3. Click through contracts to find one with getAmountsOut function");
  console.log("4. Add the address to backend/.env as VVS_ROUTER_ADDRESS_TESTNET");
}

findRouter().catch(console.error);
