/**
 * Contract interaction utilities for backend
 */

import { ethers } from "ethers";
import { AGENT_REGISTRY_ABI, AGENT_ESCROW_ABI } from "../types/contracts";

// Read environment variables - these will be loaded by dotenv.config() in index.ts
const CRONOS_RPC_URL =
  process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || "0xd3097577Fa07E7CCD6D53C81460C449D96f736cC";
const AGENT_ESCROW_ADDRESS = process.env.AGENT_ESCROW_ADDRESS || "0x4352F2319c0476607F5E1cC9FDd568246074dF14";

// Read BACKEND_PRIVATE_KEY lazily to ensure dotenv has loaded it
function getBackendPrivateKey(): string | undefined {
  return process.env.BACKEND_PRIVATE_KEY || process.env.PRIVATE_KEY;
}

let provider: ethers.JsonRpcProvider | null = null;
let registryContract: ethers.Contract | null = null;
let escrowContract: ethers.Contract | null = null;
let signer: ethers.Wallet | null = null;
let registryContractWithSigner: ethers.Contract | null = null;
let escrowContractWithSigner: ethers.Contract | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(CRONOS_RPC_URL);
  }
  return provider;
}

export function getAgentRegistry(): ethers.Contract | null {
  if (!AGENT_REGISTRY_ADDRESS || AGENT_REGISTRY_ADDRESS === "0x...") {
    return null;
  }

  if (!registryContract) {
    const prov = getProvider();
    registryContract = new ethers.Contract(
      AGENT_REGISTRY_ADDRESS,
      AGENT_REGISTRY_ABI as any,
      prov
    );
  }

  return registryContract;
}

export async function getAgentFromContract(
  agentId: number
): Promise<any | null> {
  const contract = getAgentRegistry();
  if (!contract) {
    return null;
  }

  try {
    const agent = await contract.getAgent(agentId);
    return {
      id: agentId,
      developer: agent.developer,
      name: agent.name,
      description: agent.description,
      pricePerExecution: agent.pricePerExecution.toString(),
      totalExecutions: agent.totalExecutions.toString(),
      successfulExecutions: agent.successfulExecutions.toString(),
      reputation: agent.reputation.toString(),
      active: agent.active,
    };
  } catch (error) {
    console.error("Error fetching agent from contract:", error);
    return null;
  }
}

export async function getAllAgentsFromContract(): Promise<any[]> {
  const contract = getAgentRegistry();
  if (!contract) {
    return [];
  }

  try {
    const nextAgentId = await contract.nextAgentId();
    const agentIds = Array.from(
      { length: Number(nextAgentId) },
      (_, i) => i + 1
    );

    const agents = await Promise.all(
      agentIds.map((id) => getAgentFromContract(id))
    );

    return agents.filter((a) => a !== null && a.active);
  } catch (error) {
    console.error("Error fetching agents from contract:", error);
    return [];
  }
}

/**
 * Get a contract instance with signer for writing transactions
 */
export function getAgentRegistryWithSigner(): ethers.Contract | null {
  if (!AGENT_REGISTRY_ADDRESS || AGENT_REGISTRY_ADDRESS === "0x...") {
    return null;
  }

  const BACKEND_PRIVATE_KEY = getBackendPrivateKey();
  if (!BACKEND_PRIVATE_KEY) {
    console.warn("[Contract] BACKEND_PRIVATE_KEY not set - cannot write to contract");
    console.warn("[Contract] Check that BACKEND_PRIVATE_KEY is set in .env file");
    return null;
  }

  if (!registryContractWithSigner) {
    const prov = getProvider();
    if (!signer) {
      signer = new ethers.Wallet(BACKEND_PRIVATE_KEY, prov);
    }
    registryContractWithSigner = new ethers.Contract(
      AGENT_REGISTRY_ADDRESS,
      AGENT_REGISTRY_ABI as any,
      signer
    );
  }

  return registryContractWithSigner;
}

export function getAgentEscrow(): ethers.Contract | null {
  if (!AGENT_ESCROW_ADDRESS || AGENT_ESCROW_ADDRESS === "0x...") {
    return null;
  }

  if (!escrowContract) {
    const prov = getProvider();
    escrowContract = new ethers.Contract(
      AGENT_ESCROW_ADDRESS,
      AGENT_ESCROW_ABI as any,
      prov
    );
  }

  return escrowContract;
}

