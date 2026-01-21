# OneChat Frontend

Next.js frontend for OneChat. Connect wallet. Ask anything. Get real answers. Execute actions. Pay via x402. View results. Real-time updates.

## What This Frontend Does

You connect your wallet. You browse available agents. You select an agent. You provide input. You pay via x402 micropayments. You see results. Metrics update instantly. Reputation scores update live.

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

Create `.env.local` file (optional):

```env
NEXT_PUBLIC_CRONOS_RPC_URL=https://evm-t3.cronos.org
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0xd3097577Fa07E7CCD6D53C81460C449D96f736cC
NEXT_PUBLIC_AGENT_ESCROW_ADDRESS=0x4352F2319c0476607F5E1cC9FDd568246074dF14
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=338
```

**Note:** Contract addresses are also hardcoded in source files as a fallback, so the app works even without `.env.local`.

### Mainnet switch (optional)
```env
NEXT_PUBLIC_CRONOS_RPC_URL=https://evm.cronos.org
NEXT_PUBLIC_CHAIN_ID=25
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=<mainnet-address>
NEXT_PUBLIC_AGENT_ESCROW_ADDRESS=<mainnet-address>
```

Mock mode is automatic on testnet (VVS not on testnet). Real mode on mainnet.

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
│   ├── page.tsx           # Homepage (marketplace + chat CTA)
│   ├── chat/              # Unified chat interface
│   ├── agents/[id]/       # Agent detail page
│   ├── dashboard/         # Developer portal
│   │   ├── page.tsx      # Dashboard overview
│   │   ├── agents/        # Agent management
│   │   │   ├── new/      # Create new agent
│   │   │   └── [id]/analytics/ # Agent analytics
│   │   ├── analytics/     # Platform analytics
│   │   └── payments/      # Payment history
│   └── providers.tsx      # Wagmi providers
├── components/            # React components
│   ├── ui/                # UI components
│   ├── WalletConnect.tsx  # Wallet connection
│   └── X402Payment.tsx    # x402 payment component
├── hooks/                 # Custom React hooks
│   ├── useAgents.ts       # Agent data fetching
│   └── useX402Payment.ts  # x402 payment logic
└── lib/                   # Utility functions
    ├── contracts.ts       # Contract ABIs and addresses
    └── utils.ts           # Utility functions
