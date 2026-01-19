# AgentMarket Frontend

Next.js frontend for AgentMarket. Connect wallet. Browse agents. Execute agents. Pay via x402. View results. Real-time updates.

## What This Frontend Does

You connect your wallet. You browse available agents. You select an agent. You provide input. You pay via x402. You see results. Leaderboard updates instantly. Reputation scores update live.

## Prerequisites

Install Node.js 18 or higher. Install npm. Have a wallet extension ready. Configure Cronos testnet in your wallet.

## Installation

Navigate to frontend directory:

```bash
cd agentmarket/frontend
```

Install dependencies:

```bash
npm install
```

## Environment Configuration

Create .env.local file:

```env
NEXT_PUBLIC_CRONOS_RPC_URL=https://evm-t3.cronos.org
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_AGENT_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=338
```

Contract addresses also hardcoded in source files as fallback.

## Development

Start development server:

```bash
npm run dev
```

Visit http://localhost:3000 in your browser.

## Build for Production

```bash
npm run build
npm start
```

## Project Structure

frontend/

app/ Next.js app router pages

components/ React components

hooks/ Custom React hooks

lib/ Utility functions

public/ Static assets

## Pages

Home page: Browse all agents. See featured agents. View top agents by reputation.

Agent detail page: View agent information. See pricing. Check reputation. Execute agent.

Execution page: Provide input. Confirm payment. View results.

Developer portal: List your agents. Manage pricing. View earnings. Check analytics.

## Components

AgentCard: Displays agent information. Shows price and reputation. Links to detail page.

AgentDetail: Shows full agent details. Execution interface. Payment UI.

ExecutionForm: Input form for agent execution. Payment confirmation. Result display.

WalletConnect: Wallet connection button. Network switching. Balance display.

PaymentUI: x402 payment interface. Payment confirmation. Receipt display.

## x402 Payment Integration

Frontend uses x402 protocol for payments. Connects to facilitator. Handles payment signing. Shows payment status.

Payment flow:

Step one: User confirms execution. Frontend requests payment.

Step two: x402 facilitator returns payment request. User signs payment.

Step three: Payment signature sent to backend. Backend verifies payment.

Step four: Agent executes. Payment settles automatically.

## Wallet Integration

Frontend uses wagmi for wallet connection. Supports MetaMask. Supports WalletConnect. Auto-detects network.

Network switching: Frontend prompts user to switch to Cronos testnet. Shows network configuration. Validates connection.

## Real-Time Updates

Agent executions update in real time. Reputation scores update live. Leaderboard updates instantly. No refresh needed.

## Responsive Design

Works on desktop. Works on mobile. Touch-friendly controls. Responsive layouts.

## Contract Integration

Frontend reads from AgentRegistry contract. Displays agent information. Shows execution history. Updates reputation scores.

Frontend interacts with AgentEscrow contract. Shows payment status. Displays escrow balance.

## API Integration

Frontend calls backend API for agent execution. Sends execution requests. Receives results. Handles errors.

API endpoints:

GET /api/agents: Fetch all agents.

GET /api/agents/:id: Fetch agent details.

POST /api/agents/:id/execute: Execute agent.

GET /api/executions/:id: Get execution result.
