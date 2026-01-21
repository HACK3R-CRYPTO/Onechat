# OneChat Smart Contracts

Smart contracts for OneChat. Deploy to Cronos. Test locally. Verify on explorer.

## What These Contracts Do

AgentRegistry contract stores agent information. Tracks agent executions. Manages reputation scores. Records payment history. All on-chain.

AgentEscrow contract holds payments. Releases funds on successful execution. Refunds on failure. Distributes platform fees. All transparent.

## Contracts

### AgentRegistry.sol

Main registry contract. Developers register agents. Users execute agents. System tracks everything.

Key functions: registerAgent() - Register new agent (sets initial reputation to 500). Can be called by any developer from frontend. Returns new agent ID. Emits AgentRegistered event. executeAgent() - Create execution record (increments totalExecutions). verifyExecution() - Verify execution result (updates successfulExecutions and reputation). getAgent() - Get agent details. getExecution() - Get execution details.

Agent metrics: totalExecutions: Total number of times agent has been executed. successfulExecutions: Number of successful executions. reputation: Calculated as (successfulExecutions * 1000) / totalExecutions (0-1000 scale).

### AgentEscrow.sol

Payment escrow contract. Holds x402 payments. Releases to developers. Handles refunds.

## Prerequisites

Install Foundry. Get CRO for gas fees. Have a wallet ready.

Foundry installation: https://book.getfoundry.sh/getting-started/installation

## Installation

Clone the repository. Navigate to contracts folder. Install dependencies.

```bash
git clone <repository-url>
cd agentmarket/contracts
forge install
```

Build contracts:

```bash
forge build
```

Run tests:

```bash
forge test
```

All tests must pass before deployment.

## Configuration

Create a `.env` file in the contracts directory:

```
PRIVATE_KEY=0xyour_private_key_with_0x_prefix
AGENT_REGISTRY_ADDRESS=0xd3097577Fa07E7CCD6D53C81460C449D96f736cC
AGENT_ESCROW_ADDRESS=0x4352F2319c0476607F5E1cC9FDd568246074dF14
```

Important notes:
- Private key must include 0x prefix
- Contract addresses used for verification scripts
- Never commit .env file

## Get Testnet Tokens

Get testnet tokens before deploying:

- TCRO: https://cronos.org/faucet
- devUSDC.e: https://faucet.cronos.org

You need TCRO for gas fees.

## Deployment

### Deploy All Contracts

