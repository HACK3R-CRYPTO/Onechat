/**
 * Agent Tools - Crypto.com API Integration
 * Provides real blockchain and market data capabilities to agents
 */

// Optional: Crypto.com AI Agent SDK (requires additional setup)
// import { createClient, QueryOptions } from "@crypto.com/ai-agent-client";

// Crypto.com Market Data MCP Server URL
const MCP_MARKET_DATA_URL = "https://mcp.crypto.com/market-data/mcp";

// MCP Client instance (lazy initialized)
let mcpClient: any = null;
let mcpClientInitialized = false;

export interface AgentTools {
  hasBlockchainAccess: boolean;
  hasMarketDataAccess: boolean;
  hasSwapAccess: boolean;
  tools: string[];
}

/**
 * Determine which tools an agent should have based on its description
 */
export function determineAgentTools(description: string): AgentTools {
  const descLower = description.toLowerCase();
  
  const tools: string[] = [];
  let hasBlockchainAccess = false;
  let hasMarketDataAccess = false;
  let hasSwapAccess = false;

  // Check for blockchain-related keywords
  const blockchainKeywords = [
    "blockchain", "contract", "transaction", "balance", "wallet", 
    "token", "nft", "defi", "cronos", "ethereum", "address", 
    "block", "explorer", "on-chain"
  ];
  
  // Check for market data keywords
  const marketDataKeywords = [
    "market", "price", "trading", "volume", "crypto", "bitcoin", 
    "ethereum", "cryptocurrency", "exchange", "ticker", "quote"
  ];

  // Check for swap/DEX keywords
  const swapKeywords = [
    "swap", "exchange", "trade", "dex", "vvs", "finance", "liquidity",
    "token swap", "convert", "exchange token", "swap token"
  ];

  // Determine tools based on description
  if (blockchainKeywords.some(keyword => descLower.includes(keyword))) {
    hasBlockchainAccess = true;
    tools.push("blockchain_query");
    tools.push("balance_check");
    tools.push("transaction_lookup");
  }

  if (marketDataKeywords.some(keyword => descLower.includes(keyword))) {
    hasMarketDataAccess = true;
    tools.push("market_data");
    tools.push("price_lookup");
    tools.push("volume_analysis");
  }

  if (swapKeywords.some(keyword => descLower.includes(keyword))) {
    hasSwapAccess = true;
    tools.push("vvs_swap");
    tools.push("token_swap");
    tools.push("get_swap_quote");
  }

  return {
    hasBlockchainAccess,
    hasMarketDataAccess,
    hasSwapAccess,
    tools,
  };
}

/**
 * Create Crypto.com AI Agent SDK client
 * Requires: @crypto.com/ai-agent-client package and API keys
 * Supports both OpenAI and Gemini (GoogleGenAI) providers
 * 
 * IMPORTANT: The AI Agent SDK requires the Developer Platform API key for authentication.
 * We initialize the Developer Platform Client SDK first, then create the AI Agent client.
 */
export function createCryptoComClient(): any {
  try {
    // First, initialize the Developer Platform Client SDK (required for authentication)
    const { Client } = require("@crypto.com/developer-platform-client");
    const { createClient, QueryOptions } = require("@crypto.com/ai-agent-client");
    
    // Check for Gemini API key first (preferred, since we're using Gemini for agents)
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const googleProjectId = process.env.GOOGLE_PROJECT_ID;
    const openAIApiKey = process.env.OPENAI_API_KEY;
    const cronosTestnetExplorerKey = process.env.CRONOS_TESTNET_EXPLORER_KEY;
    // Developer Platform API key (from https://developer.crypto.com) - required for authentication
    const developerPlatformApiKey = process.env.CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY;
    
    // Both keys are important but serve different purposes:
    // - Developer Platform API key: Required for endpoint authentication
    // - Explorer API key: Used for blockchain explorer queries (optional but recommended)
    
    if (!developerPlatformApiKey) {
      console.warn("⚠️ Crypto.com AI Agent SDK not fully configured. Blockchain queries will not work.");
      console.warn("   Set CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY in .env to enable");
      console.warn("   Get it from: https://developer.crypto.com (create a project)");
      return null;
    }
    
    if (!cronosTestnetExplorerKey) {
      console.warn("⚠️ CRONOS_TESTNET_EXPLORER_KEY not set - some blockchain queries may be limited");
      console.warn("   Get it from: https://explorer-api-doc.cronos.org");
    }
    
    // Initialize Developer Platform Client SDK first (required for authentication)
    try {
      Client.init({
        apiKey: developerPlatformApiKey,
        // provider is optional, SDK will use default
      });
      console.log("✅ Developer Platform Client SDK initialized with API key");
    } catch (initError) {
      console.warn("⚠️ Failed to initialize Developer Platform Client SDK:", initError);
      // Continue anyway - might still work
    }
    
    // IMPORTANT: The Node.js SDK (@crypto.com/ai-agent-client) only supports OpenAI
    // The TypeScript interfaces show only `openAI` field, no `gemini` support
    // Gemini support is available via REST API, but not through this SDK
    // Documentation showing Gemini is for Python SDK or REST API, not Node.js SDK
    let queryOptions: any; // Use 'any' to allow adding Developer Platform API key
    
    if (openAIApiKey) {
      console.log("✅ Using OpenAI for Crypto.com AI Agent SDK");
      console.log("   Model: gpt-4o-mini (cheapest model - $0.075/$0.30 per 1M tokens)");
      queryOptions = {
        openAI: {
          apiKey: openAIApiKey,
          model: "gpt-4o-mini", // Cheapest OpenAI model: $0.075 input / $0.30 output per 1M tokens
        },
        chainId: 338, // Cronos Testnet
        explorerKeys: {
          cronosTestnetKey: cronosTestnetExplorerKey || undefined,
        },
      };
    } else if (geminiApiKey) {
      // Gemini is available but Node.js SDK doesn't support it
      // The SDK TypeScript interface only defines `openAI`, not `gemini`
      // Gemini support exists in REST API/Python SDK, but not Node.js SDK
      console.warn("⚠️ Node.js AI Agent SDK only supports OpenAI, not Gemini");
      console.warn("   Set OPENAI_API_KEY in .env to use AI Agent SDK");
      console.warn("   Falling back to Developer Platform SDK for all queries");
      console.warn("   (This is fine - Developer Platform SDK works perfectly)");
      // Return null so we skip AI Agent SDK and use fallbacks
      return null;
    } else {
      console.warn("⚠️ Crypto.com AI Agent SDK not fully configured. Blockchain queries will not work.");
      console.warn("   Set OPENAI_API_KEY in .env to enable AI Agent SDK");
      console.warn("   Also set CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY");
      console.warn("   (Note: GEMINI_API_KEY is used for agent responses, not AI Agent SDK)");
      return null;
    }
    
    // Add Developer Platform API key to query options
    // According to documentation, the SDK expects blockchain_config.api_key
    console.log("✅ Adding Developer Platform API key to AI Agent SDK options");
    // The correct format according to Crypto.com documentation
    queryOptions.blockchain_config = {
      api_key: developerPlatformApiKey, // Use api_key (snake_case), not 'api-key'
    };
    
    // Also try alternative formats as fallback (in case SDK version differs)
    queryOptions.blockchainConfig = {
      api_key: developerPlatformApiKey,
    };
    queryOptions.developerPlatformApiKey = developerPlatformApiKey;

    const client = createClient(queryOptions);
    console.log(`[SDK] ✅ Client created successfully`);
    console.log(`[SDK] Client structure:`, {
      hasAgent: !!client?.agent,
      hasGenerateQuery: !!(client?.agent?.generateQuery),
      clientKeys: client ? Object.keys(client) : [],
    });
    return client;
  } catch (error) {
    console.warn("⚠️ Crypto.com AI Agent SDK not available:", error instanceof Error ? error.message : String(error));
    console.warn("   Install with: npm install @crypto.com/ai-agent-client");
    return null;
  }
}

