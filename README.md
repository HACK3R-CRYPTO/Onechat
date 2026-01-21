# OneChat

Ask anything. Get real answers. Execute actions. All in one chat. Built on Cronos with x402 micropayments.

## The Problem

Web3 users waste hours every day switching between 5+ different apps and tools. Check prices on CoinGecko. Swap on VVS. Transfer via wallet. Query on Cronoscan. Analyze contracts separately. Each action requires opening a different app. Each app requires different logins. Each workflow takes multiple steps.

Simple tasks like "swap tokens and check my portfolio" require 15+ minutes across 3 different apps. Users must know which tool to use for each task. No unified interface. Complex workflows. Time waste.

## User Story

Sarah is a DeFi user. She needs to check her portfolio, swap some tokens, and send money. That's 3 different apps. 3 different logins. 15 minutes of her time. She opens CoinGecko to check prices. Then opens VVS Finance to swap tokens. Then opens her wallet to send money. Each app has different interfaces. Each requires different steps. Each takes time.

Mike is a crypto trader. He wants to ask "What's my balance and swap 100 CRO for USDC" in one place. But he needs to use 3 different tools. Check balance on Cronoscan. Swap on VVS. Each tool requires manual navigation. Each requires understanding the interface. Why can't he just ask in plain English?

Alex is a Web3 enthusiast. Before OneChat, he spent 20 minutes every morning checking prices, balances, and recent transactions across 4 different apps. CoinGecko for prices. Cronoscan for balances. VVS for swaps. Wallet for transfers. Each morning. Every day. 20 minutes wasted on tool switching.

OneChat solves this. One chat. Multiple superpowers. Ask in plain English. Get real answers. Execute actions. All in one place. No app switching. No manual tool selection. Just ask. Get results.

## Why Micropayments Make Sense for Paid Prompting

Traditional AI services charge monthly subscriptions or high per-request fees. Users pay $20/month even if they only use it 5 times. Or pay $0.50 per request even for simple queries. This doesn't scale. This doesn't make sense.

Micropayments solve this. Pay only for what you use. $0.10 per message. No subscription. No commitment. Use it once? Pay $0.10. Use it 100 times? Pay $10. Fair pricing. Transparent costs. Pay as you go.

For users: Pay only when you use the service. No monthly fees. No wasted subscriptions. Fair pricing per message. Transparent costs. Try it risk-free. Use it when you need it.

For developers: Earn revenue from every execution. No free riders. No subscription management. Direct payment per use. Fair compensation for your work. Transparent earnings.

For the platform: Sustainable revenue model. No free tier abuse. No subscription churn. Payment per use ensures quality. Users value what they pay for. Developers earn what they deserve.

x402 micropayments enable this. Instant settlement. Low fees. On-chain transparency. No credit cards. No subscriptions. Just pay per use. Fair. Transparent. Sustainable.

## What You Get

You ask questions. System detects intent. Routes to right tools. Fetches real data. Returns answers. Executes actions. Pay $0.10 per message. All automatic. No app switching. No manual tool selection. Just ask in plain English.

## How It Works

Connect your wallet. Go to chat. Ask questions. System detects intent. Fetches real data. Returns answers. Pay $0.10 per message. Instant results.

Ask "What's the price of Bitcoin?" System fetches real price from Crypto.com Market Data MCP Server. Returns current price with 24h change.

Ask "Check balance of 0x..." System queries Cronos blockchain via Crypto.com Developer Platform SDK. Returns actual balance.

Ask "Show my portfolio" System fetches all token balances. Returns formatted portfolio view.

Ask "My transactions" System queries transaction history. Returns recent transactions with details.

Ask "Swap 100 CRO for USDC" System detects swap intent. Fetches live quote from VVS Finance DEX. Returns quote with swap parameters. Guides execution via x402 payment.

Ask "Send 50 CRO to 0x..." System detects transfer intent. Generates transfer transaction. Returns magic link that opens in modal. Complete transfer without leaving chat.

Ask "Analyze this contract..." System analyzes Solidity code. Returns security report.

Ask "Create a tweet about DeFi" System generates marketing content. Returns ready-to-use copy.

Ask "Get all tickers" System fetches all trading pairs from Crypto.com Exchange. Returns formatted list with prices and volumes.

Ask "Get latest block with detail" System fetches latest block data. Returns block information with transaction details.

Ask "Get whitelisted tokens of protocol VVS" System fetches whitelisted tokens for VVS protocol. Returns token list with addresses and details.

