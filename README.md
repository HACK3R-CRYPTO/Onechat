# AgentMarket

Unified AI agent marketplace. Ask anything. System routes automatically. Real data. Pay per use. Built on Cronos with x402 micropayments.

## What You Get

You ask questions. System detects what you need. Fetches real data. Returns accurate answers. Pay per message. No subscriptions. No gas fees.

For users: ChatGPT-style interface. Automatic tool selection. Real cryptocurrency prices. Real blockchain data. Smart contract analysis. Content generation. All in one place.

For developers: Register agents on-chain. Set your prices. Earn from every execution. Full analytics dashboard. Payment tracking. Real-time metrics. All data from blockchain.

## How It Works

Connect your wallet. Go to chat. Ask questions. System detects intent. Fetches real data. Returns answers. Pay $0.10 per message. Instant results.

Ask "What's the price of Bitcoin?" System fetches real price from Crypto.com Market Data MCP Server. Returns current price with 24h change.

Ask "Check balance of 0x..." System queries Cronos blockchain via Crypto.com Developer Platform SDK. Returns actual balance.

Ask "Analyze this contract..." System analyzes Solidity code. Returns security report.

Ask "Create a tweet about DeFi" System generates marketing content. Returns ready-to-use copy.

Ask "Swap 100 CRO for USDC" System detects swap intent. Fetches live quote from VVS Finance DEX. Returns quote with swap parameters. Guides execution via x402 payment.

## Your First Query

Step one: Connect your wallet. Use MetaMask or WalletConnect. Switch to Cronos testnet. Get test tokens from faucet.

Step two: Try unified chat. Go to `/chat`. Ask "What's the price of Bitcoin?" System detects market data query. Pay $0.10 via x402. System fetches real price from Crypto.com Market Data MCP Server. Returns current price instantly.

Step three: Ask blockchain questions. Type "Check balance of 0x1234..." System uses Crypto.com Developer Platform SDK. Queries Cronos blockchain. Returns real balance. Pay $0.10 via x402.

Step four: Ask contract questions. Type "Analyze this contract: [code]" System analyzes Solidity. Returns security report with vulnerabilities. Pay $0.10 via x402.

Step five: Browse individual agents. Go to homepage. See agent cards. Click Smart Contract Analyzer. View details. Execute with contract code. Pay via x402. See analysis results.

Step six: Try VVS Finance swap. Go to `/chat`. Ask "Swap 100 CRO for USDC". System detects swap intent. Fetches live quote from VVS Finance. Shows expected output amount. Provides swap parameters. Execute via `/api/vvs-swap/execute` with x402 payment ($0.15). Sign transaction in wallet. Swap executes on VVS Finance.

Step seven: Create your own agent. Go to `/dashboard`. Click "Create Agent". Fill name, description, price. Register on-chain. Agent appears in marketplace. Earn revenue from executions.

## Using Agents

### Via Unified Chat

Go to `/chat`. Ask anything. System detects intent. Routes to right agent. Fetches real data. Returns answer. Pay $0.10 per message. All automatic.

Examples:
- "What's the price of Bitcoin?" → Fetches real price from Crypto.com Market Data
- "Check balance of 0x1234..." → Queries Cronos blockchain via Developer Platform SDK
- "Analyze this contract: [code]" → Analyzes Solidity, returns security report
- "Create a tweet about DeFi" → Generates marketing content
- "Swap 100 CRO for USDC" → Fetches live quote from VVS Finance, provides swap parameters

### Via Individual Agents

Browse agents on homepage. Search and filter. View agent details. See pricing and reputation. Execute with input. Pay via x402. See results. Real-time metric updates.

Agent types:
- Smart Contract Analyzer: Analyzes Solidity code for vulnerabilities
- Market Data Agent: Fetches real-time cryptocurrency prices
- Content Generator: Creates marketing content, tweets, blog posts
- Portfolio Analyzer: Analyzes DeFi portfolios and provides recommendations

### Via VVS Finance Swap (Agent-Driven)

Go to `/chat`. Ask "Swap X TOKEN_A for TOKEN_B". System detects swap intent. Automatically extracts parameters. Fetches live quote from VVS Finance DEX. Shows expected output amount and swap path. Provides ready-to-use swap parameters. Execute via `/api/vvs-swap/execute` with x402 payment ($0.15). Sign transaction in wallet. Swap executes on VVS Finance. Mock mode on testnet. Real swaps on mainnet. Fully agent-driven workflow.

## Features

### Unified Chat Interface

ChatGPT-style interface. Ask anything. System detects intent automatically. Routes to right tools. Fetches real data when needed. Pay $0.10 per message. Message history. Auto-scroll. Loading states.

### Individual Agents

Browse agents on homepage. Search and filter. View agent details. See pricing and reputation. Execute with input. Pay via x402. See results. Real-time metric updates from blockchain.

### VVS Finance Token Swap (Agent-Driven)

Intelligent swap routing via unified chat. Ask "Swap 100 CRO for USDC" in chat. System automatically detects swap intent. Extracts token pair and amount. Fetches live quote from VVS Finance DEX. Returns expected output amount and swap path. Provides swap parameters ready for execution. Execute via `/api/vvs-swap/execute` with x402 payment ($0.15). Sign transaction in wallet. Swap executes on VVS Finance. Mock mode on testnet. Real swaps on mainnet. Agent-driven workflow with intelligent routing.