/**
 * Initialize MCP Client for Crypto.com Market Data
 * Uses @modelcontextprotocol/sdk to connect to MCP Server
 * Track 2 Requirement: Market Data MCP Server Integration
 */
async function initMCPClient(): Promise<any> {
  if (mcpClientInitialized && mcpClient) {
    return mcpClient;
  }

  if (mcpClientInitialized && !mcpClient) {
    return null; // Already attempted and failed
  }

  try {
    const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
    const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
    
    console.log(`[MCP] Connecting to Crypto.com Market Data MCP Server: ${MCP_MARKET_DATA_URL}`);
    
    const transport = new StreamableHTTPClientTransport(new URL(MCP_MARKET_DATA_URL));
    const client = new Client({ 
      name: "agentmarket-backend", 
      version: "1.0.0" 
    });

    await client.connect(transport);
    console.log("[MCP] ✅ Connected to Crypto.com Market Data MCP Server");
    
    mcpClient = client;
    mcpClientInitialized = true;
    return client;
  } catch (error) {
    console.error("[MCP] ❌ Failed to initialize MCP client:", error);
    console.log("[MCP] ⚠️ MCP Server unavailable, will use REST API fallback");
    mcpClientInitialized = true; // Mark as attempted to avoid retry loops
    mcpClient = null;
    return null;
  }
}

/**
 * Fetch market data using Crypto.com Market Data MCP Server
 * Priority: MCP Server → REST API fallback
 */