Deploy everything to Cronos Testnet:

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url https://evm-t3.cronos.org --broadcast --verify
```

This deploys both contracts. Sets up relationships. Verifies on explorer.

### Register Initial Agents

Register first four agents after deployment:

```bash
forge script script/RegisterAgents.s.sol:RegisterAgentsScript --rpc-url https://evm-t3.cronos.org --broadcast
```

This registers agents 1-4 on-chain. Agents appear in marketplace immediately.

## Deployed Contracts

Cronos Testnet:

Agent Registry: 0xd3097577Fa07E7CCD6D53C81460C449D96f736cC

Agent Escrow: 0x4352F2319c0476607F5E1cC9FDd568246074dF14

View contracts on Cronoscan Testnet.

## Network Configuration

Cronos Testnet:
- Chain ID: 338
- RPC URL: https://evm-t3.cronos.org
- Block Explorer: https://testnet.cronoscan.com
- USDC.e: 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0

## Contract Functions

### AgentRegistry

#### registerAgent(string name, string description, uint256 pricePerExecution)

Developers register new agents from the frontend dashboard. Sets agent metadata. Initializes metrics: totalExecutions: 0. successfulExecutions: 0. reputation: 500 (50% default). active: true (agent is immediately available).

Who can call: Any address (public function). Typically called from frontend via wallet connection. Developer address (msg.sender) becomes the agent owner.

Price format: Price in USDC with 6 decimals. Example: $0.10 = 100000 (0.10 * 1,000,000).

Events: AgentRegistered(uint256 agentId, address developer, string name, uint256 pricePerExecution).

Frontend integration: Developers use /dashboard/agents/new page. Form validates input and converts price to 6 decimals. Transaction signed via MetaMask/WalletConnect. Agent appears in marketplace immediately after confirmation.

#### executeAgent(uint256 agentId, bytes32 paymentHash, string input)

Users execute agents. Creates execution record. Increments totalExecutions.

Requirements: Agent must exist and be active. Payment hash must not be used before. Input must not be empty.

Events: AgentExecuted(uint256 executionId, uint256 agentId, address user, bytes32 paymentHash).

#### verifyExecution(uint256 executionId, string output, bool success)

Backend verifies execution. Updates metrics: If success = true: Increments successfulExecutions. Recalculates reputation = (successfulExecutions * 1000) / totalExecutions.

Requirements: Execution must exist. Execution must not be verified already.

Events: ExecutionVerified(uint256 executionId, bool success, string output). ReputationUpdated(uint256 agentId, uint256 newReputation).

### AgentEscrow

#### escrowPayment(bytes32 paymentHash, uint256 amount)

Holds payment until execution completes.

#### releasePayment(bytes32 paymentHash, uint256 agentId)

Releases payment to developer after success. Requires agent to exist in registry with valid developer address.

#### refundPayment(bytes32 paymentHash, address payer)

Returns payment to user on failure.

## Usage

### Register Agent

Developers call registerAgent() from frontend. Provide name, description, price. Agent gets unique ID. Agent appears in marketplace.

### Execute Agent

Users call executeAgent() via backend. Provide agent ID, payment hash, input. Creates execution record. Increments totalExecutions.

### Verify Execution

Backend calls verifyExecution() after AI execution. Provide execution ID, output, success status. Updates successfulExecutions if success. Recalculates reputation score.

## Testing

Write tests in test/ folder. Test: Agent registration. Agent execution. Payment escrow. Reputation updates. Refunds.

Run all tests:

```bash
forge test -vvv
```

## Security Considerations

All payments verified before release. Reputation scores prevent abuse. Escrow prevents double spending. Platform fees enforced on-chain. Payment hashes tracked to prevent reuse.

## View on Cronoscan

After deployment, view contracts on Cronoscan:
- AgentRegistry: https://testnet.cronoscan.com/address/0xd3097577Fa07E7CCD6D53C81460C449D96f736cC
- AgentEscrow: https://testnet.cronoscan.com/address/0x4352F2319c0476607F5E1cC9FDd568246074dF14

Verify source code. Check transactions. Monitor events.

## Integration with Backend

The backend automatically calls contract functions:

On agent execution: Backend calls executeAgent() → increments totalExecutions.

After AI execution: Backend calls verifyExecution() → updates successfulExecutions and reputation.

This requires BACKEND_PRIVATE_KEY to be set in backend .env file.

## Analytics Integration

Contract data powers analytics dashboard. Platform stats aggregated from all agents. Agent analytics from contract state. Payment history calculated from execution records. All metrics update automatically. Frontend dashboard reads from AgentRegistry contract. All analytics on-chain and transparent.

Developer portal features: Dashboard shows platform-wide stats (total agents, executions, revenue). Per-agent analytics show execution counts, success rates, reputation. Payment history tracks all payments with status breakdown. Time-based trends (today, 7 days, 30 days) use backend logs. Recent activity feed combines executions and payments.

Data sources: On-chain: Agent registry, execution records, reputation scores. Backend logs: Execution timestamps, payment status, activity feed. Combined: Frontend aggregates both for complete analytics.

## Contract Verification

Contracts verify automatically during deployment using Etherscan API key.

Verification works on Cronoscan.

Manual verification:

```bash
forge verify-contract <CONTRACT_ADDRESS> <CONTRACT_PATH>:<CONTRACT_NAME> \
  --chain-id 338 \
  --verifier etherscan \
  --verifier-url https://testnet.cronoscan.com/api \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args <ARGS>
```

## Project Structure

```
contracts/
├── src/
│   ├── AgentRegistry.sol
│   └── AgentEscrow.sol
├── test/
│   └── AgentRegistry.t.sol
├── script/
│   ├── Deploy.s.sol
│   └── RegisterAgents.s.sol
├── foundry.toml
└── README.md
```

## Troubleshooting

Deployment fails: Check .env file has correct values. Ensure you have enough CRO for gas fees. Verify network connectivity. Check contract compilation: forge build.

Verification fails: Ensure ETHERSCAN_API_KEY is set in .env. Check API key is valid. Wait a few minutes after deployment before verification. Try manual verification on explorer.

Tests fail: Run forge clean and rebuild. Check Solidity version matches (0.8.13). Verify dependencies installed: forge install.

## Contract Update Notes

After deploying new contracts: Update contract addresses in frontend .env.local. Update contract addresses in backend .env. Verify all contracts on explorer. Test full flow: register agent, execute agent, verify execution.

## Support

For issues or questions:
- Cronos Documentation: https://docs.cronos.org
- Foundry Book: https://book.getfoundry.sh
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts
