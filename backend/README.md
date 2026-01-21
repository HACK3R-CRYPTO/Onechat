# OneChat Backend

Node.js backend for OneChat. Unified Web3 assistant engine. x402 payment handling. REST API endpoints. Cronos contract integration. Crypto.com SDK integration.

## What This Backend Does

You receive agent execution requests. You verify x402 payments. You execute AI agents using Google Gemini. You fetch real blockchain and market data when needed. You return results. You settle payments. You update on-chain records (executions, reputation, success rates). All automated.

## Prerequisites

Install Node.js 18 or higher. Install npm. Have Google Gemini API key. Have Cronos testnet access. Have backend wallet with private key (for contract updates). Optional: Have Developer Platform API key for Crypto.com SDK. Optional: Have Cronos Explorer API keys for blockchain queries.

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
AGENT_REGISTRY_ADDRESS=0xd3097577Fa07E7CCD6D53C81460C449D96f736cC
AGENT_ESCROW_ADDRESS=0x4352F2319c0476607F5E1cC9FDd568246074dF14
GEMINI_API_KEY=your-gemini-api-key-here
BACKEND_PRIVATE_KEY=0x...your-private-key-here

# Crypto.com Developer Platform SDK
CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY=your-developer-platform-api-key-here
CRONOS_TESTNET_EXPLORER_KEY=your-explorer-key-here

# Magic Link Signer App (for Token.transfer())
# Run: git clone https://github.com/crypto-com/cdc-ai-agent-signer-app && cd cdc-ai-agent-signer-app && npm install && npm run dev
# Then set this to: http://localhost:5173 (or your deployed signer app URL)
CRYPTO_COM_PROVIDER=http://localhost:5173
# OR use this name (same thing)
CRYPTO_COM_SSO_WALLET_URL=http://localhost:5173

# Optional: OpenAI API Key (for AI Agent SDK - uses gpt-4o-mini, cheapest model)
OPENAI_API_KEY=your-openai-api-key-here

# Optional: Google Project ID (usually not needed for standard Gemini API)
GOOGLE_PROJECT_ID=your-project-id-here
```

**Required keys:**
- `BACKEND_PRIVATE_KEY` - For contract interactions
- `GEMINI_API_KEY` - For AI agent execution
- `CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY` - For blockchain queries
- `CRONOS_TESTNET_EXPLORER_KEY` - Recommended for blockchain queries

**Optional keys:**
- `CRYPTO_COM_PROVIDER` or `CRYPTO_COM_SSO_WALLET_URL` - **Required for `Token.transfer()` and `Token.wrap()` magic links**. Set to your signer app URL (default: `http://localhost:5173`). See [PROVIDER_URL_GUIDE.md](./PROVIDER_URL_GUIDE.md) for setup.
- `OPENAI_API_KEY` - Enables AI Agent SDK with gpt-4o-mini. Cheapest model at $0.075 input and $0.30 output per 1M tokens. Node.js SDK only supports OpenAI, not Gemini.
- `GOOGLE_PROJECT_ID` - Usually not needed for standard Gemini API.

**Important:** Never commit `.env` file (already in .gitignore).

## Magic Link Signer App Setup

To enable `Token.transfer()` and `Token.wrap()` magic links, you need to run the Crypto.com signer app:

```bash
# Clone the signer app
git clone https://github.com/crypto-com/cdc-ai-agent-signer-app
cd cdc-ai-agent-signer-app
npm install
npm run dev
```

This starts the signer app on `http://localhost:5173`. Set `CRYPTO_COM_PROVIDER=http://localhost:5173` in your `.env` file.

See [PROVIDER_URL_GUIDE.md](./PROVIDER_URL_GUIDE.md) for detailed instructions.

### Mainnet switch (optional)
```env
CRONOS_RPC_URL=https://evm.cronos.org
AGENT_REGISTRY_ADDRESS=<mainnet-address>
AGENT_ESCROW_ADDRESS=<mainnet-address>
VVS_ROUTER_ADDRESS=0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae
VVS_MOCK_MODE=false
```

Notes:
- Payment required on mainnet; skipped on testnet mock mode.
- VVS uses real router on mainnet; mock on testnet.

## Development

Start development server with auto-reload:

```bash
npm run dev
```

Server runs on http://localhost:3001. The tsx watch command automatically restarts the server on file changes.

## Production

Use process manager like PM2:

```bash
pm2 start src/index.ts --name agentmarket-backend
```