async function fetchMarketDataViaMCP(symbol: string): Promise<any> {
  try {
    const client = await initMCPClient();
    if (!client) {
      return null; // Will fallback to REST API
    }

    // Normalize symbol
    const symbolMap: Record<string, string> = {
      "BITCOIN": "BTC",
      "ETHEREUM": "ETH",
      "SOLANA": "SOL",
      "CARDANO": "ADA",
      "POLKADOT": "DOT",
    };
    
    const normalizedSymbol = symbolMap[symbol.toUpperCase()] || symbol.toUpperCase();
    
    console.log(`[MCP] Fetching market data for ${normalizedSymbol} via MCP Server...`);

    // List available tools first
    let tools;
    try {
      tools = await client.listTools();
      console.log(`[MCP] Available tools: ${tools.tools?.map((t: any) => t.name).join(", ") || "none"}`);
    } catch (toolError) {
      console.error("[MCP] Failed to list tools:", toolError);
      return null;
    }

    // Try to find the best tool for price queries
    // Prefer get_ticker (most common), then get_mark_price, then get_index_price
    let priceTool = tools.tools?.find((t: any) => t.name === "get_ticker");
    if (!priceTool) {
      priceTool = tools.tools?.find((t: any) => t.name === "get_mark_price");
    }
    if (!priceTool) {
      priceTool = tools.tools?.find((t: any) => 
        t.name.toLowerCase().includes("ticker") ||
        t.name.toLowerCase().includes("price")
      );
    }

    if (priceTool) {
      console.log(`[MCP] Using tool: ${priceTool.name}`);
      try {
        // Format instrument name (e.g., "BTC_USD" for Crypto.com Exchange format)
        const instrumentName = `${normalizedSymbol}_USD`;
        
        // Call the tool with correct parameter name
        const result = await client.callTool({
          name: priceTool.name,
          arguments: { 
            instrument_name: instrumentName, // MCP tools use instrument_name
          },
        });

        if (result && result.content && result.content.length > 0) {
          const content = result.content[0];
          let data;
          
          if (typeof content === 'string') {
            try {
              data = JSON.parse(content);
            } catch {
              // If not JSON, try to extract data from text
              data = { text: content };
            }
          } else {
            data = content;
          }
          
          console.log(`[MCP] ✅ Market data fetched via MCP Server`);
          
          // Extract price data from various possible formats
          const price = data.price || data.last_price || data.current_price || 
                       data.text?.match(/\$?([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, '');
          
          return {
            symbol: normalizedSymbol,
            price: price || "N/A",
            price24hAgo: data.price_24h_ago || data.prev_price_24h || "N/A",
            change24h: data.change_24h || data.price_change_percent_24h || "N/A",
            volume24h: data.volume_24h || data.base_volume_24h || "N/A",
            high24h: data.high_24h || data.high_price_24h || "N/A",
            low24h: data.low_24h || data.low_price_24h || "N/A",
            timestamp: Date.now(),
            source: "Crypto.com Market Data MCP Server",
            rawData: data, // Include raw data for debugging
          };
        }
      } catch (toolCallError) {
        console.error(`[MCP] Error calling tool ${priceTool.name}:`, toolCallError);
        return null;
      }
    } else {
      console.log("[MCP] No price tool found, trying resources...");
    }

    // If no specific tool, try reading as resource
    try {
      const resources = await client.listResources();
      const priceResource = resources.resources?.find((r: any) => 
        r.uri?.includes(normalizedSymbol.toLowerCase())
      );

      if (priceResource) {
        const resource = await client.readResource({ uri: priceResource.uri });
        if (resource && resource.contents && resource.contents.length > 0) {
          const content = resource.contents[0];
          const data = typeof content === 'string' ? JSON.parse(content) : content;
          
          return {
            symbol: normalizedSymbol,
            price: data.price || data.last_price,
            timestamp: Date.now(),
            source: "Crypto.com Market Data MCP Server",
          };
        }
      }
    } catch (resourceError) {
      // Resource read failed, continue to fallback
      console.log("[MCP] Resource read failed, using fallback");
    }

    return null; // Will fallback to REST API
  } catch (error) {
    console.error(`[MCP] Error fetching market data via MCP:`, error);
    return null; // Will fallback to REST API
  }
}

/**
 * Fetch market data from Crypto.com
 * Priority: MCP Server → REST API fallback
 * Uses Crypto.com Market Data MCP Server (Track 2 requirement)
 */
export async function fetchMarketData(symbol: string): Promise<any> {
  try {
    // Normalize symbol (BTC -> BTC, bitcoin -> BTC, etc.)
    const symbolMap: Record<string, string> = {
      "BITCOIN": "BTC",
      "ETHEREUM": "ETH",
      "SOLANA": "SOL",
      "CARDANO": "ADA",
      "POLKADOT": "DOT",
    };
    
    const normalizedSymbol = symbolMap[symbol.toUpperCase()] || symbol.toUpperCase();
    
    // Priority 1: Try MCP Server first (Track 2 requirement)
    console.log(`[Market Data] Attempting to fetch ${normalizedSymbol} via MCP Server...`);
    const mcpData = await fetchMarketDataViaMCP(normalizedSymbol);
    
    if (mcpData && !mcpData.error) {
      console.log(`[Market Data] ✅ Successfully fetched via MCP Server`);
      return mcpData;
    }

    // Priority 2: Fallback to REST API
    console.log(`[Market Data] MCP Server unavailable, using REST API fallback...`);
    const response = await fetch(`https://api.crypto.com/v2/public/get-ticker?instrument_name=${normalizedSymbol}_USD`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json() as any;
      const ticker = data.result?.data?.[0];
      
      if (ticker) {
        return {
          symbol: normalizedSymbol,
          price: ticker.last_price,
          price24hAgo: ticker.prev_price_24h,
          change24h: ticker.price_change_percent_24h,
          volume24h: ticker.base_volume_24h,
          high24h: ticker.high_price_24h,
          low24h: ticker.low_price_24h,
          timestamp: Date.now(),
          source: "Crypto.com Exchange API (REST fallback)",
        };
      }
    }

    // Error case
    return {
      symbol: normalizedSymbol,
      error: "Market data not available",
      note: "Please check the symbol and try again",
      source: "Crypto.com Market Data",
    };
  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error);
    return {
      symbol: symbol.toUpperCase(),
      error: "Failed to fetch market data",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Query block information using RPC
 * Handles latest block, block by number queries
 */
async function queryBlockInfoViaRPC(query: string): Promise<string> {
  try {
    const { ethers } = require("ethers");
    const cronosRpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
    const queryLower = query.toLowerCase();
    
    console.log(`[SDK] Using RPC call to ${cronosRpcUrl} for block query`);
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(cronosRpcUrl);
    
    // Check if query is for latest block
    if (queryLower.includes('latest') || queryLower.includes('current') || queryLower.includes('most recent')) {
      try {
        const blockNumber = await provider.getBlockNumber();
        const block = await provider.getBlock(blockNumber);
        
        console.log(`[SDK] ✅ Latest block fetched via RPC: ${blockNumber}`);
        
        const timestamp = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : 'unknown';
        const transactionCount = block?.transactions?.length || 0;
        const gasUsed = block?.gasUsed?.toString() || 'N/A';
        const gasLimit = block?.gasLimit?.toString() || 'N/A';
        
        return `Latest Block Information:\n` +
               `- Block Number: ${blockNumber}\n` +
               `- Timestamp: ${timestamp}\n` +
               `- Transaction Count: ${transactionCount}\n` +
               `- Gas Used: ${gasUsed}\n` +
               `- Gas Limit: ${gasLimit}\n` +
               `- Hash: ${block?.hash || 'N/A'}\n` +
               `\nView on Cronoscan: https://testnet.cronoscan.com/block/${blockNumber}`;
      } catch (error: any) {
        console.error("[SDK] ❌ Error fetching latest block via RPC:", error);
        return `Error fetching latest block: ${error?.message || String(error)}`;
      }
    }
    
    // Check if query is for specific block number
    const blockNumberMatch = query.match(/\b(\d+)\b/);
    if (blockNumberMatch) {
      try {
        const blockNumber = parseInt(blockNumberMatch[1], 10);
        const block = await provider.getBlock(blockNumber);
        
        if (!block) {
          return `Block ${blockNumber} not found. It may not exist yet or the number is invalid.`;
        }
        
        console.log(`[SDK] ✅ Block ${blockNumber} fetched via RPC`);
        
        const timestamp = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : 'unknown';
        const transactionCount = block?.transactions?.length || 0;
        const gasUsed = block?.gasUsed?.toString() || 'N/A';
        const gasLimit = block?.gasLimit?.toString() || 'N/A';
        
        return `Block ${blockNumber} Information:\n` +
               `- Block Number: ${blockNumber}\n` +
               `- Timestamp: ${timestamp}\n` +
               `- Transaction Count: ${transactionCount}\n` +
               `- Gas Used: ${gasUsed}\n` +
               `- Gas Limit: ${gasLimit}\n` +
               `- Hash: ${block?.hash || 'N/A'}\n` +
               `- Parent Hash: ${block?.parentHash || 'N/A'}\n` +
               `\nView on Cronoscan: https://testnet.cronoscan.com/block/${blockNumber}`;
      } catch (error: any) {
        console.error("[SDK] ❌ Error fetching block via RPC:", error);
        return `Error fetching block: ${error?.message || String(error)}`;
      }
    }
    
    // Default: get latest block
    try {
      const blockNumber = await provider.getBlockNumber();
      return `Latest block number on Cronos: ${blockNumber}\n` +
             `View on Cronoscan: https://testnet.cronoscan.com/block/${blockNumber}`;
    } catch (error: any) {
      return `Error fetching block information: ${error?.message || String(error)}`;
    }
  } catch (error: any) {
    console.error("[SDK] ❌ Error in RPC block query:", error);
    return `Error: ${error?.message || String(error)}`;
  }
}

/**
 * Query blockchain using direct RPC calls (final fallback)
 * Uses ethers.js to query Cronos RPC directly
 */
async function queryBlockchainViaRPC(query: string): Promise<string> {
  try {
    const { ethers } = require("ethers");
    const cronosRpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
    
    // Extract address from query (look for 0x... pattern)
    const addressMatch = query.match(/0x[a-fA-F0-9]{40}/);
    if (!addressMatch) {
      return "Could not find a valid Ethereum address in the query. Please provide an address starting with 0x.";
    }
    
    const address = addressMatch[0];
    console.log(`[SDK] Using direct RPC call to ${cronosRpcUrl} for address: ${address}`);
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(cronosRpcUrl);
    
    // Check if query is about balance
    if (query.toLowerCase().includes('balance')) {
      try {
        const balanceWei = await provider.getBalance(address);
        const balanceCro = ethers.formatEther(balanceWei);
        console.log(`[SDK] ✅ Balance fetched via RPC: ${balanceCro} CRO`);
        
        return `Balance for address ${address}: ${balanceCro} CRO (${balanceWei.toString()} wei)`;
      } catch (balanceError: any) {
        console.error("[SDK] ❌ Error fetching balance via RPC:", balanceError);
        return `Error fetching balance via RPC: ${balanceError?.message || String(balanceError)}`;
      }
    }
    
    // Check if query is about transactions
    if (query.toLowerCase().includes('transaction') || query.toLowerCase().includes('tx')) {
      try {
        // Get transaction count (nonce)
        const txCount = await provider.getTransactionCount(address);
        const blockNumber = await provider.getBlockNumber();
        
        console.log(`[SDK] ✅ Transaction count fetched via RPC: ${txCount} transactions`);
        
        // Try to get recent block to show some context
        let recentBlockInfo = "";
        try {
          const recentBlock = await provider.getBlock(blockNumber);
          recentBlockInfo = `Latest block: ${blockNumber} (${recentBlock?.timestamp ? new Date(recentBlock.timestamp * 1000).toISOString() : 'unknown'})`;
        } catch (e) {
          // Ignore block fetch errors
        }
        
        return `Transaction information for address ${address}:\n` +
               `- Total transaction count: ${txCount}\n` +
               `${recentBlockInfo ? `- ${recentBlockInfo}\n` : ''}` +
               `\nNote: For detailed transaction history, please visit https://testnet.cronoscan.com/address/${address}`;
      } catch (txError: any) {
        console.error("[SDK] ❌ Error fetching transaction info via RPC:", txError);
        return `Error fetching transaction info via RPC: ${txError?.message || String(txError)}. ` +
               `You can check transactions at https://testnet.cronoscan.com/address/${address}`;
      }
    }
    
    // Default: return address info with helpful links
    return `Address ${address} found in query. Query completed via direct RPC.\n` +
           `You can view this address on Cronoscan: https://testnet.cronoscan.com/address/${address}`;
  } catch (error: any) {
    console.error("[SDK] ❌ Error in RPC blockchain query:", error);
    return `Error: ${error?.message || String(error)}`;
  }
}

/**
 * Query blockchain using Developer Platform API endpoint directly
 * Uses the REST API endpoint: https://developer-platform-api.crypto.com/api/v1/cdc-developer-platform/token/native-token-balance
 */
async function queryBlockchainViaAPI(query: string): Promise<string> {
  try {
    const developerPlatformApiKey = process.env.CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY || process.env.CRONOS_TESTNET_EXPLORER_KEY;
    
    if (!developerPlatformApiKey) {
      console.log("[SDK] No Developer Platform API key, falling back to RPC...");
      return await queryBlockchainViaRPC(query);
    }
    
    // Extract address from query (look for 0x... pattern)
    const addressMatch = query.match(/0x[a-fA-F0-9]{40}/);
    if (!addressMatch) {
      return "Could not find a valid Ethereum address in the query. Please provide an address starting with 0x.";
    }
    
    const address = addressMatch[0];
    console.log(`[SDK] Using Developer Platform API endpoint directly for address: ${address}`);
    
    // Check if query is about balance
    if (query.toLowerCase().includes('balance')) {
      try {
        const apiUrl = `https://developer-platform-api.crypto.com/api/v1/cdc-developer-platform/token/native-token-balance?walletAddress=${address}`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${developerPlatformApiKey}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        console.log(`[SDK] ✅ Balance fetched via Developer Platform API:`, data);
        
        if (data && data.status === 'Success' && data.data && data.data.balance) {
          return `Balance for address ${address}: ${data.data.balance}`;
        } else if (data && data.status === 'Success') {
          return `Balance query successful for ${address}. Response: ${JSON.stringify(data)}`;
        } else {
          return `Balance query completed. Status: ${data?.status || 'unknown'}, Data: ${JSON.stringify(data)}`;
        }
      } catch (apiError: any) {
        console.error("[SDK] ❌ Error fetching balance via Developer Platform API:", apiError);
        console.log("[SDK] Falling back to direct RPC call...");
        // Fallback to RPC
        return await queryBlockchainViaRPC(query);
      }
    }
    
    // Default: return address info
    return `Address ${address} found in query. Use Developer Platform API methods to query specific data.`;
  } catch (error: any) {
    console.error("[SDK] ❌ Error in API blockchain query:", error);
    console.log("[SDK] Falling back to direct RPC call...");
    // Fallback to RPC
    return await queryBlockchainViaRPC(query);
  }
}

/**
 * Execute blockchain query using Crypto.com Developer Platform Client SDK directly
 * Uses SDK methods (Wallet.balance()) which handle authentication internally
 * No RPC fallback - throws error if SDK fails
 */
async function queryBlockchainDirectly(query: string): Promise<string> {
  const sdk = initDeveloperPlatformSDK();
  if (!sdk) {
    throw new Error("Developer Platform SDK not available - API key missing");
  }
  
  const { Wallet } = sdk;
  
  // Extract address from query (look for 0x... pattern)
  const addressMatch = query.match(/0x[a-fA-F0-9]{40}/);
  if (!addressMatch) {
    throw new Error("Could not find a valid Ethereum address in the query. Please provide an address starting with 0x.");
  }
  
  const address = addressMatch[0];
  console.log(`[SDK] Using Developer Platform Client SDK (Wallet.balance) for address: ${address}`);
  
  // Use SDK method - it handles authentication internally
  const balance = await Wallet.balance(address);
  console.log(`[SDK] ✅ Balance fetched via Developer Platform SDK:`, balance);
  
  if (balance && balance.data && balance.data.balance) {
    return `Balance for address ${address}: ${balance.data.balance}`;
  } else if (balance && balance.status === 'Success') {
    return `Balance query successful for ${address}. Response: ${JSON.stringify(balance)}`;
  } else if (balance && balance.status) {
    return `Balance query completed. Status: ${balance.status}, Response: ${JSON.stringify(balance)}`;
  } else {
    return `Balance query completed. Response: ${JSON.stringify(balance)}`;
  }
}

/**
 * Initialize Developer Platform Client SDK
 */
function initDeveloperPlatformSDK(): { Client: any; Transaction: any; Token: any; Wallet: any } | null {
  try {
    const { Client, Transaction, Token, Wallet } = require("@crypto.com/developer-platform-client");
    const developerPlatformApiKey = process.env.CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY || process.env.CRONOS_TESTNET_EXPLORER_KEY;
    
    if (!developerPlatformApiKey) {
      console.log("[SDK] No Developer Platform API key available");
      return null;
    }
    
    // Make sure Client is initialized
    try {
      Client.init({
        apiKey: developerPlatformApiKey,
      });
    } catch (initError) {
      console.warn("[SDK] Client already initialized or init failed:", initError);
    }
    
    return { Client, Transaction, Token, Wallet };
  } catch (error) {
    console.error("[SDK] ❌ Failed to load Developer Platform SDK:", error);
    return null;
  }
}

/**
 * Query transactions using Developer Platform Client SDK Transaction module
 * Uses Transaction.getTransactionsByAddress() and Transaction.getTransactionCount()
 */
async function queryTransactionsViaSDK(query: string): Promise<string> {
  const sdk = initDeveloperPlatformSDK();
  if (!sdk) {
    throw new Error("Developer Platform SDK not available");
  }
  
  const { Transaction } = sdk;
  
  // Extract address from query (look for 0x... pattern)
  const addressMatch = query.match(/0x[a-fA-F0-9]{40}/);
  if (!addressMatch) {
    throw new Error("Could not find a valid Ethereum address in the query. Please provide an address starting with 0x.");
  }
  
  const address = addressMatch[0];
  console.log(`[SDK] Using Developer Platform Client SDK (Transaction module) for address: ${address}`);
  
  // Try to get transaction count first
  const txCount = await Transaction.getTransactionCount(address);
  console.log(`[SDK] ✅ Transaction count fetched via SDK: ${txCount}`);
  
  // Try to get recent transactions
  let transactionsInfo = "";
  try {
    const transactions = await Transaction.getTransactionsByAddress(address, { limit: 10 });
    if (transactions && transactions.data && Array.isArray(transactions.data) && transactions.data.length > 0) {
      transactionsInfo = `\nRecent transactions:\n`;
      transactions.data.slice(0, 5).forEach((tx: any, index: number) => {
        transactionsInfo += `${index + 1}. Hash: ${tx.hash || tx.transactionHash || 'N/A'}\n`;
        if (tx.blockNumber) transactionsInfo += `   Block: ${tx.blockNumber}\n`;
        if (tx.timestamp) transactionsInfo += `   Time: ${new Date(tx.timestamp * 1000).toISOString()}\n`;
      });
    }
  } catch (txListError) {
    console.log("[SDK] Could not fetch transaction list, but count is available");
  }
  
  return `Transaction information for address ${address}:\n` +
         `- Total transaction count: ${txCount}\n` +
         `${transactionsInfo}` +
         `\nFor detailed transaction history, visit: https://testnet.cronoscan.com/address/${address}`;
}

/**
 * Query transaction by hash using SDK
 */
async function queryTransactionByHash(query: string): Promise<string> {
  const sdk = initDeveloperPlatformSDK();
  if (!sdk) {
    throw new Error("Developer Platform SDK not available");
  }
  
  const { Transaction } = sdk;
  
  // Extract transaction hash from query (look for 0x... pattern, 66 chars)
  const hashMatch = query.match(/0x[a-fA-F0-9]{64}/);
  if (!hashMatch) {
    throw new Error("Could not find a valid transaction hash in the query. Please provide a hash starting with 0x.");
  }
  
  const hash = hashMatch[0];
  console.log(`[SDK] Using Developer Platform Client SDK (Transaction.getTransactionByHash) for hash: ${hash}`);
  
  const tx = await Transaction.getTransactionByHash(hash);
  console.log(`[SDK] ✅ Transaction fetched via SDK`);
  
  // Get transaction status
  let status = "unknown";
  try {
    const txStatus = await Transaction.getTransactionStatus(hash);
    status = txStatus?.status || txStatus?.data?.status || "unknown";
  } catch (e) {
    // Status might not be available
  }
  
  return `Transaction details for hash ${hash}:\n` +
         `- Status: ${status}\n` +
         `- Block: ${tx.blockNumber || 'Pending'}\n` +
         `- From: ${tx.from || 'N/A'}\n` +
         `- To: ${tx.to || 'N/A'}\n` +
         `- Value: ${tx.value || '0'}\n` +
         `- Gas: ${tx.gas || 'N/A'}\n` +
         `\nFull details: https://testnet.cronoscan.com/tx/${hash}`;
}

/**
 * Query gas price and fee data using SDK
 */
async function queryGasInfoViaSDK(query: string): Promise<string> {
  const sdk = initDeveloperPlatformSDK();
  if (!sdk) {
    throw new Error("Developer Platform SDK not available");
  }
  
  const { Transaction } = sdk;
  
  console.log(`[SDK] Using Developer Platform Client SDK (Transaction module) for gas info`);
  
  const gasPrice = await Transaction.getGasPrice();
  console.log(`[SDK] ✅ Gas price fetched via SDK`);
  
  let feeData = null;
  try {
    feeData = await Transaction.getFeeData();
    console.log(`[SDK] ✅ Fee data fetched via SDK`);
  } catch (e) {
    console.log("[SDK] Fee data not available");
  }
  
  let result = `Current gas information on Cronos:\n` +
               `- Gas Price: ${gasPrice || 'N/A'}\n`;
  
  if (feeData) {
    result += `- Max Fee Per Gas: ${feeData.maxFeePerGas || 'N/A'}\n`;
    result += `- Max Priority Fee Per Gas: ${feeData.maxPriorityFeePerGas || 'N/A'}\n`;
  }
  
  return result;
}

/**
 * Query token balance using SDK Token module
 */
async function queryTokenBalanceViaSDK(query: string): Promise<string> {
  const sdk = initDeveloperPlatformSDK();
  if (!sdk) {
    throw new Error("Developer Platform SDK not available");
  }
  
  const { Token } = sdk;
  
  // Extract address and token address from query
  const addresses = query.match(/0x[a-fA-F0-9]{40}/g);
  if (!addresses || addresses.length < 1) {
    throw new Error("Could not find a valid Ethereum address in the query.");
  }
  
  const walletAddress = addresses[0];
  const tokenAddress = addresses[1] || null; // Optional token address
  
  console.log(`[SDK] Using Developer Platform Client SDK (Token module) for address: ${walletAddress}`);
  
  if (tokenAddress) {
    // Specific ERC-20 token balance
    console.log(`[SDK] Fetching ERC-20 token balance for ${tokenAddress}...`);
    try {
      const balance = await Token.getERC20TokenBalance(walletAddress, tokenAddress);
      console.log(`[SDK] ✅ ERC-20 token balance fetched via SDK:`, balance);
      
      // Try to get token metadata for decimals
      let decimals = 18; // Default
      try {
        const metadata = await Token.getERC20Metadata(tokenAddress);
        if (metadata && metadata.data && metadata.data.decimals) {
          decimals = metadata.data.decimals;
        }
      } catch (e) {
        console.log(`[SDK] Could not fetch token metadata, using default decimals: ${decimals}`);
      }
      
      // Convert raw balance to human-readable
      const rawBalance = BigInt(balance?.data?.balance || balance || '0');
      const humanReadableBalance = Number(rawBalance) / Math.pow(10, decimals);
      
      return `ERC-20 Token Balance:\n` +
             `- Wallet: ${walletAddress}\n` +
             `- Token Contract: ${tokenAddress}\n` +
             `- Raw Balance: ${rawBalance.toString()}\n` +
             `- Balance: ${humanReadableBalance.toFixed(6)} tokens\n` +
             `- Decimals: ${decimals}`;
    } catch (error: any) {
      console.error(`[SDK] ❌ Error fetching ERC-20 token balance:`, error);
      throw new Error(`Failed to fetch token balance: ${error.message || 'Unknown error'}`);
    }
  } else {
    // Try to detect token name from query (USDC, USDT, etc.)
    const tokenName = query.match(/\b(USDC|USDT|ETH|BTC|CRO)\b/i)?.[0]?.toUpperCase();
    
    if (tokenName) {
      // For now, return a message that specific token queries need the token address
      return `To check ${tokenName} balance, please provide the token contract address.\n` +
             `Example: "What is the USDC balance of ${walletAddress}? Token address: 0x..."`;
    }
    
    // Get native token balance as fallback
    try {
      const nativeBalance = await Token.getNativeTokenBalance(walletAddress);
      console.log(`[SDK] ✅ Native token balance fetched via SDK`);
      return `Native token balance for address ${walletAddress}:\n` +
             `- Balance: ${nativeBalance?.data?.balance || nativeBalance || 'N/A'}\n` +
             `\nNote: For ERC-20 token balances, please provide the token contract address.`;
    } catch (e) {
      return `Token balance query for ${walletAddress}. Please specify a token contract address for ERC-20 token queries.`;
    }
  }
}

/**
 * Query token transfers using SDK Token module
 */
async function queryTokenTransfersViaSDK(query: string): Promise<string> {
  const sdk = initDeveloperPlatformSDK();
  if (!sdk) {
    throw new Error("Developer Platform SDK not available");
  }
  
  const { Token } = sdk;
  
  // Extract address from query
  const addressMatch = query.match(/0x[a-fA-F0-9]{40}/);
  if (!addressMatch) {
    throw new Error("Could not find a valid Ethereum address in the query.");
  }
  
  const address = addressMatch[0];
  console.log(`[SDK] Using Developer Platform Client SDK (Token.getTokenTransfers) for address: ${address}`);
  
  const transfers = await Token.getTokenTransfers(address, { limit: 10 });
  console.log(`[SDK] ✅ Token transfers fetched via SDK`);
  
  if (transfers && transfers.data && Array.isArray(transfers.data) && transfers.data.length > 0) {
    let result = `Token transfers for address ${address}:\n\n`;
    transfers.data.slice(0, 10).forEach((transfer: any, index: number) => {
      result += `${index + 1}. Token: ${transfer.tokenAddress || transfer.token || 'N/A'}\n`;
      result += `   Amount: ${transfer.amount || 'N/A'}\n`;
      result += `   From: ${transfer.from || 'N/A'}\n`;
      result += `   To: ${transfer.to || 'N/A'}\n`;
      if (transfer.blockNumber) result += `   Block: ${transfer.blockNumber}\n`;
      result += `\n`;
    });
    return result;
  }
  
  return `No token transfers found for address ${address}`;
}

/**
 * Create a new wallet using SDK Wallet module
 */
async function createWalletViaSDK(): Promise<string> {
  const sdk = initDeveloperPlatformSDK();
  if (!sdk) {
    throw new Error("Developer Platform SDK not available");
  }
  
  const { Wallet } = sdk;
  
  console.log(`[SDK] Using Developer Platform Client SDK (Wallet.create) to create new wallet`);
  
  const wallet = await Wallet.create();
  console.log(`[SDK] ✅ Wallet created via SDK`);
  
  if (wallet && wallet.status === 'Success' && wallet.data) {
    return `New wallet created successfully:\n` +
           `- Address: ${wallet.data.address}\n` +
           `- Private Key: ${wallet.data.privateKey}\n` +
           `- Mnemonic: ${wallet.data.mnemonic}\n\n` +
           `⚠️ IMPORTANT: Save this information securely. The private key and mnemonic will not be shown again.\n` +
           `⚠️ SECURITY: Never share your private key or mnemonic with anyone.`;
  }
  
  return `Wallet creation completed. Response: ${JSON.stringify(wallet, null, 2)}`;
}

/**
 * Execute blockchain query using Crypto.com SDKs
 * Priority: AI Agent SDK → Developer Platform SDK
 * No RPC fallback - let Gemini/AI handle responses if SDKs can't answer
 * 
 * Priority: AI Agent SDK → Developer Platform SDK (all modules)
 */
export async function executeBlockchainQuery(
  client: any,
  query: string
): Promise<string> {
  const queryLower = query.toLowerCase();
  
  // Check if this query type is well-supported by AI Agent SDK
  // AI Agent SDK works best for simple queries like:
  // - "Get balance of address X"
  // - "Get latest block"
  // - "Get transaction by hash"
  // It struggles with complex queries like:
  // - Token balance queries with contract addresses
  // - Specific parameter-heavy queries
  // Check if query is for specific block number (will fail with AI Agent SDK due to Explorer API limitation)
  const isSpecificBlockNumber = queryLower.includes('block') && query.match(/\b\d{6,}\b/); // Block with 6+ digit number (specific block)
  const isLatestBlock = queryLower.includes('latest block') || (queryLower.includes('block') && (queryLower.includes('latest') || queryLower.includes('current') || queryLower.includes('most recent')));
  
  const isSimpleQuery = 
    (queryLower.includes('balance') && !queryLower.includes('token') && !query.match(/0x[a-fA-F0-9]{40}.*0x[a-fA-F0-9]{40}/)) || // Simple balance, not token with contract
    (isLatestBlock) || // Latest block (works with AI Agent SDK)
    (queryLower.includes('transaction') && query.match(/0x[a-fA-F0-9]{64}/)); // Transaction by hash
  
  // Count how many addresses are in the query (wallet + token contract = complex)
  const addressMatches = query.match(/0x[a-fA-F0-9]{40}/g);
  const addressCount = addressMatches ? addressMatches.length : 0;
  
  const isComplexQuery = 
    (queryLower.includes('token') && queryLower.includes('balance') && addressCount >= 1) || // Token balance (any address)
    (queryLower.includes('token') && addressCount >= 2) || // Token query with wallet + contract address
    (queryLower.includes('erc20') || queryLower.includes('erc-20')) ||
    (queryLower.includes('gas price') || queryLower.includes('fee data')) ||
    (queryLower.includes('create wallet') || queryLower.includes('new wallet')) ||
    (queryLower.includes('token contract address') || queryLower.includes('token contract is')); // Explicit token contract mentions
  
  // Skip AI Agent SDK for specific block numbers - Explorer API doesn't support getBlockByNumber for this API key tier
  // Go straight to RPC which works reliably
  if (isSpecificBlockNumber && !isLatestBlock) {
    console.log("[SDK] ⚠️ Specific block number query detected - Explorer API getBlockByNumber not available for this API key tier");
    console.log("[SDK]   Skipping AI Agent SDK, using RPC directly (more reliable)");
  } else if (isComplexQuery) {
    console.log("[SDK] ⚠️ Complex query detected - skipping AI Agent SDK, using Developer Platform SDK directly");
  } else if (isSimpleQuery && client && client.agent && typeof client.agent.generateQuery === 'function') {
    // Priority 1: Try AI Agent SDK for simple queries only
    try {
      console.log(`[SDK] Attempting blockchain query via AI Agent SDK: "${query.substring(0, 50)}..."`);
      console.log(`[SDK] Client type: ${typeof client}, has agent: ${!!client.agent}`);
      
      const response = await client.agent.generateQuery(query);
      console.log(`[SDK] ✅ Query successful via AI Agent SDK, response type: ${typeof response}`);
      
      // Check if response indicates an error (403, Failed status, etc.)
      let responseText = "";
      if (response && response.text) {
        responseText = response.text;
      } else if (response && typeof response === 'string') {
        responseText = response;
      } else {
        responseText = JSON.stringify(response, null, 2);
      }
      
      // Check if the response contains errors (like 403 from Explorer API)
      if (response && typeof response === 'object') {
        const responseStr = JSON.stringify(response);
        const has403Error = responseStr.includes('403') || responseStr.includes('Forbidden') || 
            (response.hasErrors === true) || 
            (response.results && response.results.some((r: any) => r.status === 'Failed' && r.message?.includes('403')));
        
        if (has403Error) {
          console.log("[SDK] ⚠️ AI Agent SDK returned success but contains 403 error from Explorer API");
          console.log("[SDK]   This means Explorer API key may not have permission or is rate-limited");
          console.log("[SDK]   Falling back to RPC/Developer Platform SDK...");
          // Don't return the error response, let it fall through to fallback
          throw new Error("AI Agent SDK Explorer API returned 403 Forbidden");
        }
      }
      
      return responseText;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = error?.status || error?.statusCode || error?.response?.status;
      
      // Log full error details for debugging
      console.error("[SDK] ❌ Error executing blockchain query via AI Agent SDK:", {
        message: errorMessage,
        statusCode: statusCode,
        error: error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Try to extract more details from error response
      if (error?.response) {
        console.error("[SDK] Error response details:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
      }
      
      // Log specific error reasons
      if (statusCode === 400) {
        console.log("[SDK] ⚠️ 400 Bad Request - Possible causes:");
        console.log("[SDK]   1. API key not properly configured in blockchain_config.api_key");
        console.log("[SDK]   2. Query format not supported");
        console.log("[SDK]   3. Missing required parameters");
        console.log("[SDK]   4. Chain ID mismatch with explorer keys");
        console.log("[SDK]   Trying Developer Platform SDK instead...");
      } else if (statusCode === 401) {
        console.log("[SDK] ⚠️ 401 Unauthorized - API key authentication issue");
        console.log("[SDK]   Check: CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY is valid");
      } else if (statusCode === 429) {
        console.log("[SDK] ⚠️ 429 Rate Limited - Too many requests");
      } else if (statusCode === 403 || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        console.log("[SDK] ⚠️ 403 Forbidden - Explorer API access denied");
        console.log("[SDK]   Possible causes:");
        console.log("[SDK]   1. Explorer API key doesn't have permission for this endpoint");
        console.log("[SDK]   2. Explorer API key is invalid or expired");
        console.log("[SDK]   3. Rate limiting or IP restrictions");
        console.log("[SDK]   For block queries, will try RPC fallback...");
      }
      
      // Continue to Developer Platform SDK or RPC
      console.log("[SDK] ⚠️ AI Agent SDK failed, trying fallback...");
    }
  } else {
    if (!client || !client.agent) {
      console.log("[SDK] No AI Agent client available, trying Developer Platform SDK...");
    } else {
      console.log("[SDK] Query not suitable for AI Agent SDK, using Developer Platform SDK...");
    }
  }

  // Priority 2: Try Developer Platform Client SDK (all available modules)
  try {
    // Balance queries
    if (queryLower.includes('balance') && !queryLower.includes('token')) {
      console.log("[SDK] Trying Developer Platform Client SDK (Wallet.balance)...");
      return await queryBlockchainDirectly(query);
    }
    
    // Transaction queries
    if (queryLower.includes('transaction') || queryLower.includes('tx')) {
      // Check if it's a transaction hash query
      if (query.match(/0x[a-fA-F0-9]{64}/)) {
        console.log("[SDK] Trying Developer Platform Client SDK (Transaction.getTransactionByHash)...");
        return await queryTransactionByHash(query);
      }
      // Otherwise, it's a transaction list query
      console.log("[SDK] Trying Developer Platform Client SDK (Transaction module)...");
      return await queryTransactionsViaSDK(query);
    }
    
    // Block queries (latest block, block by number) - use RPC directly for specific blocks, or as fallback
    if (queryLower.includes('block') || queryLower.includes('latest block')) {
      console.log("[SDK] Trying RPC for block query (getBlockNumber/getBlock)...");
      return await queryBlockInfoViaRPC(query);
    }
    
    // Gas price/fee queries
    if (queryLower.includes('gas') || queryLower.includes('fee')) {
      console.log("[SDK] Trying Developer Platform Client SDK (Transaction.getGasPrice/getFeeData)...");
      return await queryGasInfoViaSDK(query);
    }
    
    // Token balance queries
    if (queryLower.includes('token') && queryLower.includes('balance')) {
      console.log("[SDK] Trying Developer Platform Client SDK (Token.getERC20TokenBalance)...");
      return await queryTokenBalanceViaSDK(query);
    }
    
    // Token transfer queries
    if (queryLower.includes('token') && (queryLower.includes('transfer') || queryLower.includes('transfer'))) {
      console.log("[SDK] Trying Developer Platform Client SDK (Token.getTokenTransfers)...");
      return await queryTokenTransfersViaSDK(query);
    }
    
    // Wallet creation queries
    if (queryLower.includes('create') && (queryLower.includes('wallet') || queryLower.includes('address'))) {
      console.log("[SDK] Trying Developer Platform Client SDK (Wallet.create)...");
      return await createWalletViaSDK();
    }
    
    // If query contains an address but we don't know what to do, try balance as default
    if (query.match(/0x[a-fA-F0-9]{40}/)) {
      console.log("[SDK] Address detected but query type unclear, trying balance query...");
      return await queryBlockchainDirectly(query);
    }
    
    // If no SDK can handle it, return error for AI to handle
    throw new Error("Query type not recognized. Please specify: balance, transaction, token balance, gas price, create wallet, etc.");
    
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SDK] ❌ Developer Platform SDK failed:", errorMessage);
    
    // Return error message - let Gemini/AI handle the response
    return `Unable to fetch blockchain data via SDK: ${errorMessage}. ` +
           `Please rephrase your query or specify what type of data you need (balance, transactions, token balance, etc.).`;
  }
}

/**
 * Build enhanced system prompt with tool instructions
 */
export function buildEnhancedPrompt(
  basePrompt: string,
  tools: AgentTools,
  agentDescription: string
): string {
  let enhancedPrompt = basePrompt;

  if (tools.hasBlockchainAccess) {
    enhancedPrompt += `\n\n## Available Tools:
- **Blockchain Query**: You can query Cronos EVM blockchain data (balances, transactions, blocks, contracts)
- **Balance Check**: Check token balances for any address
- **Transaction Lookup**: Look up transaction details by hash
- **Contract Interaction**: Query smart contract state

When users ask about blockchain data, use these tools to fetch real on-chain information.
Example: "Check balance of 0x..." → Use blockchain_query tool
Example: "What's the latest block?" → Use blockchain_query tool
`;
  }

  if (tools.hasMarketDataAccess) {
    enhancedPrompt += `\n\n## Available Tools:
- **Market Data**: Access real-time cryptocurrency prices and market data
- **Price Lookup**: Get current prices for any cryptocurrency
- **Volume Analysis**: Get trading volume and market statistics

When users ask about prices or market data, use these tools to fetch real-time information.
Example: "What's the price of Bitcoin?" → Use market_data tool
Example: "Show me ETH volume" → Use market_data tool
`;
  }

  if (tools.hasSwapAccess) {
    const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
    const isTestnet = rpcUrl.includes("evm-t3") || rpcUrl.includes("testnet");
    const network = isTestnet ? "Cronos Testnet" : "Cronos Mainnet";
    
    enhancedPrompt += `\n\n## Available Tools:
- **VVS Swap**: Execute token swaps on VVS Finance DEX (${network})
- **Token Swap**: Swap tokens on Cronos using VVS Finance
- **Get Swap Quote**: Get swap quotes before executing

## Swap Instructions:
When users request token swaps:
1. Identify the tokens to swap (e.g., "swap 100 CRO for USDC")
2. Inform them about the network: ${network}
3. Explain that swaps require x402 payment ($0.15 per swap)
4. Guide them to use the swap interface or provide swap details
${isTestnet ? "5. Note: VVS Finance may use mock mode on testnet for demonstration\n" : "5. Note: Real swaps execute on VVS Finance Mainnet\n"}
6. You can help them get quotes and understand swap mechanics

Example: "I want to swap 100 CRO for USDC" → Explain the process, network, and guide them
`;
  }

  if (!tools.hasBlockchainAccess && !tools.hasMarketDataAccess && !tools.hasSwapAccess) {
    enhancedPrompt += `\n\n## Note:
This agent focuses on text analysis and generation. It does not have access to real-time blockchain or market data.
If users ask for live data, inform them that this agent specializes in: ${agentDescription}
`;
  }

  // Add focus enforcement
  enhancedPrompt += `\n\n## Focus Enforcement:
- You MUST stay focused on your specialization: ${agentDescription}
- If a question is NOT related to your specialization, politely decline and explain what you can help with
- DO NOT answer generic questions outside your domain
- DO NOT act as a general-purpose assistant
- STAY ON TOPIC: ${agentDescription}
`;

  return enhancedPrompt;
}