Ask "Get all farms of protocol VVS" System fetches all farms for VVS protocol. Returns farm list with APR and APY data.

Ask "Resolve CronosId name xyz.cro" System resolves CronosID name to blockchain address. Returns address for the name.

Ask "Wrap 10 CRO token" System wraps native CRO into WCRO. Returns magic link that opens in modal. Complete wrap transaction without leaving chat.

## Your First Query

Step one: Connect your wallet. Use MetaMask or WalletConnect. Switch to Cronos testnet. Get test tokens from faucet.

Step two: Try unified chat. Go to `/chat`. Ask "What's the price of Bitcoin?" System detects market data query. Pay $0.10 via x402. System fetches real price from Crypto.com Market Data MCP Server. Returns current price instantly.

Step three: Ask blockchain questions. Type "Check balance of 0x1234..." System uses Crypto.com Developer Platform SDK. Queries Cronos blockchain. Returns real balance. Pay $0.10 via x402.

Step four: View your portfolio. Type "show my portfolio" System fetches all token balances. Returns formatted view. Pay $0.10 via x402.

Step five: Check transaction history. Type "my transactions" System queries transaction history. Returns recent transactions. Pay $0.10 via x402.

Step six: Try VVS Finance swap. Go to `/chat`. Ask "Swap 100 CRO for USDC on mainnet" (or "on testnet"). System detects swap intent. Fetches live quote from VVS Finance. Shows expected output amount. Provides swap parameters. System validates your wallet network before executing. If swap is for mainnet but wallet is on testnet (or vice versa), you'll be prompted to switch networks. Execute via swap button with x402 payment ($0.15). Sign transaction in wallet. Swap executes on VVS Finance.

Step seven: Create your own agent. Go to `/dashboard`. Click "Create Agent". Fill name, description, price. Register on-chain. Agent appears in marketplace. Earn revenue from executions.

## Using Agents

### Via Unified Chat

Go to `/chat`. Ask anything. System detects intent. Routes to right agent. Fetches real data. Returns answer. Pay $0.10 per message. All automatic.

Examples:
- "What's the price of Bitcoin?" → Fetches real price from Crypto.com Market Data
- "Get all tickers" → Fetches all trading pairs from Crypto.com Exchange
- "What's the ticker information of BTC_USDT" → Fetches specific ticker data
- "Check balance of 0x1234..." → Queries Cronos blockchain via Developer Platform SDK
- "Show my portfolio" → Shows all token balances in your wallet
- "My transactions" → Shows recent transaction history
- "Get latest block with detail" → Fetches latest block with full transaction details
- "Get block 68858930" → Fetches specific block by number
- "Get whitelisted tokens of protocol VVS" → Fetches VVS whitelisted tokens
- "Get all farms of protocol VVS" → Fetches all VVS farms with APR/APY
- "Get farm of protocol VVS symbol CRO-GOLD" → Fetches specific farm details
- "Resolve CronosId name xyz.cro" → Resolves CronosID name to address
- "Lookup CronosId for 0x..." → Looks up address to find CronosID name
- "Wrap 10 CRO token" → Wraps native CRO into WCRO via magic link modal
- "Create a wallet" → Creates new wallet via AI Agent SDK
- "Analyze this contract: [code]" → Analyzes Solidity, returns security report
- "Create a tweet about DeFi" → Generates marketing content
- "Swap 100 CRO for USDC" → Fetches live quote from VVS Finance, provides swap parameters
- "Send 50 CRO to 0x..." → Generates magic link that opens in modal for seamless transfer

### Via Individual Agents

Browse agents on homepage. Search and filter. View agent details. See pricing and reputation. Execute with input. Pay via x402. See results. Real-time metric updates.

Agent types:
- Smart Contract Analyzer: Analyzes Solidity code for vulnerabilities
- Market Data Agent: Fetches real-time cryptocurrency prices
- Content Generator: Creates marketing content, tweets, blog posts
- Portfolio Analyzer: Analyzes DeFi portfolios and provides recommendations

## Features

### Unified Chat Interface

ChatGPT-style interface with modern chat bubble UI. Ask anything. System detects intent automatically. Routes to right tools. Fetches real data when needed. Pay $0.10 per message. Message history. Auto-scroll. Loading states.

Voice Input: Click microphone button to speak your message. Supports multiple languages (English, Français, Kiswahili, العربية, Español, Português). Auto-retry on network errors. Works in Chrome, Edge, and Safari.

