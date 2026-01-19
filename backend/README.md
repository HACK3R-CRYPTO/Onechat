# AgentMarket Backend

Node.js backend for AgentMarket. Agent execution engine. x402 payment handling. REST API endpoints. Cronos contract integration.

## What This Backend Does

You receive agent execution requests. You verify x402 payments. You execute AI agents. You return results. You settle payments. You update on-chain records. All automated.

## Prerequisites

Install Node.js 18 or higher. Install npm. Have OpenAI API key ready. Configure Cronos testnet access.

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

Create .env file:

```env
PORT=3001
CRONOS_RPC_URL=https://evm-t3.cronos.org
X402_FACILITATOR_URL=https://x402.cronos.org/facilitator
AGENT_REGISTRY_ADDRESS=0x...
AGENT_ESCROW_ADDRESS=0x...
OPENAI_API_KEY=sk-...
PRIVATE_KEY=0x...
```

Never commit .env file. Already in .gitignore.

## Development

Start development server:

```bash
npm run dev
```

Server runs on http://localhost:3001

## Build for Production

```bash
npm run build
npm start
```

## Project Structure

backend/

src/

agent-engine/ AI agent execution logic

x402/ x402 payment verification and settlement

api/ REST API endpoints

db/ Database models

index.ts Main server file

## API Endpoints

POST /api/agents/:id/execute

Execute an agent. Requires agent ID, input, payment hash. Returns agent output. Settles payment automatically.

GET /api/agents

List all available agents. Returns agent details. Includes prices and reputation.

GET /api/agents/:id

Get agent details. Returns full agent information.

POST /api/agents/register

Register new agent. Requires developer wallet. Sets agent metadata. Updates on-chain registry.

GET /api/executions/:id

Get execution details. Returns execution result. Shows payment status.

## Agent Execution Flow

Step one: Receive execution request. Validate input. Check agent exists.

Step two: Verify x402 payment. Check payment hash. Confirm amount. Validate signature.

Step three: Execute agent. Call OpenAI API. Process input. Generate output.

Step four: Verify output quality. Check result validity. Validate format.

Step five: Settle payment. Release to developer. Take platform fee. Update on-chain.

Step six: Return result. Send output to user. Log execution.

## x402 Payment Integration

Backend uses x402 facilitator for payments. Verifies payment signatures. Settles payments automatically. Handles refunds on failure.

Payment verification happens before execution. Payment settlement happens after success. All transparent on-chain.

## Agent Engine

Agent engine executes AI agents. Uses OpenAI API. Processes different agent types. Returns formatted results.

Supported agents:

Smart Contract Analyzer: Analyzes Solidity code. Returns security report.

Market Data Agent: Fetches market data. Returns analysis.

Content Generator: Generates content. Returns formatted text.

Portfolio Analyzer: Analyzes portfolios. Returns recommendations.

## Cronos Contract Integration

Backend connects to AgentRegistry contract. Reads agent information. Updates execution records. Updates reputation scores.

Backend connects to AgentEscrow contract. Verifies escrowed payments. Triggers payment release. Handles refunds.

## Error Handling

Invalid payments return 402 status. Failed executions trigger refunds. Invalid inputs return 400 status. Agent errors return 500 status.

## Logging

All executions logged. Payment transactions logged. Errors logged. Analytics tracked.

## Security

Payment verification prevents fraud. Input validation prevents abuse. Rate limiting prevents spam. Private keys stay secure.