Or deploy to Vercel using vercel.json configuration.

## Project Structure

```
backend/
├── src/
│   ├── agent-engine/     # AI agent execution logic (Gemini + Crypto.com tools)
│   │   ├── executor.ts   # Main execution engine
│   │   └── tools.ts      # Crypto.com SDK integration
│   ├── x402/            # x402 payment verification and settlement
│   ├── api/             # REST API endpoints
│   │   ├── agents.ts    # Agent execution and listing
│   │   ├── chat.ts      # Unified chat endpoint (includes VVS swap detection)
│   │   ├── vvs-swap.ts  # VVS Finance swap execution endpoints
│   │   ├── analytics.ts # Platform and agent analytics
│   │   ├── logs.ts      # Execution and payment logs
│   │   └── executions.ts # Execution history
│   ├── lib/             # Contract interaction utilities
│   │   ├── contract.ts  # Contract read/write functions
│   │   └── database.ts  # JSON file-based database for logs
│   └── index.ts         # Main server file
├── data/                 # JSON database files (auto-created)
│   ├── executions.json  # Execution logs with timestamps
│   └── payments.json    # Payment logs with status
```

## API Endpoints

POST /api/agents/:id/execute: Execute an agent. Requires agent ID, input, and x402 payment header. Headers X-PAYMENT (base64 payment signature). Body { input: string, paymentHash: string }. Returns execution result with output and success status.

Flow: Verifies x402 payment via Cronos facilitator. Calls executeAgent() on contract (increments totalExecutions). Detects if real data is needed (market data, blockchain data). Fetches real data from Crypto.com APIs (MCP Server or SDK). Executes agent with Gemini AI (includes real data in prompt). Calls verifyExecution() on contract (updates successfulExecutions and reputation). Settles payment if successful. Returns result.

POST /api/vvs-swap/quote: Get VVS Finance swap quote. No payment required. Body { tokenIn: string, tokenOut: string, amountIn: string }. Returns quote with amountOut, path, and liquidity status.

POST /api/vvs-swap/execute: Execute VVS Finance swap. Requires x402 payment header. Headers X-PAYMENT (base64 payment signature). Body { tokenIn: string, tokenOut: string, amountIn: string, amountOutMin: string, recipient: string }. Returns unsigned transaction ready for signing.

POST /api/chat: Unified chat endpoint. Automatically routes to right tools. Requires input and x402 payment header. Headers X-PAYMENT (base64 payment signature). Body { input: string, paymentHash: string }. Returns chat response with real data.

Flow: Detects intent (market data, blockchain, contracts, content, swaps). Fetches real data if needed. For swap requests: Automatically extracts parameters, fetches live quote from VVS Finance DEX, provides swap details. Executes with Gemini. Returns formatted response.

GET /api/agents: List all available agents. Returns agent details including prices and reputation.

GET /api/agents/:id: Get agent details. Returns full agent information including execution metrics.

GET /api/analytics/platform: Get platform-wide analytics. Returns total agents, executions, revenue, success rate. Returns agent list with stats.

GET /api/analytics/agents/:id: Get agent analytics. Returns execution counts, revenue, success rate, reputation. All calculated from contract data.

GET /api/logs/executions: Get execution logs with optional filters. Supports time-based filtering (today, 7d, 30d). Query parameters: agentId, userId, range, startTime, endTime, success, limit.

GET /api/logs/payments: Get payment logs with optional filters. Supports status filtering and time ranges. Query parameters: agentId, userId, status, range, startTime, endTime, limit.

GET /api/logs/activity: Get recent activity feed (executions and payments combined). Query parameters: limit.

## Agent Execution Flow

Receive request: Validate input, check agent exists. Verify payment: Check x402 payment signature via Cronos facilitator. Update contract: Call executeAgent() on contract (increments totalExecutions). Detect tools needed: Analyze agent description to determine if blockchain/market data access needed. Fetch real data: If needed, fetch from Crypto.com APIs (market data, blockchain queries). Execute agent: Call Google Gemini API with enhanced prompt (includes real data). Update metrics: Call verifyExecution() on contract (updates successfulExecutions and reputation). Settle payment: Release payment to developer via x402 facilitator. Return result: Send output to user.

## Crypto.com Integration

Market Data via MCP Server: Connected to Crypto.com Market Data MCP Server at https://mcp.crypto.com/market-data/mcp. Uses Model Context Protocol for real-time data. Automatically fetches prices via get_ticker tool. Falls back to REST API if MCP unavailable. No API key required. Public MCP server.

