# AgentMarket Contracts

Smart contracts for AgentMarket. Agent registry. Payment escrow. On-chain verification. Cronos EVM deployment.

## What These Contracts Do

AgentRegistry contract stores agent information. Tracks agent executions. Manages reputation scores. Records payment history. All on-chain.

AgentEscrow contract holds payments. Releases funds on successful execution. Refunds on failure. Distributes platform fees. All transparent.

## Contracts

AgentRegistry.sol: Main registry contract. Developers register agents. Users execute agents. System tracks everything.

AgentEscrow.sol: Payment escrow contract. Holds x402 payments. Releases to developers. Handles refunds.

## Prerequisites

Install Foundry. Run forge install. Have Cronos testnet configured. Get testnet tokens from faucet.

## Installation

Navigate to contracts directory:

```bash
cd agentmarket/contracts
```

Dependencies install automatically with forge init. forge-std library included.

## Development

Compile contracts:

```bash
forge build
```

Run tests:

```bash
forge test
```

Deploy to Cronos testnet:

```bash
forge script script/Deploy.s.sol --rpc-url https://evm-t3.cronos.org --broadcast
```

## Contract Addresses

Update these after deployment:

Agent Registry: 0x...

Agent Escrow: 0x...

Update addresses in frontend and backend after deployment.

## Network Configuration

Cronos Testnet:

Chain ID: 338

RPC URL: https://evm-t3.cronos.org

Block Explorer: https://testnet.cronoscan.com

USDC.e: 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0

## Deployment Script

Create script/Deploy.s.sol:

```solidity
// Deployment script
// Deploys AgentRegistry
// Deploys AgentEscrow
// Links contracts together
// Verifies on Cronoscan
```

## Testing

Write tests in test/ folder. Test agent registration. Test agent execution. Test payment escrow. Test reputation updates. Test refunds.

Run all tests:

```bash
forge test -vvv
```

## Contract Functions

AgentRegistry:

registerAgent: Developers register new agents. Set name, description, price.

executeAgent: Users execute agents. Provide input. Submit payment hash.

verifyExecution: Backend verifies execution. Updates reputation. Records result.

distributePayment: Releases payment to developer. Takes platform fee.

AgentEscrow:

escrowPayment: Holds payment until execution completes.

releasePayment: Releases payment to developer after success.

refundPayment: Returns payment to user on failure.

## Security Considerations

All payments verified before release. Reputation scores prevent abuse. Escrow prevents double spending. Platform fees enforced on-chain.

## View on Cronoscan

After deployment, view contracts on Cronoscan. Verify source code. Check transactions. Monitor events.