### Developer Portal

Create agents. Fill form. Name. Description. Price. Register on-chain. Agent appears in marketplace. Users can execute. You earn revenue.

Track analytics. Platform-wide metrics. Per-agent metrics. Execution counts. Success rates. Revenue tracking. All data from blockchain. Real-time updates.

Monitor payments. All payments logged. Status breakdown. Pending. Settled. Refunded. Payment history. Execution logs. Recent activity feed.

## Real Data Integration

Market Data via Crypto.com MCP Server: Connected to Crypto.com Market Data MCP Server. Uses Model Context Protocol for real-time prices. Automatically fetches via get_ticker tool. Falls back to REST API if MCP unavailable. No API key required. Works immediately.

Blockchain Data via Developer Platform SDK: Crypto.com Developer Platform Client SDK fully integrated. Wallet module handles balance queries and wallet creation. Transaction module handles transaction lookups, status checks, gas prices, and fee data. Token module handles ERC20 balances, transfers, and metadata. Query priority routes to Developer Platform SDK first. RPC fallback available for block queries.

AI Agent SDK: Node.js SDK uses OpenAI gpt-4o-mini. Cost-optimized model at $0.075 input and $0.30 output per 1M tokens. Works perfectly for balance queries. Transaction and block queries get 403 from Explorer API but automatically fall back to Developer Platform SDK or RPC. System always returns correct answers.

VVS Finance DEX Integration: Agent-driven swap workflow via unified chat. Automatic swap intent detection. Live quote fetching from VVS Finance DEX. Parameter extraction from natural language. Swap execution endpoints with x402 payment. Token swap transaction building. Liquidity checking. Fully integrated and working. Mock mode on testnet (VVS only on mainnet). Real mode on mainnet. Production-ready code. Intelligent routing and automated liquidity actions.

## Agent Focus

Agents stay focused. Auto-generated prompts enforce specialization. Agents decline off-topic questions. Agents explain what they can help with. No generic answers. Each agent has a domain. System enforces boundaries.

Example: Agent description "Analyzes Solidity contracts" only answers contract questions. If asked about weather, agent politely declines and explains its specialization.

## Payment Flow

User pays via x402. Payment goes to escrow contract. Backend settles payment. Backend releases payment to developer. Platform takes 10% fee. Developer receives 90% in their wallet.

Example: User pays $0.10. Platform fee $0.01. Developer receives $0.09. All automatic. All on-chain. All transparent.

## Integrations

Crypto.com Developer Platform SDK: Fully integrated for on-chain wallet operations. Wallet creation works. Balance queries work. Token operations work. Transaction lookups work. All operations use x402 for settlement.

Crypto.com Market Data MCP Server: MCP Server connected and working. Real-time price data via MCP protocol. Automatic REST API fallback. No API key required.

Crypto.com AI Agent SDK: Node.js SDK integrated on Cronos EVM. Uses OpenAI gpt-4o-mini for cost optimization. Balance queries work directly. Transaction and block queries automatically fall back to Developer Platform SDK or RPC when Explorer API returns 403. System ensures all queries succeed.

VVS Finance DEX: Agent-driven trade workflows via unified chat. Intelligent swap routing. Automatic parameter extraction. Live quote fetching. Swap execution endpoints. x402-powered payment settlement. Token swap transaction building. Mock mode on testnet. Real swaps on mainnet. Fully automated agent-driven workflow.

## Getting Started

Frontend: Navigate to frontend folder. Run npm install. Run npm run dev. Visit localhost:3000.

Contracts: See contracts README for setup. Deploy to Cronos testnet. Update frontend addresses.

Backend: See backend README for setup. Run validation server. Configure contract addresses. Set Developer Platform API key. Set Cronos Explorer key. Optional: Set OPENAI_API_KEY for AI Agent SDK.

## Deployed Contracts

Cronos Testnet:

Agent Registry: 0xd3097577Fa07E7CCD6D53C81460C449D96f736cC

Agent Escrow: 0x4352F2319c0476607F5E1cC9FDd568246074dF14

View contracts on Cronoscan Testnet.

## Network Configuration

Chain ID: 338

RPC URL: https://evm-t3.cronos.org

USDC.e: 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0

Faucets: TCRO from cronos.org/faucet. devUSDC.e from faucet.cronos.org.

## Documentation

[Frontend README](frontend/README.md) — Frontend setup and features.

[Backend README](backend/README.md) — Backend setup, API, and integrations.

[Contracts README](contracts/README.md) — Smart contract setup and deployment.

## Built for Hackathon

AgentMarket built for Cronos x402 Paytech Hackathon. Unified chat interface. Intelligent routing. Real-world data integration. x402 micropayments. On-chain agent registry. Full developer portal. Crypto.com SDK integration complete. Market Data MCP Server connected. VVS Finance DEX integrated with agent-driven trade workflows. Intelligent swap routing. Automated liquidity actions. Ready for users. Production quality code.
