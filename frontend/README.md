# AgentMarket Frontend

Next.js frontend for AgentMarket. Connect wallet. Browse agents. Execute agents. Pay via x402. View results. Real-time updates.

## What This Frontend Does

You connect your wallet. You browse available agents. You select an agent. You provide input. You pay via x402 micropayments. You see results. Metrics update instantly. Reputation scores update live.

## Prerequisites

- Node.js 18 or higher
- npm
- Wallet extension (MetaMask, WalletConnect, etc.)
- Cronos testnet configured in wallet
- Testnet USDC for payments

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

Create `.env.local` file:

```env
NEXT_PUBLIC_CRONOS_RPC_URL=https://evm-t3.cronos.org
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0x0f764437ffBE1fcd0d0d276a164610422710B482
NEXT_PUBLIC_AGENT_ESCROW_ADDRESS=0xE2228Cf8a49Cd23993442E5EE5a39d6180E0d25f
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=338
```

Contract addresses are also hardcoded in source files as fallback.

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

```
frontend/
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Homepage (marketplace)
│   ├── agents/[id]/       # Agent detail page
│   └── providers.tsx      # Wagmi providers
├── components/            # React components
│   ├── ui/                # UI components (shadcn-style)
│   │   ├── card.tsx       # Card component
│   │   ├── splite.tsx     # Spline 3D scene component
│   │   ├── spotlight.tsx # Spotlight effect
│   │   └── spline-demo.tsx # Hero section with 3D
│   ├── WalletConnect.tsx  # Wallet connection
│   └── X402Payment.tsx    # x402 payment component
├── hooks/                 # Custom React hooks
│   ├── useAgents.ts       # Agent data fetching
│   └── useX402Payment.ts  # x402 payment logic
└── lib/                   # Utility functions
    ├── contracts.ts       # Contract ABIs and addresses
    └── utils.ts           # Utility functions (cn, etc.)
```

## Pages

### Home Page (`/`)

Browse all agents. See featured agents with 3D Spline hero section. View agent cards with pricing and reputation. Dark theme with neutral color palette.

### Agent Detail Page (`/agents/[id]`)

View agent information. See pricing. Check reputation, executions, and success rate. Execute agent with input. Pay via x402. View results.

## Components

### AgentCard

Displays agent information. Shows price and reputation. Links to detail page. Dark theme styling.

### AgentDetail

Shows full agent details. Execution interface. Payment UI. Real-time metric display.

### WalletConnect

Wallet connection button. Network switching. Balance display. Auto-detects Cronos testnet.

### X402Payment

x402 payment interface. Payment confirmation. Handles payment signing. Stores payment header in session storage.

### SplineSceneBasic

3D interactive hero section using Spline. Dark theme with spotlight effect. Responsive design.

## x402 Payment Integration

Frontend uses x402 protocol (v1) for micropayments on Cronos.

**Payment Flow:**

1. User confirms execution → Frontend requests payment requirements from backend
2. x402 facilitator returns payment request → User signs payment with wallet
3. Payment signature sent to backend via `X-PAYMENT` header → Backend verifies payment
4. Agent executes → Payment settles automatically on success

**Payment Details:**
- **Version**: x402 v1
- **Token**: Bridged USDC (Stargate) - `0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0`
- **Network**: Cronos testnet
- **Header**: `X-PAYMENT` (base64-encoded payment signature)

## Wallet Integration

Frontend uses **wagmi** for wallet connection. Supports:
- MetaMask
- WalletConnect
- Coinbase Wallet
- Other EIP-1193 compatible wallets

**Network Configuration:**
- Chain ID: 338 (Cronos Testnet)
- RPC: https://evm-t3.cronos.org
- Auto-prompts user to switch to Cronos testnet if on wrong network

## UI Design

**Theme:** Dark mode with neutral color palette
- Background: Pure black (`#000000`)
- Cards: Dark neutral (`neutral-900`, `neutral-800`)
- Text: Neutral grays (`neutral-50`, `neutral-300`, `neutral-400`)
- Accents: Neutral borders and gradients

**Components:**
- Shadcn-style components (Card, Spotlight)
- Spline 3D integration for hero section
- Framer Motion for animations
- Tailwind CSS for styling
- Responsive design (mobile-friendly)

## Real-Time Updates

Agent executions update in real time. Reputation scores update live. Execution metrics update automatically. No refresh needed.

## Contract Integration

Frontend reads from AgentRegistry contract:
- Displays agent information
- Shows execution history
- Updates reputation scores
- Displays metrics (executions, success rate)

Frontend interacts with AgentEscrow contract for payment verification.

## API Integration

Frontend calls backend API for agent execution:

- `GET /api/agents` - Fetch all agents
- `GET /api/agents/:id` - Fetch agent details
- `POST /api/agents/:id/execute` - Execute agent (requires x402 payment)

## Responsive Design

Works on desktop. Works on mobile. Touch-friendly controls. Responsive layouts. Dark mode optimized.