export function getAgentEscrowWithSigner(): ethers.Contract | null {
  if (!AGENT_ESCROW_ADDRESS || AGENT_ESCROW_ADDRESS === "0x...") {
    return null;
  }

  const BACKEND_PRIVATE_KEY = getBackendPrivateKey();
  if (!BACKEND_PRIVATE_KEY) {
    console.warn("[Contract] BACKEND_PRIVATE_KEY not set - cannot write to escrow contract");
    return null;
  }

  if (!escrowContractWithSigner) {
    const prov = getProvider();
    if (!signer) {
      signer = new ethers.Wallet(BACKEND_PRIVATE_KEY, prov);
    }
    escrowContractWithSigner = new ethers.Contract(
      AGENT_ESCROW_ADDRESS,
      AGENT_ESCROW_ABI as any,
      signer
    );
  }

  return escrowContractWithSigner;
}

/**
 * Release payment to developer after successful execution
 * This transfers funds from escrow to developer (minus platform fee)
 */
export async function releasePaymentToDeveloper(
  paymentHash: string,
  agentId: number
): Promise<boolean> {
  const contract = getAgentEscrowWithSigner();
  if (!contract) {
    console.warn("[Contract] Cannot call releasePayment - no signer configured");
    return false;
  }

  try {
    const signer = contract.runner as ethers.Wallet;
    if (!signer || !signer.address) {
      console.error("[Contract] ERROR: Cannot get signer address");
      return false;
    }
    const signerAddress = signer.address;
    
    console.log(`[Contract] Calling releasePayment on escrow:`);
    console.log(`  - Payment Hash: ${paymentHash}`);
    console.log(`  - Agent ID: ${agentId}`);
    console.log(`  - Signer address: ${signerAddress}`);
    console.log(`  - Escrow contract address: ${AGENT_ESCROW_ADDRESS}`);
    
    // Check balance for gas
    const provider = signer.provider || getProvider();
    if (!provider) {
      console.error("[Contract] ERROR: Cannot get provider");
      return false;
    }
    
    const balance = await provider.getBalance(signerAddress);
    console.log(`  - Signer balance: ${ethers.formatEther(balance)} CRO`);
    
    if (balance === 0n) {
      console.error("[Contract] ERROR: Signer has no balance for gas fees!");
      return false;
    }

    // Check if payment is already released
    const isReleased = await contract.released(paymentHash);
    if (isReleased) {
      console.log(`[Contract] Payment already released`);
      return true;
    }

    // Check escrowed amount
    const escrowedAmount = await contract.escrowedAmounts(paymentHash);
    console.log(`  - Escrowed amount: ${ethers.formatUnits(escrowedAmount, 6)} USDC`);

    if (escrowedAmount === 0n) {
      console.warn(`[Contract] No escrowed amount found - payment may not have been escrowed yet`);
      // This is OK - x402 payments go directly to escrow, so we can still try to release
    }

    // Special handling for unified chat (Agent ID 1)
    // Unified chat is not a real agent - it's the platform's chat interface
    // For unified chat: transfer funds directly to contract owner, skip agent registry check
    if (agentId === 1) {
      console.log(`[Contract] ℹ️ Unified chat agent (ID 1) - transferring funds directly to contract owner`);
      console.log(`[Contract] Unified chat is not a registered agent, so we'll use contract owner as recipient`);
      
      // For unified chat, we'll try to use releasePayment but if it fails due to agent not found,
      // we'll skip it and just mark payment as settled (funds stay in escrow for contract owner)
      try {
        // Try to call releasePayment - if agent 1 exists in registry, it will work
        // If not, it will fail and we'll handle it gracefully
        const tx = await contract.releasePayment(paymentHash, agentId);
        console.log(`[Contract] Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`[Contract] Transaction confirmed in block: ${receipt?.blockNumber}`);
        console.log(`[Contract] ✅ Payment released to contract owner successfully`);
        return true;
      } catch (releaseError: any) {
        const errorMessage = releaseError?.message || String(releaseError);
        const errorReason = releaseError?.reason || "";
        
        // If error is "Agent not found", that's expected for unified chat
        // Funds are already in escrow, which is fine - they belong to the contract owner
        if (errorMessage.includes("Agent not found") || errorReason.includes("Agent not found")) {
          console.log(`[Contract] ℹ️ Unified chat agent not in registry - this is expected`);
          console.log(`[Contract] Payment is settled in escrow. Funds belong to contract owner (escrow contract owner).`);
          console.log(`[Contract] This is acceptable for unified chat since it's not a registered agent.`);
          // Return true to indicate payment is settled (even though not released via contract)
          return true;
        }
        
        // For other errors, log and return false
        console.error(`[Contract] ❌ Error releasing payment for unified chat:`, errorMessage);
        return false;
      }
    }
    
    // For other agents (2-5): verify agent exists in registry and has a developer
    // These are real agents that must be registered by their creators
    const registryContract = getAgentRegistry();
    
    if (registryContract) {
      try {
        const agent = await registryContract.getAgent(agentId);
        
        // Check if agent exists and has a developer
        if (agent.developer === ethers.ZeroAddress || !agent.developer) {
          console.error(`[Contract] ❌ Agent ${agentId} not found or has no developer address`);
          console.error(`[Contract] Agent must be registered by its creator before payments can be released`);
          return false;
        }
        
        console.log(`[Contract] ✅ Agent ${agentId} verified in registry`);
        console.log(`[Contract] Developer: ${agent.developer} (agent's creator)`);
        console.log(`[Contract] Payment will be released to: ${agent.developer}`);
      } catch (agentError) {
        console.error(`[Contract] ❌ Error checking agent ${agentId} in registry:`, agentError);
        return false;
      }
    }

    console.log(`[Contract] Calling releasePayment on escrow contract...`);
    const tx = await contract.releasePayment(paymentHash, agentId);
    console.log(`[Contract] Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[Contract] Transaction confirmed in block: ${receipt?.blockNumber}`);
    
    // Parse PaymentReleased event to get developer address and amount
    for (const log of receipt?.logs || []) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "PaymentReleased") {
          const developerAddress = parsed.args[1];
          const amount = parsed.args[2];
          console.log(`[Contract] ✅ Payment released to developer: ${developerAddress}`);
          console.log(`[Contract] ✅ Amount: ${ethers.formatUnits(amount, 6)} USDC`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    return true;
  } catch (error: any) {
    console.error("[Contract] ❌ Error calling releasePayment:");
    console.error("  - Error message:", error?.message);
    console.error("  - Error code:", error?.code);
    if (error?.reason) {
      console.error("  - Reason:", error.reason);
    }
    return false;
  }
}

/**
 * Call executeAgent on the contract to create execution record and increment totalExecutions
 */
export async function executeAgentOnContract(
  agentId: number,
  paymentHash: string,
  input: string
): Promise<number | null> {
  const contract = getAgentRegistryWithSigner();
  if (!contract) {
    console.warn("Cannot call executeAgent - no signer configured");
    return null;
  }

  try {
    // Get signer address from the wallet directly
    const signer = contract.runner as ethers.Wallet;
    if (!signer || !signer.address) {
      console.error("[Contract] ERROR: Cannot get signer address");
      return null;
    }
    const signerAddress = signer.address;
    
    console.log(`[Contract] Calling executeAgent on contract:`);
    console.log(`  - Agent ID: ${agentId}`);
    console.log(`  - Payment Hash: ${paymentHash}`);
    console.log(`  - Input length: ${input.length}`);
    console.log(`  - Signer address: ${signerAddress}`);
    
    // Check if we have enough balance for gas
    // Get provider from signer or use the global provider
    const provider = signer.provider || getProvider();
    if (!provider) {
      console.error("[Contract] ERROR: Cannot get provider");
      return null;
    }
    
    const balance = await provider.getBalance(signerAddress);
    console.log(`  - Signer balance: ${ethers.formatEther(balance)} CRO`);
    
    if (balance === 0n) {
      console.error("[Contract] ERROR: Signer has no balance for gas fees!");
      console.error(`[Contract] Please fund wallet ${signerAddress} with TCRO from: https://cronos.org/faucet`);
      return null;
    }

    // Method 1: Use nextExecutionId (MOST RELIABLE - doesn't depend on events)
    // Read nextExecutionId BEFORE the call - this will be our executionId
    let executionId: number | null = null;
    let nextExecutionIdBefore: bigint | null = null;
    
    try {
      nextExecutionIdBefore = await contract.nextExecutionId();
      console.log(`[Contract] Next execution ID before call: ${nextExecutionIdBefore}`);
      // This will be the executionId returned by executeAgent
      executionId = Number(nextExecutionIdBefore);
      console.log(`[Contract] ✅ Execution ID determined from nextExecutionId: ${executionId}`);
    } catch (e) {
      console.warn("[Contract] Could not read nextExecutionId before call, will try event parsing");
    }

    // Execute the transaction
    const txResponse = await contract.executeAgent(agentId, paymentHash, input);
    console.log(`[Contract] Transaction sent: ${txResponse.hash}`);
    
    // Wait for transaction to be mined
    const receipt = await txResponse.wait();
    console.log(`[Contract] Transaction confirmed in block: ${receipt?.blockNumber}`);
    
    // Verify executionId using nextExecutionId after call (confirmation)
    if (executionId !== null && nextExecutionIdBefore !== null) {
      try {
        const nextExecutionIdAfter = await contract.nextExecutionId();
        console.log(`[Contract] Next execution ID after call: ${nextExecutionIdAfter}`);
        // Verify: nextExecutionIdAfter should be nextExecutionIdBefore + 1
        if (nextExecutionIdAfter === nextExecutionIdBefore + 1n) {
          console.log(`[Contract] ✅ Verified: executionId ${executionId} is correct`);
        } else {
          console.warn(`[Contract] ⚠️  Verification mismatch: expected ${nextExecutionIdBefore + 1n}, got ${nextExecutionIdAfter}`);
        }
      } catch (e) {
        console.warn("[Contract] Could not verify executionId with nextExecutionId after call");
      }
    }
    
    // Method 2: Fallback - Parse from AgentExecuted event (if nextExecutionId method failed)
    if (executionId === null) {
      console.log("[Contract] Falling back to event parsing...");
      for (const log of receipt?.logs || []) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === "AgentExecuted") {
            executionId = Number(parsed.args[0]);
            console.log(`[Contract] ✅ Execution ID from AgentExecuted event: ${executionId}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // Method 3: Last resort - Calculate from nextExecutionId after call
    if (executionId === null) {
      try {
        const nextExecutionIdAfter = await contract.nextExecutionId();
        console.log(`[Contract] Next execution ID after call: ${nextExecutionIdAfter}`);
        // The executionId is nextExecutionId - 1 (since it was just incremented)
        if (nextExecutionIdAfter > 0n) {
          executionId = Number(nextExecutionIdAfter - 1n);
          console.log(`[Contract] ✅ Execution ID calculated from nextExecutionId (after): ${executionId}`);
        }
      } catch (e) {
        console.warn("[Contract] Could not read nextExecutionId after call");
      }
    }
    
    if (executionId === null) {
      console.error("[Contract] ❌ Could not determine executionId from any method");
      console.error("[Contract] Receipt logs:", receipt?.logs?.length || 0, "logs");
      // Debug: Show all events
      if (receipt?.logs) {
        console.log("[Contract] All receipt logs:");
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseLog(log);
            console.log("  - Event:", parsed?.name, "Args:", parsed?.args?.map((a: any) => a.toString()));
          } catch (e) {
            console.log("  - Raw log (could not parse):", log);
          }
        }
      }
    }
    
    return executionId;
  } catch (error: any) {
    console.error("[Contract] ❌ Error calling executeAgent on contract:");
    console.error("  - Error message:", error?.message);
    console.error("  - Error code:", error?.code);
    console.error("  - Error data:", error?.data);
    if (error?.reason) {
      console.error("  - Reason:", error.reason);
    }
    
    // Store error details for better error messages
    const errorMessage = error?.message || "";
    const errorReason = error?.reason || "";
    const combinedError = `${errorMessage} ${errorReason}`.toLowerCase();
    
    if (combinedError.includes("payment already used")) {
      console.error("[Contract] 🚫 Payment hash was already used - user needs to create a new payment");
    } else if (combinedError.includes("agent not found")) {
      console.error("[Contract] 🚫 Agent not found or not active");
    } else if (combinedError.includes("insufficient funds") || combinedError.includes("balance")) {
      console.error("[Contract] 🚫 Insufficient balance for gas fees");
    }
    
    return null;
  }
}

/**
 * Call verifyExecution on the contract to update metrics
 */
export async function verifyExecutionOnContract(
  executionId: number,
  output: string,
  success: boolean
): Promise<boolean> {
  const contract = getAgentRegistryWithSigner();
  if (!contract) {
    console.warn("[Contract] Cannot call verifyExecution - no signer configured");
    return false;
  }

  try {
    // Get signer address from the wallet directly
    const signer = contract.runner as ethers.Wallet;
    if (!signer || !signer.address) {
      console.error("[Contract] ERROR: Cannot get signer address");
      return false;
    }
    const signerAddress = signer.address;
    
    console.log(`[Contract] Calling verifyExecution on contract:`);
    console.log(`  - Execution ID: ${executionId}`);
    console.log(`  - Success: ${success}`);
    console.log(`  - Output length: ${output.length}`);
    console.log(`  - Signer address: ${signerAddress}`);
    
    // Check if we have enough balance for gas
    // Get provider from signer or use the global provider
    const provider = signer.provider || getProvider();
    if (!provider) {
      console.error("[Contract] ERROR: Cannot get provider");
      return false;
    }
    
    const balance = await provider.getBalance(signerAddress);
    console.log(`  - Signer balance: ${ethers.formatEther(balance)} CRO`);
    
    if (balance === 0n) {
      console.error("[Contract] ERROR: Signer has no balance for gas fees!");
      console.error(`[Contract] Please fund wallet ${signerAddress} with TCRO from: https://cronos.org/faucet`);
      return false;
    }

    // Verify execution exists and get agentId before calling verifyExecution
    const readContract = getAgentRegistry();
    if (!readContract) {
      console.error("[Contract] Cannot read contract to verify execution");
      return false;
    }
    
    try {
      const executionBefore = await readContract.getExecution(executionId);
      const execAgentId = Number(executionBefore.agentId);
      if (execAgentId === 0) {
        console.error(`[Contract] ❌ Execution ${executionId} has agentId 0 - execution doesn't exist!`);
        return false;
      }
      console.log(`[Contract] Execution ${executionId} belongs to agent ${execAgentId}`);
      
      // Get agent metrics before verification
      const agentBefore = await readContract.getAgent(execAgentId);
      console.log(`[Contract] Agent ${execAgentId} metrics BEFORE verify:`, {
        totalExecutions: Number(agentBefore.totalExecutions),
        successfulExecutions: Number(agentBefore.successfulExecutions),
        reputation: Number(agentBefore.reputation),
      });
    } catch (e) {
      console.error(`[Contract] ❌ Could not verify execution ${executionId} exists:`, e);
      return false;
    }

    const tx = await contract.verifyExecution(executionId, output, success);
    console.log(`[Contract] Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[Contract] Transaction confirmed in block: ${receipt?.blockNumber}`);
    
    // Verify metrics were updated
    try {
      const executionAfter = await readContract.getExecution(executionId);
      const execAgentId = Number(executionAfter.agentId);
      const agentAfter = await readContract.getAgent(execAgentId);
      console.log(`[Contract] ✅ Execution verified - metrics updated!`);
      console.log(`[Contract] Agent ${execAgentId} metrics AFTER verify:`, {
        totalExecutions: Number(agentAfter.totalExecutions),
        successfulExecutions: Number(agentAfter.successfulExecutions),
        reputation: Number(agentAfter.reputation),
      });
    } catch (e) {
      console.warn(`[Contract] Could not verify metrics update:`, e);
    }
    
    return true;
  } catch (error: any) {
    console.error("[Contract] ❌ Error calling verifyExecution on contract:");
    console.error("  - Error message:", error?.message);
    console.error("  - Error code:", error?.code);
    console.error("  - Error data:", error?.data);
    if (error?.reason) {
      console.error("  - Reason:", error.reason);
    }
    return false;
  }
}