Quick Actions: One-click shortcuts for common tasks. Show Portfolio. Transaction History. Swap Tokens. Transfer Funds. Check Balance. Create Wallet.

Rich Text Rendering: Markdown support with proper formatting for code blocks, links, lists, and more. Magic links automatically open in modal overlay for seamless transaction completion without leaving chat.

Multi-language Support: Select your preferred language for voice input from the language selector.

### Individual Agents

Browse agents on homepage. Search and filter. View agent details. See pricing and reputation. Execute with input. Pay via x402. See results. Real-time metric updates from blockchain.

### VVS Finance Token Swap

Intelligent swap routing via unified chat. Ask "Swap 100 CRO for USDC" in chat. System automatically detects swap intent. Extracts token pair and amount. Fetches live quote from VVS Finance DEX. Returns expected output amount and swap path. Provides swap parameters ready for execution. Execute via `/api/vvs-swap/execute` with x402 payment ($0.15). Sign transaction in wallet. Swap executes on VVS Finance. Mock mode on testnet. Real swaps on mainnet. Agent-driven workflow with intelligent routing.

### Token Transfers

Send money via natural language. Ask "transfer 5 CRO to 0x..." or "send 100 USDC to 0x...". System detects transfer intent. Generates transfer transaction via Crypto.com SDK. Returns magic link for seamless execution. Magic links open in modal overlay. Complete transaction without leaving chat. Supports native CRO and ERC-20 tokens. Fully integrated with x402 payments.

### Developer Portal

Create agents. Fill form. Name. Description. Price. Register on-chain. Agent appears in marketplace. Users can execute. You earn revenue.

Track analytics. Platform-wide metrics. Per-agent metrics. Execution counts. Success rates. Revenue tracking. All data from blockchain. Real-time updates.

Monitor payments. All payments logged. Status breakdown. Pending. Settled. Refunded. Payment history. Execution logs. Recent activity feed.

## Real Data Integration

Market Data via Crypto.com MCP Server: Connected to Crypto.com Market Data MCP Server. Uses Model Context Protocol for real-time prices. Automatically fetches via get_ticker tool. Falls back to REST API if MCP unavailable. No API key required. Works immediately.

Blockchain Data via AI Agent SDK: AI Agent SDK handles Exchange queries (Get all tickers, ticker information), Defi queries (whitelisted tokens, all farms, farm by symbol), and CronosID queries (resolve name, lookup address). AI Agent SDK internally uses Developer Platform SDK and provides formatted responses. Wallet module handles balance queries and wallet creation. Transaction module handles transaction lookups, status checks, gas prices, and fee data. Token module handles ERC20 balances, transfers, wrapping, and metadata. Block module handles block queries by tag (latest, pending, earliest, or block number) with full transaction details. RPC fallback available for block queries.

AI Agent SDK: Node.js SDK uses OpenAI gpt-4o-mini. Cost-optimized model at $0.075 input and $0.30 output per 1M tokens. Handles Exchange queries (Get all tickers, ticker information), Defi queries (whitelisted tokens, all farms, farm by symbol), and CronosID queries (resolve name, lookup address). Internally uses Developer Platform SDK and provides formatted responses. Works perfectly for balance queries. If AI Agent SDK encounters 403 errors from Explorer API, it automatically falls back to Developer Platform SDK for Exchange/Defi/CronosID queries. Transaction and block queries also fall back to Developer Platform SDK or RPC when needed. System always returns correct answers with intelligent fallback routing.

VVS Finance DEX Integration: Agent-driven swap workflow via unified chat. Automatic swap intent detection. Live quote fetching from VVS Finance DEX. Parameter extraction from natural language. Swap execution endpoints with x402 payment. Token swap transaction building. Liquidity checking. Fully integrated and working. Mock mode on testnet (VVS only on mainnet). Real mode on mainnet. Production-ready code. Intelligent routing and automated liquidity actions.

## Agent Focus

Agents stay focused. Auto-generated prompts enforce specialization. Agents decline off-topic questions. Agents explain what they can help with. No generic answers. Each agent has a domain. System enforces boundaries.

Example: Agent description "Analyzes Solidity contracts" only answers contract questions. If asked about weather, agent politely declines and explains its specialization.

## Payment Flow

### Individual Agent Payments

User pays via x402. Payment goes to escrow contract. Backend settles payment. Backend releases payment to developer. Platform takes 10% fee. Developer receives 90% in their wallet.