How it works: User asks "What is the price of Bitcoin?" System connects to MCP Server. Calls get_ticker tool with instrument_name: "BTC_USD". Returns real-time price data. Falls back to REST API if MCP fails.

Logs to check: Look for "Connected to Crypto.com Market Data MCP Server" message. Look for "Using tool: get_ticker" in console. Look for "Market data fetched via MCP Server" confirmation.

Blockchain Data via Developer Platform SDK: Crypto.com Developer Platform Client SDK fully integrated. Wallet module handles Wallet.balance() and Wallet.create(). Transaction module handles Transaction.getTransactionByHash(), Transaction.getTransactionStatus(), Transaction.getGasPrice(), Transaction.getFeeData(). Token module handles Token.getERC20TokenBalance(), Token.getTokenTransfers(), Token.getERC20Metadata(). Query priority routes to Developer Platform SDK first. RPC fallback available for block queries.

Setup: Get Developer Platform API key from https://developer.crypto.com (create a project). Get Cronos Explorer API key from https://explorer-api-doc.cronos.org. Add keys to .env file. Agents automatically get blockchain tools.

How to verify SDK usage: Check backend console logs. Look for "Developer Platform Client SDK initialized with API key" message. Look for "Using Developer Platform Client SDK (Wallet.balance)..." in console. Look for "Balance fetched via Developer Platform SDK" confirmation.

AI Agent SDK: Node.js SDK uses OpenAI gpt-4o-mini. Cheapest model at $0.075 input and $0.30 output per 1M tokens. The @crypto.com/ai-agent-client Node.js SDK only supports OpenAI. Gemini support exists in REST API/Python SDK, but not in Node.js SDK. To use AI Agent SDK: Add OPENAI_API_KEY to .env. AI Agent SDK works perfectly for balance queries. Transaction and block queries get 403 from Explorer API but automatically fall back to Developer Platform SDK or RPC. System always returns correct answers. Current behavior: System skips AI Agent SDK when only Gemini is available, uses Developer Platform SDK fallback (works perfectly).

VVS Finance DEX Integration: Agent-driven swap workflow via unified chat. Automatic swap intent detection in chat endpoint. Parameter extraction from natural language. Live quote fetching from VVS Finance DEX. Swap quote generation endpoint at POST /api/vvs-swap/quote. Swap execution endpoint at POST /api/vvs-swap/execute (requires x402 payment). Token swap transaction building. Liquidity checking. x402 payment settlement. Mock mode automatically enabled on testnet (VVS only on mainnet). Real quotes on mainnet. Mock quotes on testnet for demo. Intelligent routing and automated liquidity actions.

Example: Ask "Swap 100 CRO for USDC" in chat. System detects swap intent, extracts parameters, fetches live quote, provides swap details. Execute swap with curl POST to /api/vvs-swap/execute with X-PAYMENT header and swap parameters.

## x402 Payment Integration

Backend uses Cronos x402 facilitator for payments. Version x402 v1 (Cronos-specific). Facilitator URL https://facilitator.cronoslabs.org/v2/x402. Network cronos-testnet. Token Bridged USDC (Stargate) - 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0.

Payment verification happens before execution. Payment settlement happens after success. All transparent on-chain.

Important: The backend requires the X402-Version: 1 header when calling facilitator endpoints.

## Agent Engine

Agent engine executes AI agents using Google Gemini API (model: gemini-2.5-flash).

Pre-configured agents: Agent #1 - Smart Contract Analyzer analyzes Solidity code, returns security report. Agent #2 - Market Data Agent fetches real-time market data, returns analysis (has Crypto.com API access). Agent #3 - Content Generator generates marketing content for Web3 projects. Agent #4 - Portfolio Analyzer analyzes DeFi portfolios, returns recommendations (has blockchain access).

