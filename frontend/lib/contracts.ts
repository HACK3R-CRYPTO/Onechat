/**
 * Contract addresses and ABIs for frontend
 */

import { defineChain } from 'viem';

// Contract addresses from environment or fallback to deployed addresses
export const AGENT_REGISTRY_ADDRESS = 
  (typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS 
    : process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS) ||
  "0xd3097577Fa07E7CCD6D53C81460C449D96f736cC";

export const AGENT_ESCROW_ADDRESS = 
  (typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_AGENT_ESCROW_ADDRESS 
    : process.env.NEXT_PUBLIC_AGENT_ESCROW_ADDRESS) ||
  "0x4352F2319c0476607F5E1cC9FDd568246074dF14";

// Cronos Testnet chain configuration
export const CRONOS_TESTNET = defineChain({
  id: 338,
  name: 'Cronos Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CRO',
    symbol: 'CRO',
  },
  rpcUrls: {
    default: {
      http: ['https://evm-t3.cronos.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Cronoscan Testnet',
      url: 'https://testnet.cronoscan.com',
    },
  },
});

// Contract ABIs (viem format)
export const AGENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "registerAgent",
    inputs: [
      { name: "name", type: "string", internalType: "string" },
      { name: "description", type: "string", internalType: "string" },
      { name: "pricePerExecution", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeAgent",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "paymentHash", type: "bytes32", internalType: "bytes32" },
      { name: "input", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "executionId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifyExecution",
    inputs: [
      { name: "executionId", type: "uint256", internalType: "uint256" },
      { name: "output", type: "string", internalType: "string" },
      { name: "success", type: "bool", internalType: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct AgentRegistry.Agent",
        components: [
          { name: "developer", type: "address", internalType: "address" },
          { name: "name", type: "string", internalType: "string" },
          { name: "description", type: "string", internalType: "string" },
          { name: "pricePerExecution", type: "uint256", internalType: "uint256" },
          { name: "totalExecutions", type: "uint256", internalType: "uint256" },
          { name: "successfulExecutions", type: "uint256", internalType: "uint256" },
          { name: "reputation", type: "uint256", internalType: "uint256" },
          { name: "active", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getExecution",
    inputs: [{ name: "executionId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct AgentRegistry.Execution",
        components: [
          { name: "agentId", type: "uint256", internalType: "uint256" },
          { name: "user", type: "address", internalType: "address" },
          { name: "paymentHash", type: "bytes32", internalType: "bytes32" },
          { name: "input", type: "string", internalType: "string" },
          { name: "output", type: "string", internalType: "string" },
          { name: "verified", type: "bool", internalType: "bool" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextAgentId",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextExecutionId",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "developer", type: "address", indexed: true, internalType: "address" },
      { name: "name", type: "string", indexed: false, internalType: "string" },
      { name: "pricePerExecution", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "AgentExecuted",
    inputs: [
      { name: "executionId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "agentId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "paymentHash", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "ExecutionVerified",
    inputs: [
      { name: "executionId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "success", type: "bool", indexed: false, internalType: "bool" },
      { name: "output", type: "string", indexed: false, internalType: "string" },
    ],
  },
  {
    type: "event",
    name: "ReputationUpdated",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "newReputation", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
] as const;

export const AGENT_ESCROW_ABI = [
  {
    type: "function",
    name: "releasePayment",
    inputs: [
      { name: "paymentHash", type: "bytes32", internalType: "bytes32" },
      { name: "agentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refundPayment",
    inputs: [
      { name: "paymentHash", type: "bytes32", internalType: "bytes32" },
      { name: "payer", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "escrowedAmounts",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "released",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PaymentReleased",
    inputs: [
      { name: "paymentHash", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "developer", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "PaymentRefunded",
    inputs: [
      { name: "paymentHash", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "payer", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
] as const;

/**
 * Get contract addresses
 * Returns the addresses from environment variables or fallback defaults
 */
export function getContractAddresses() {
  return {
    agentRegistry: AGENT_REGISTRY_ADDRESS as `0x${string}`,
    agentEscrow: AGENT_ESCROW_ADDRESS as `0x${string}`,
  };
}
