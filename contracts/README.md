# AgentMarket Contracts

Smart contracts for AgentMarket. Agent registry. Payment escrow. On-chain verification. Cronos EVM deployment.

## What These Contracts Do

**AgentRegistry** contract stores agent information. Tracks agent executions. Manages reputation scores. Records payment history. All on-chain.

**AgentEscrow** contract holds payments. Releases funds on successful execution. Refunds on failure. Distributes platform fees. All transparent.

## Contracts

### AgentRegistry.sol

Main registry contract. Developers register agents. Users execute agents. System tracks everything.

**Key Functions:**
- `registerAgent()` - Register new agent (sets initial reputation to 500)
- `executeAgent()` - Create execution record (increments `totalExecutions`)
- `verifyExecution()` - Verify execution result (updates `successfulExecutions` and `reputation`)
- `getAgent()` - Get agent details
- `getExecution()` - Get execution details

**Agent Metrics:**
- `totalExecutions`: Total number of times agent has been executed
- `successfulExecutions`: Number of successful executions
- `reputation`: Calculated as `(successfulExecutions * 1000) / totalExecutions` (0-1000 scale)

### AgentEscrow.sol

Payment escrow contract. Holds x402 payments. Releases to developers. Handles refunds.

## Prerequisites

- Install Foundry
- Run `forge install`
- Have Cronos testnet configured
- Get testnet tokens from faucet

## Installation

Navigate to contracts directory:

```bash
cd agentmarket/contracts
```

Dependencies install automatically with `forge init`. `forge-std` library included.

## Development

Compile contracts:

```bash
forge build
```

Run tests:

```bash
forge test
```

Run tests with verbose output:

```bash
forge test -vvv
```

## Deployment

Deploy to Cronos testnet:

```bash
forge script script/Deploy.s.sol --rpc-url https://evm-t3.cronos.org --broadcast --private-key $PRIVATE_KEY
```

Register agents after deployment:

```bash
forge script script/RegisterAgents.s.sol --rpc-url https://evm-t3.cronos.org --broadcast --private-key $PRIVATE_KEY
```

## Contract Addresses

**Deployed on Cronos Testnet:**

- **Agent Registry**: `0x0f764437ffBE1fcd0d0d276a164610422710B482`
- **Agent Escrow**: `0xE2228Cf8a49Cd23993442E5EE5a39d6180E0d25f`

Update these addresses in frontend and backend `.env` files after deployment.

## Network Configuration

**Cronos Testnet:**
- Chain ID: 338
- RPC URL: https://evm-t3.cronos.org
- Block Explorer: https://testnet.cronoscan.com
- USDC.e: `0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0`

## Contract Functions

### AgentRegistry

#### `registerAgent(string name, string description, uint256 pricePerExecution)`

Developers register new agents. Sets agent metadata. Initializes metrics:
- `totalExecutions`: 0
- `successfulExecutions`: 0
- `reputation`: 500 (50% default)

**Events:**
- `AgentRegistered(uint256 agentId, address developer, string name, uint256 pricePerExecution)`

#### `executeAgent(uint256 agentId, bytes32 paymentHash, string input)`

Users execute agents. Creates execution record. Increments `totalExecutions`.

**Requirements:**
- Agent must exist and be active
- Payment hash must not be used before
- Input must not be empty

**Events:**
- `AgentExecuted(uint256 executionId, uint256 agentId, address user, bytes32 paymentHash)`

#### `verifyExecution(uint256 executionId, string output, bool success)`

Backend verifies execution. Updates metrics:
- If `success = true`: Increments `successfulExecutions`
- Recalculates `reputation = (successfulExecutions * 1000) / totalExecutions`

**Requirements:**
- Execution must exist
- Execution must not be verified already

**Events:**
- `ExecutionVerified(uint256 executionId, bool success, string output)`
- `ReputationUpdated(uint256 agentId, uint256 newReputation)`

### AgentEscrow

#### `escrowPayment(bytes32 paymentHash, uint256 amount)`

Holds payment until execution completes.

#### `releasePayment(bytes32 paymentHash, uint256 agentId)`

Releases payment to developer after success.

#### `refundPayment(bytes32 paymentHash, address payer)`

Returns payment to user on failure.

## Testing

Write tests in `test/` folder. Test:
- Agent registration
- Agent execution
- Payment escrow
- Reputation updates
- Refunds

Run all tests:

```bash
forge test -vvv
```

## Security Considerations

- All payments verified before release
- Reputation scores prevent abuse
- Escrow prevents double spending
- Platform fees enforced on-chain
- Payment hashes tracked to prevent reuse

## View on Cronoscan

After deployment, view contracts on Cronoscan:
- **AgentRegistry**: https://testnet.cronoscan.com/address/0x0f764437ffBE1fcd0d0d276a164610422710B482
- **AgentEscrow**: https://testnet.cronoscan.com/address/0xE2228Cf8a49Cd23993442E5EE5a39d6180E0d25f

Verify source code. Check transactions. Monitor events.

## Integration with Backend

The backend automatically calls contract functions:

1. **On agent execution**: Backend calls `executeAgent()` → increments `totalExecutions`
2. **After AI execution**: Backend calls `verifyExecution()` → updates `successfulExecutions` and `reputation`

This requires `BACKEND_PRIVATE_KEY` to be set in backend `.env` file.