Example: User pays $0.10. Platform fee $0.01. Developer receives $0.09. All automatic. All on-chain. All transparent.

### Unified Chat Payments

User pays via x402. Payment goes directly to platform treasury (platform fee recipient). Each message requires a new payment. Payments are cleared after each use to prevent reuse. System validates payment before sending and prompts for new payment if none exists.

Important: Each message in unified chat requires a fresh payment ($0.10 per message). Payments are automatically cleared after successful execution. If payment is missing or already used, system will prompt for a new payment. Unified chat payments go to platform treasury, not individual agent developers.

## Integrations

Crypto.com AI Agent SDK: Handles Exchange queries (Get all tickers, ticker information), Defi queries (whitelisted tokens, all farms, farm by symbol), and CronosID queries (resolve name, lookup address). Internally uses Developer Platform SDK and provides formatted responses. Also handles wallet creation, balance queries, transaction lookups, and block queries. If AI Agent SDK encounters 403 errors from Explorer API, it automatically falls back to Developer Platform SDK for Exchange/Defi/CronosID queries. Developer Platform SDK used directly for token wrapping (not supported by AI Agent SDK). All operations use x402 for settlement.

Crypto.com Market Data MCP Server: MCP Server connected and working. Real-time price data via MCP protocol. Automatic REST API fallback. No API key required.

Crypto.com AI Agent SDK: Node.js SDK integrated on Cronos EVM. Uses OpenAI gpt-4o-mini for cost optimization. Handles Exchange queries (Get all tickers, ticker information), Defi queries (whitelisted tokens, all farms, farm by symbol), and CronosID queries (resolve name, lookup address). Internally uses Developer Platform SDK and provides formatted responses. Balance queries work directly. If AI Agent SDK encounters 403 errors from Explorer API, it automatically falls back to Developer Platform SDK for Exchange/Defi/CronosID queries. Transaction and block queries also fall back to Developer Platform SDK or RPC when Explorer API returns 403. System ensures all queries succeed with intelligent fallback routing.

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

[Frontend README](frontend/README.md): Frontend setup and features.

[Backend README](backend/README.md): Backend setup, API, and integrations.

[Contracts README](contracts/README.md): Smart contract setup and deployment.

## Quick Test

Try these commands in chat:
- "show my portfolio" → See all your token balances
- "my transactions" → See your transaction history
- "create a wallet" → Create a new wallet
- "What's the price of Bitcoin?" → Get real-time price
- "Get all tickers" → Get all trading pairs from Crypto.com Exchange
- "What's the ticker information of BTC_USDT" → Get specific ticker data
- "Get latest block with detail" → Get latest block with full transaction details
- "Get whitelisted tokens of protocol VVS" → Get VVS whitelisted tokens
- "Get all farms of protocol VVS" → Get all VVS farms
- "Resolve CronosId name xyz.cro" → Resolve CronosID to address
- "Wrap 10 CRO token" → Wrap native CRO into WCRO via magic link modal
- "Swap 100 CRO for USDC" → Get live swap quote
- "Send 10 CRO to 0x..." → Generate transfer link that opens in modal

Or use Quick Actions:
- Click "Show Portfolio" button → Instantly view your balances
- Click "Transaction History" button → See your recent transactions
- Click "Swap Tokens" button → Quick swap interface
- Click "Transfer Funds" button → Fast transfer setup
- Click "Check Balance" button → Get your wallet balance
- Click "Create Wallet" button → Generate a new wallet

Voice Input:
- Click the microphone icon to speak your message
- Select your language from the language selector
- Speak naturally - the system will transcribe and send your message
- Works in Chrome, Edge, and Safari (requires HTTPS or localhost)

Payment Notes:
- Each message requires a new payment ($0.10 per message)
- After sending a message, you'll need to create a new payment for the next message
- The system will automatically prompt you to create a payment if none exists
- Payments are cleared after each use to ensure security and prevent reuse

## Built for Hackathon

OneChat built for Cronos x402 Paytech Hackathon. Intelligent Web3 assistant. Automatic routing. Real-world data integration. x402 micropayments. Multiple capabilities. Crypto.com SDK integration complete. Market Data MCP Server connected. VVS Finance DEX integrated. Exchange module for ticker data. Block module for block queries. Defi module for VVS and H2 protocols. CronosID module for name resolution. Token wrapping support. Token transfers via magic links with modal overlay. Portfolio tracker. Transaction history. Wallet creation. Voice input. Quick actions. Ready for users. Production quality code.
