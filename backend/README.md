# AgentMarket Backend

Node.js backend for AgentMarket. Agent execution engine. x402 payment handling. REST API endpoints. Cronos contract integration.

## What This Backend Does

You receive agent execution requests. You verify x402 payments. You execute AI agents using Google Gemini. You return results. You settle payments. You update on-chain records (executions, reputation, success rates). All automated.

## Prerequisites

- Node.js 18 or higher
- npm
- Google Gemini API key
- Cronos testnet access
- Backend wallet with private key (for contract updates)

## Installation

Navigate to backend directory:

```bash
cd agentmarket/backend
```

Install dependencies:

```bash
npm install
```

## Environment Configuration

Create `.env` file:

```env
PORT=3001
CRONOS_RPC_URL=https://evm-t3.cronos.org
X402_FACILITATOR_URL=https://facilitator.cronoslabs.org/v2/x402
AGENT_REGISTRY_ADDRESS=0x0f764437ffBE1fcd0d0d276a164610422710B482
AGENT_ESCROW_ADDRESS=0xE2228Cf8a49Cd23993442E5EE5a39d6180E0d25f
GEMINI_API_KEY=your-gemini-api-key-here
BACKEND_PRIVATE_KEY=0x...your-private-key-here
```

**Important:** 
- `BACKEND_PRIVATE_KEY` is required for the backend to update contract metrics (executions, reputation)
- Never commit `.env` file (already in `.gitignore`)

## Development

Start development server with auto-reload:

```bash
npm run dev
```

Server runs on http://localhost:3001

The `tsx watch` command automatically restarts the server on file changes.

## Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
backend/
├── src/
│   ├── agent-engine/     # AI agent execution logic (Gemini)
│   ├── x402/            # x402 payment verification and settlement
│   ├── api/             # REST API endpoints
│   ├── lib/             # Contract interaction utilities
│   └── index.ts         # Main server file
```

## API Endpoints

### POST /api/agents/:id/execute

Execute an agent. Requires agent ID, input, and x402 payment header.

**Request:**
- Headers: `X-PAYMENT` (base64 payment signature)
- Body: `{ input: string, paymentHash: string }`

**Response:**
```json
{
  "executionId": 1234567890,
  "agentId": 1,
  "output": "Agent execution result...",
  "success": true,
  "payerAddress": "0x..."
}
```

**Flow:**
1. Verifies x402 payment via Cronos facilitator
2. Calls `executeAgent()` on contract (increments `totalExecutions`)
3. Executes agent with Gemini AI
4. Calls `verifyExecution()` on contract (updates `successfulExecutions` and `reputation`)
5. Settles payment if successful
6. Returns result

### GET /api/agents

List all available agents. Returns agent details including prices and reputation.

### GET /api/agents/:id

Get agent details. Returns full agent information including execution metrics.

## Agent Execution Flow

1. **Receive request**: Validate input, check agent exists
2. **Verify payment**: Check x402 payment signature via Cronos facilitator
3. **Update contract**: Call `executeAgent()` on contract (increments `totalExecutions`)
4. **Execute agent**: Call Google Gemini API, process input, generate output
5. **Update metrics**: Call `verifyExecution()` on contract (updates `successfulExecutions` and `reputation`)
6. **Settle payment**: Release payment to developer via x402 facilitator
7. **Return result**: Send output to user

## x402 Payment Integration

Backend uses Cronos x402 facilitator for payments:
- **Version**: x402 v1 (Cronos-specific)
- **Facilitator URL**: `https://facilitator.cronoslabs.org/v2/x402`
- **Network**: `cronos-testnet`
- **Token**: Bridged USDC (Stargate) - `0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0`

Payment verification happens before execution. Payment settlement happens after success. All transparent on-chain.

**Important**: The backend requires the `X402-Version: 1` header when calling facilitator endpoints.

## Agent Engine

Agent engine executes AI agents using **Google Gemini API** (model: `gemini-2.5-flash`).

Supported agents:
- **Smart Contract Analyzer**: Analyzes Solidity code, returns security report
- **Market Data Agent**: Fetches market data, returns analysis
- **Content Generator**: Generates marketing content for Web3 projects
- **Portfolio Analyzer**: Analyzes DeFi portfolios, returns recommendations

## Cronos Contract Integration

Backend connects to AgentRegistry contract:
- Reads agent information
- Calls `executeAgent()` to create execution records
- Calls `verifyExecution()` to update metrics
- Updates reputation scores automatically

**Metric Updates:**
- `totalExecutions`: Incremented when `executeAgent()` is called
- `successfulExecutions`: Incremented when `verifyExecution()` is called with `success=true`
- `reputation`: Calculated as `(successfulExecutions * 1000) / totalExecutions`

Backend connects to AgentEscrow contract for payment verification.

## Error Handling

- Invalid payments return `402 Payment Required` status
- Failed executions trigger refunds
- Invalid inputs return `400 Bad Request` status
- Agent errors return `500 Internal Server Error` status

## Logging

All executions logged. Payment transactions logged. Errors logged. Contract interactions logged.

## Security

- Payment verification prevents fraud
- Input validation prevents abuse
- Private keys stay secure (never logged)
- Contract calls require backend wallet signature