Auto-generated agents: New agents (Agent #5+) automatically get prompts generated from their description. System analyzes description to determine tools needed. Agents with "market" keywords get market data access. Agents with "blockchain" keywords get blockchain access. All agents work immediately after registration, no configuration needed.

Tool detection: System automatically detects if agent needs real data. Market data agents get Crypto.com Exchange API access. Blockchain agents get Crypto.com Developer Platform SDK access (if configured). Text-only agents work without tools.

Retry logic: Automatic retry for transient errors (503, 429, 500). Exponential backoff (2s, 4s, 6s delays). Up to 3 retry attempts. Logs retry attempts for debugging.

## Cronos Contract Integration

Backend connects to AgentRegistry contract: Reads agent information. Calls executeAgent() to create execution records. Calls verifyExecution() to update metrics. Updates reputation scores automatically.

Metric updates: totalExecutions incremented when executeAgent() is called. successfulExecutions incremented when verifyExecution() is called with success=true. reputation calculated as (successfulExecutions * 1000) / totalExecutions.

Important: Metrics update even when agent execution fails. Failed execution increments totalExecutions but not successfulExecutions. Reputation decreases accordingly.

Backend connects to AgentEscrow contract for payment verification and release.

## Logging & Database

Execution logs: All agent executions logged to data/executions.json. Includes agentId, userId, input, output, success status, timestamp. Enables time-based analytics (today, 7 days, 30 days).

Payment logs: All payments logged to data/payments.json. Includes paymentHash, agentId, userId, amount, status, timestamp. Tracks payment status: pending → settled/verified/failed/refunded.

Database: JSON file-based database (no external dependencies). Auto-created data/ directory on first use. Used for analytics, trends, and activity feeds. Contract data is source of truth; logs provide timestamps.

Logging: All executions logged to database. Payment transactions logged to database. Errors logged to console. Contract interactions logged to console. Real data fetches logged to console.

## Error Handling

Invalid payments return 402 Payment Required status. Failed executions still update metrics (totalExecutions increments). Invalid inputs return 400 Bad Request status. Agent errors return 500 Internal Server Error status. Contract call failures return 400 Bad Request with details. API fetch failures logged but don't block execution (graceful degradation).

## Security

Payment verification prevents fraud. Input validation prevents abuse. Private keys stay secure (never logged). Contract calls require backend wallet signature. API keys stored in environment variables. Real data fetches are read-only (no write operations).

## Troubleshooting

Server not starting: Check .env file has correct values. Ensure Node.js version is 18 or higher. Check port 3001 is available. Verify dependencies installed: npm install.

Agent execution fails: Check backend wallet has CRO for gas. Verify GEMINI_API_KEY is set. Check agent exists on contract. Verify RPC URL is correct.

Payment verification fails: Check X-PAYMENT header is present. Verify payment signature format. Check facilitator URL is correct. Ensure payment hash is unique.

Contract interaction fails: Check backend wallet has gas fees. Verify contract address is correct. Check network connectivity. Ensure backend private key is correct.

Blockchain queries fail: Check Developer Platform API key is set. Verify DNS is configured to use Google DNS (8.8.8.8, 8.8.4.4). Check Explorer API key is set. Verify SDK packages are installed.

## Testing

Test agent execution:

```bash
curl -X POST http://localhost:3001/api/agents/1/execute \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: [payment-signature]" \
  -d '{"input": "Analyze this contract...", "paymentHash": "0x..."}'
```

Test chat endpoint:

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: [payment-signature]" \
  -d '{"input": "What is the price of Bitcoin?", "paymentHash": "0x..."}'
```

Test health check:

```bash
curl http://localhost:3001/health
```

## Integrations

Crypto.com Developer Platform SDK: Fully integrated for on-chain wallet operations. Wallet operations (balance, create) work. Token operations (balance, transfers) work. Transaction lookups work. All use x402 for settlement.

Crypto.com Market Data MCP Server: MCP Server connected at https://mcp.crypto.com/market-data/mcp. Real-time price data via MCP protocol. Automatic REST API fallback.

Crypto.com AI Agent SDK: Node.js SDK integrated on Cronos EVM. Uses OpenAI gpt-4o-mini for cost optimization. Balance queries work directly. Transaction and block queries automatically fall back to Developer Platform SDK or RPC when Explorer API returns 403. System ensures all queries succeed.

VVS Finance DEX: Agent-driven trade workflows via unified chat. Intelligent swap routing. Automatic parameter extraction. Live quote fetching. Swap quote and execution endpoints. x402-powered payment settlement. Mock mode on testnet. Real swaps on mainnet. Fully automated agent-driven workflow.

## Support

For issues or questions: Cronos Documentation at https://docs.cronos.org. x402 Documentation at https://docs.cronos.org/x402. Google Gemini API at https://ai.google.dev. OpenAI API at https://platform.openai.com. Crypto.com Developer Platform at https://developer.crypto.com. Crypto.com Market Data MCP at https://mcp.crypto.com/docs. Node.js Documentation at https://nodejs.org/docs.