```

## Pages

### Home Page (/)

Browse all agents. See featured chat interface. View agent cards with pricing and reputation. Search and filter agents. Dark theme with neutral color palette. Link to developer dashboard.

### Unified Chat (/chat)

ChatGPT-style interface. Ask anything. System detects intent automatically. Fetches real data when needed. Pay per message. Message history. Auto-scroll. Loading states.

**Swap Features:**
- Automatic network validation before executing swaps
- Prompts to switch network if wallet is on wrong chain
- Blocks transactions on wrong network to prevent failures
- Supports both Cronos Mainnet (Chain ID: 25) and Testnet (Chain ID: 338)
- Clear warnings when swap requires mainnet but wallet is on testnet

### Agent Detail Page (/agents/[id])

View agent information. See pricing. Check reputation, executions, and success rate. Execute agent with input. Pay via x402. View results. Real-time metric updates after execution.

### Developer Dashboard (/dashboard)

Platform overview. Total agents count. Total executions count. Total revenue. Success rate. Top performing agents list. Quick actions navigation. All agents grid with stats. Recent activity feed.

### Agent Analytics (/dashboard/analytics)

Per-agent analytics. Execution metrics. Revenue tracking. Success rates. Reputation scores. Pricing information. Links to agent pages.

### Payment History (/dashboard/payments)

Payment tracking. Total revenue. Total payments. Active agents count. Payment breakdown by agent. Revenue per agent. Execution counts per agent. All data from on-chain records.

### Create Agent (/dashboard/agents/new)

Register new agent. Fill form with name, description, price. Submit transaction. Agent appears in marketplace. Earn revenue from executions.

## Components

### WalletConnect

Wallet connection button. Network switching. Balance display. Auto-detects Cronos testnet.

### X402Payment

x402 payment interface. Payment confirmation. Handles payment signing. Stores payment header in session storage. Generates unique payment hash each time.

## x402 Payment Integration

Frontend uses x402 protocol (v1) for micropayments on Cronos.

Payment flow: User confirms execution. Frontend requests payment requirements from backend. x402 facilitator returns payment request. User signs payment with wallet. Payment signature sent to backend via X-PAYMENT header. Backend verifies payment. Agent executes. Payment settles automatically on success.

Payment details: Version x402 v1. Token Bridged USDC (Stargate) - 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0. Network Cronos testnet. Header X-PAYMENT (base64-encoded payment signature).

Payment hash generation: Uses keccak256 hash of payment header. Each payment generates unique hash. Random nonce ensures uniqueness. Prevents payment reuse.

## Wallet Integration

Frontend uses wagmi for wallet connection. Supports MetaMask. Supports WalletConnect. Supports Coinbase Wallet. Supports other EIP-1193 compatible wallets.

Network configuration: Supports both Cronos Testnet (Chain ID: 338) and Cronos Mainnet (Chain ID: 25). RPC URLs configured for both networks. Auto-detects network and validates before transactions. For swaps: Automatically checks if wallet is on correct network (mainnet for mainnet swaps, testnet for testnet swaps). Prompts user to switch networks if needed. Blocks transactions on wrong network to prevent failures.

## UI Design

Theme: Dark mode with neutral color palette. Background Pure black. Cards Dark neutral. Text Neutral grays. Accents Neutral borders and gradients.

Components: Shadcn-style components. Spline 3D integration for hero section. Framer Motion for animations. Tailwind CSS for styling. Responsive design (mobile-friendly).

## Real-Time Updates

Agent executions update in real time. Reputation scores update live. Execution metrics update automatically. No refresh needed.

## Contract Integration

Frontend reads from AgentRegistry contract: Displays agent information. Shows execution history. Updates reputation scores. Displays metrics (executions, success rate).

Frontend interacts with AgentEscrow contract for payment verification.

## API Integration

Frontend calls backend API for agent execution and analytics:

GET /api/agents - Fetch all agents

GET /api/agents/:id - Fetch agent details

POST /api/agents/:id/execute - Execute agent (requires x402 payment)

POST /api/chat - Unified chat endpoint (requires x402 payment)

GET /api/analytics/platform - Get platform-wide statistics

GET /api/analytics/agents/:id - Get detailed analytics for specific agent

GET /api/logs/executions - Get execution logs with filters

GET /api/logs/payments - Get payment logs with filters

GET /api/logs/activity - Get recent activity feed

## Responsive Design

Works on desktop. Works on mobile. Touch-friendly controls. Responsive layouts. Dark mode optimized.

## Troubleshooting

Wallet not connecting: Ensure wallet extension is installed. Check wallet is connected to Cronos testnet network. Refresh page and try again. Check browser console for errors.

Balance not updating: Click refresh button next to balance. Check console for errors. Verify contract addresses are correct. Ensure you are on correct network.

Payment fails: Check you have sufficient USDC for payment. Verify contract addresses are correct. Check browser console for error details. Ensure you are on Cronos testnet network.

Agent execution fails: Check backend server is running. Verify backend URL is correct in .env.local. Check browser console for error details. Ensure payment was created successfully.

## Browser Support

Chrome or Edge (recommended)

Firefox

Safari

Mobile browsers (iOS Safari, Chrome Mobile)

## Support

For issues or questions:
- Cronos Documentation: https://docs.cronos.org
- x402 Documentation: https://docs.cronos.org/x402
- wagmi Documentation: https://wagmi.sh
- Next.js Documentation: https://nextjs.org/docs
