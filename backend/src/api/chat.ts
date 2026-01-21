import { Router, Request, Response } from "express";
import { verifyPayment, settlePayment, generatePaymentRequiredResponse } from "../x402/facilitator";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { executeAgent } from "../agent-engine/executor";
import { getAgentFromContract, executeAgentOnContract, verifyExecutionOnContract } from "../lib/contract";
import { db } from "../lib/database";
import { ethers } from "ethers";
import { determineAgentTools, fetchMarketData, executeBlockchainQuery, createCryptoComClient } from "../agent-engine/tools";
import { releasePaymentToDeveloper } from "../lib/contract";
import { getVVSQuote, getTokenAddress } from "../lib/vvs-finance";

const router = Router();

/**
 * Unified chat endpoint - automatically routes to right tools
 * POST /api/chat
 */
import { validateAgentInputMiddleware } from "../middleware/validation";
import { chatRateLimit } from "../middleware/rateLimit";

router.post("/", chatRateLimit, validateAgentInputMiddleware, async (req: Request, res: Response) => {
  try {
    const { input, paymentHash } = req.body;

    console.log(`\n[Chat] ========================================`);
    console.log(`[Chat] 📨 New chat request received`);
    console.log(`[Chat] Input: "${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"`);
    console.log(`[Chat] ========================================\n`);

    if (!input) {
      return res.status(400).json({ error: "Input required" });
    }

    // Use a unified agent ID (we'll use agent #1 as the base)
    const UNIFIED_AGENT_ID = 1;
    const contractAgent = await getAgentFromContract(UNIFIED_AGENT_ID);
    if (!contractAgent) {
      return res.status(404).json({ error: "Unified agent not found" });
    }

    const agentPrice = Number(contractAgent.pricePerExecution) / 1_000_000;
    const escrowAddress = process.env.AGENT_ESCROW_ADDRESS || "0x4352F2319c0476607F5E1cC9FDd568246074dF14";

    // Check for payment
    const paymentHeader = req.headers["x-payment"] || 
                          req.headers["x-payment-signature"] || 
                          req.headers["payment-signature"];

    if (!paymentHash && !paymentHeader) {
      const paymentRequired = await generatePaymentRequiredResponse({
        url: req.url || "",
        description: `Chat message`,
        priceUsd: agentPrice,
        payTo: escrowAddress,
        testnet: true,
      });
      return res.status(402).json({
        error: "Payment required",
        paymentRequired: paymentRequired,
      });
    }

    // Parse and verify payment
    const paymentHeaderValue = Array.isArray(paymentHeader) 
      ? paymentHeader[0] 
      : paymentHeader;
    
    if (!paymentHeaderValue || typeof paymentHeaderValue !== "string") {
      return res.status(402).json({
        error: "Payment signature header missing",
        paymentRequired: true,
      });
    }

    let paymentPayload;
    try {
      paymentPayload = decodePaymentSignatureHeader(paymentHeaderValue);
    } catch (parseError) {
      return res.status(402).json({
        error: "Invalid payment signature format",
        details: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }

    // Verify payment
    let verification;
    try {
      verification = await verifyPayment(paymentPayload, {
        priceUsd: agentPrice,
        payTo: escrowAddress,
        testnet: true,
      }, paymentHeaderValue);
    } catch (verifyError) {
      return res.status(402).json({
        error: "Payment verification failed",
        details: verifyError instanceof Error ? verifyError.message : String(verifyError),
      });
    }

    if (!verification.valid) {
      return res.status(402).json({
        error: verification.invalidReason || "Payment verification failed",
        paymentRequired: true,
      });
    }

    // Convert paymentHash to bytes32
    let paymentHashBytes32: string;
    if (paymentHash && paymentHash.startsWith("0x")) {
      paymentHashBytes32 = paymentHash;
    } else if (paymentPayload && 'hash' in paymentPayload && paymentPayload.hash) {
      paymentHashBytes32 = paymentPayload.hash as string;
    } else {
      paymentHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(paymentHeaderValue || ""));
    }

    // Analyze user input to determine what tools/capabilities are needed
    const inputLower = input.toLowerCase();
    
    // Detect intent
    const needsMarketData = /(?:price|price of|current price|what's the price|how much is|trading at|market|volume|bitcoin|btc|ethereum|eth|crypto)/i.test(input);
    const needsBlockchain = /(?:balance|transaction|block|address|contract|on-chain|blockchain|wallet|0x[a-fA-F0-9]{40})/i.test(input);
    const needsSwap = /(?:swap|exchange|trade|convert|vvs|dex).*?(?:token|coin|crypto)/i.test(input);
    const needsContractAnalysis = /(?:contract|solidity|pragma|function|analyze|audit|vulnerability|security|bug)/i.test(input);
    const needsContent = /(?:create|generate|write|tweet|post|content|marketing|copy)/i.test(input);

    // Build enhanced input with real data
    let enhancedInput = input;
    let realDataContext = "";

    // Fetch market data if needed
    if (needsMarketData) {
      // Improved regex to handle "price of Bitcoin" correctly
      // Try to match common patterns and extract symbol
      let symbol: string | null = null;
      
      // Pattern 1: "price of X" or "price of X coin"
      const priceOfPattern = /(?:price|cost)\s+of\s+([a-z]+)(?:\s+coin)?/i;
      const priceOfMatch = input.match(priceOfPattern);
      if (priceOfMatch) {
        symbol = priceOfMatch[1];
      } else {
        // Pattern 2: "X price" or "current X price"
        const pricePattern = /(?:current\s+)?([a-z]{2,10})\s+price/i;
        const priceMatch = input.match(pricePattern);
        if (priceMatch) {
          symbol = priceMatch[1];
        } else {
          // Pattern 3: Direct symbol mentions (BTC, ETH, etc.)
          const directSymbolPattern = /\b(bitcoin|btc|ethereum|eth|solana|sol|cardano|ada|polygon|matic|doge|dogecoin|shiba|shib)\b/i;
          const directMatch = input.match(directSymbolPattern);
          if (directMatch) {
            symbol = directMatch[1];
          }
        }
      }
      
      if (symbol) {
        // Normalize symbol (bitcoin -> BTC, ethereum -> ETH, etc.)
        const symbolMap: Record<string, string> = {
          "bitcoin": "BTC",
          "btc": "BTC",
          "ethereum": "ETH",
          "eth": "ETH",
          "solana": "SOL",
          "sol": "SOL",
          "cardano": "ADA",
          "ada": "ADA",
          "polygon": "MATIC",
          "matic": "MATIC",
          "doge": "DOGE",
          "dogecoin": "DOGE",
          "shiba": "SHIB",
          "shib": "SHIB",
        };
        
        const normalizedSymbol = symbolMap[symbol.toLowerCase()] || symbol.toUpperCase();
        console.log(`[Chat] Fetching market data for ${normalizedSymbol} (extracted from: ${symbol})...`);
        try {
          const marketData = await fetchMarketData(normalizedSymbol);
          if (marketData && !marketData.error) {
            realDataContext += `\n\n[Real Market Data for ${normalizedSymbol}]:\n${JSON.stringify(marketData, null, 2)}\n`;
            console.log(`[Chat] ✅ Market data fetched successfully`);
          }
        } catch (error) {
          console.warn(`[Chat] Failed to fetch market data:`, error);
        }
      }
    }

    // Fetch blockchain data if needed
    if (needsBlockchain) {
      // If query doesn't have an address, try to use payer's address for balance queries
      if (input.toLowerCase().includes("balance") && !input.toLowerCase().includes("0x") && verification.payerAddress) {
        console.log(`[Chat] ℹ️ No address in balance query, using payer's address: ${verification.payerAddress}`);
        enhancedInput = `${input} for address ${verification.payerAddress}`;
      }
      const blockchainClient = createCryptoComClient();
      if (blockchainClient) {
        console.log(`[Chat] 🔗 Detected blockchain query, using Crypto.com AI Agent SDK...`);
        console.log(`[Chat] 📡 SDK Status: ACTIVE - Querying Cronos blockchain via Crypto.com AI Agent SDK`);
        try {
          // Use enhancedInput which may include payer's address
          const blockchainQuery = enhancedInput.includes("for address") ? enhancedInput : input;
          const blockchainResult = await executeBlockchainQuery(blockchainClient, blockchainQuery);
          if (blockchainResult && !blockchainResult.includes("not available") && !blockchainResult.includes("Error:") && !blockchainResult.includes("Could not find") && !blockchainResult.includes("403") && !blockchainResult.includes("Forbidden")) {
            realDataContext += `\n\n[Real Blockchain Data - Fetched via Crypto.com AI Agent SDK]:\n${blockchainResult}\n`;
            console.log(`[Chat] ✅ Blockchain data fetched successfully via Crypto.com AI Agent SDK`);
            console.log(`[Chat] 📊 SDK Result: ${blockchainResult.substring(0, 100)}...`);
          } else {
            console.warn(`[Chat] ⚠️ SDK returned error or unavailable: ${blockchainResult}`);
            // Check if it's a 403 error from Explorer API - this means we should try RPC fallback
            if (blockchainResult && (blockchainResult.includes("403") || blockchainResult.includes("Forbidden") || blockchainResult.includes("status code 403"))) {
              console.log(`[Chat] 🔄 AI Agent SDK got 403 from Explorer API, trying RPC fallback for block queries...`);
              // For block queries, try RPC directly
              if (blockchainQuery.toLowerCase().includes('block')) {
                try {
                  const { queryBlockInfoViaRPC } = require("./agent-engine/tools");
                  const rpcResult = await queryBlockInfoViaRPC(blockchainQuery);
                  if (rpcResult && !rpcResult.includes("Error:")) {
                    realDataContext += `\n\n[Real Blockchain Data - Fetched via RPC (AI Agent SDK Explorer API unavailable)]:\n${rpcResult}\n`;
                    console.log(`[Chat] ✅ Block data fetched successfully via RPC fallback`);
                  }
                } catch (rpcError) {
                  console.warn(`[Chat] ⚠️ RPC fallback also failed:`, rpcError);
                }
              }
            }
            // If SDK couldn't find address, add helpful note
            if (blockchainResult && blockchainResult.includes("Could not find")) {
              realDataContext += `\n\nNote: Please include a valid Ethereum address (starting with 0x) in your query, or the system will use your wallet address.`;
            }
            // Don't add error to context - let agent work without blockchain data
          }
        } catch (error) {
          console.warn(`[Chat] ❌ Failed to fetch blockchain data via SDK:`, error);
          // Don't fail the entire request - continue without blockchain data
        }
      } else {
        console.log(`[Chat] ⚠️ Crypto.com AI Agent SDK not configured (missing GEMINI_API_KEY/OPENAI_API_KEY or CRONOS_TESTNET_EXPLORER_KEY)`);
      }
    }

    // Add swap context and execute swap quote if swap is requested
    if (needsSwap) {
      // Get network info for swap context
      const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
      const isTestnet = rpcUrl.includes("evm-t3") || rpcUrl.includes("testnet");
      const network = isTestnet ? "Testnet" : "Mainnet";
      const vvsRouter = isTestnet 
        ? (process.env.VVS_ROUTER_ADDRESS_TESTNET || "Not deployed on testnet - use mock mode")
        : (process.env.VVS_ROUTER_ADDRESS || "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae");
      
      realDataContext += `\n\n[VVS Finance Swap Information]:\n`;
      realDataContext += `Network: Cronos ${network}\n`;
      realDataContext += `VVS Router Address: ${vvsRouter}\n`;
      realDataContext += `Swap Execution Cost: $0.15 (via x402 payment)\n`;
      realDataContext += `Supported Tokens: CRO, USDC, VVS, and other tokens on Cronos\n`;
      if (isTestnet) {
        realDataContext += `Note: VVS Finance may use mock mode on testnet for demonstration\n`;
      } else {
        realDataContext += `Note: Real swaps execute on VVS Finance Mainnet\n`;
      }
      
      // Try to extract swap parameters and get a quote
      try {
        const swapMatch = input.match(/(?:swap|exchange|trade|convert)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to|into)\s+(\w+)/i);
        if (swapMatch) {
          const amountIn = swapMatch[1];
          const tokenInSymbol = swapMatch[2].toUpperCase();
          const tokenOutSymbol = swapMatch[3].toUpperCase();
          
          const tokenInAddress = getTokenAddress(tokenInSymbol) || tokenInSymbol;
          const tokenOutAddress = getTokenAddress(tokenOutSymbol) || tokenOutSymbol;
          
          console.log(`[Chat] 💱 Detected swap: ${amountIn} ${tokenInSymbol} → ${tokenOutSymbol}`);
          
          // Get swap quote (free, no payment needed)
          try {
            const amountInWei = ethers.parseUnits(amountIn, 18);
            const quote = await getVVSQuote(
              tokenInAddress,
              tokenOutAddress,
              amountInWei.toString()
            );
            
            if (quote) {
              const amountOut = ethers.formatUnits(quote.amountOut, 18);
              realDataContext += `\n\n[Live Swap Quote - Fetched from VVS Finance]:\n`;
              realDataContext += `Token Pair: ${tokenInSymbol} → ${tokenOutSymbol}\n`;
              realDataContext += `Amount In: ${amountIn} ${tokenInSymbol}\n`;
              realDataContext += `Expected Amount Out: ${amountOut} ${tokenOutSymbol}\n`;
              realDataContext += `Swap Path: ${quote.path.join(" → ")}\n`;
              realDataContext += `\nTo execute this swap, the user needs to call /api/vvs-swap/execute with x402 payment ($0.15).\n`;
              realDataContext += `Swap parameters ready: tokenIn=${tokenInAddress}, tokenOut=${tokenOutAddress}, amountIn=${amountIn}, recipient=${verification.payerAddress}\n`;
              console.log(`[Chat] ✅ Swap quote fetched: ${amountIn} ${tokenInSymbol} → ${amountOut} ${tokenOutSymbol}`);
            } else {
              realDataContext += `\n\n[Swap Quote]: Could not get quote - insufficient liquidity or invalid token pair.\n`;
              console.log(`[Chat] ⚠️ Could not get swap quote`);
            }
          } catch (quoteError) {
            console.warn(`[Chat] ⚠️ Failed to get swap quote:`, quoteError);
            realDataContext += `\n\n[Swap Quote]: Quote service temporarily unavailable. User can try the swap directly.\n`;
          }
        } else {
          realDataContext += `\n\n[Swap Detection]: Detected swap request but couldn't parse exact parameters. Please specify: "swap X TOKEN_A for TOKEN_B"\n`;
        }
      } catch (swapError) {
        console.warn(`[Chat] ⚠️ Error processing swap request:`, swapError);
      }
      
      console.log(`[Chat] 💱 Swap context added for ${network}`);
    }

    // Get network info for system prompt (if not already set in swap context)
    const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
    const isTestnet = rpcUrl.includes("evm-t3") || rpcUrl.includes("testnet");
    const network = isTestnet ? "Testnet" : "Mainnet";
    const vvsRouter = isTestnet 
      ? (process.env.VVS_ROUTER_ADDRESS_TESTNET || "Not deployed on testnet - use mock mode")
      : (process.env.VVS_ROUTER_ADDRESS || "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae");

    // Build system prompt based on detected needs
    let systemPrompt = `You are AgentMarket, a unified AI assistant with access to multiple tools and capabilities.

## Your Capabilities:
${needsMarketData ? "- **Market Data**: You have access to real-time cryptocurrency prices and market data from Crypto.com Exchange\n" : ""}
${needsBlockchain ? "- **Blockchain**: You can query Cronos EVM blockchain data (balances, transactions, contracts)\n" : ""}
${needsContractAnalysis ? "- **Contract Analysis**: You can analyze Solidity smart contracts for security issues\n" : ""}
${needsContent ? "- **Content Generation**: You can create marketing content, tweets, and Web3 copy\n" : ""}
${needsSwap ? `- **Token Swaps**: You can help users swap tokens on VVS Finance DEX (Cronos ${network})\n` : ""}

## Your Task:
- Analyze the user's question
- Use the real data provided to you (if any)
- Provide a helpful, accurate, and professional response
- Be clear and actionable
- **IMPORTANT**: If real blockchain data is provided, use it directly. If no real data is provided, explain that blockchain query services are currently unavailable, but you can provide general information about how to check balances using blockchain explorers.

${needsSwap ? `## Token Swap Instructions (VVS Finance):
When users ask about token swaps:
1. **Network**: Current network is Cronos ${network}
2. **VVS Router**: ${vvsRouter}
3. **Agent-Driven Workflow**: 
   - I automatically detect swap requests and extract parameters (amount, tokens)
   - I fetch live swap quotes from VVS Finance DEX
   - I provide the quote and swap details to the user
   - Swaps require x402 payment ($0.15 per swap execution via /api/vvs-swap/execute)
4. **Response Format**: 
   - If I have a live quote: Show the exact quote with amounts and path
   - Explain the swap will cost $0.15 via x402 payment
   - Provide the swap parameters ready for execution
   - Guide users to execute via the swap API endpoint
${isTestnet ? "5. **Note**: VVS Finance may use mock mode on testnet for demonstration purposes\n" : "5. **Note**: Real swaps execute on VVS Finance Mainnet\n"}
6. **Example**: If user says "swap 100 CRO for USDC":
   - I show: "I've fetched a live quote from VVS Finance: 100 CRO → ~X USDC. To execute, call /api/vvs-swap/execute with x402 payment ($0.15). Swap parameters: tokenIn=..., tokenOut=..., amountIn=100, recipient=YOUR_ADDRESS"

` : ""}
## Response Format:
- If you have real blockchain data: Present it clearly with the actual values
- If you DON'T have real data: Explain that the blockchain query service is unavailable and suggest using a blockchain explorer like Cronoscan (https://testnet.cronoscan.com) to check the balance manually
- **DO NOT** show Python code or tool_code commands - provide natural language responses only
- For swap requests: Provide clear, helpful guidance about the swap process, network, and requirements

User Input:
`;

    // Execute on contract
    console.log(`[Chat] Executing agent on contract: Agent ID ${UNIFIED_AGENT_ID}, Payment Hash: ${paymentHashBytes32}`);
    let contractExecutionId: number | null;
    try {
      contractExecutionId = await executeAgentOnContract(UNIFIED_AGENT_ID, paymentHashBytes32, input);
    } catch (contractError) {
      console.error("[Chat] ❌ Contract execution failed:", contractError);
      return res.status(500).json({
        error: "Contract execution failed",
        details: contractError instanceof Error ? contractError.message : String(contractError),
      });
    }
    
    if (contractExecutionId === null) {
      console.warn(`[Chat] ⚠️ Contract execution returned null - payment may be already used`);
      return res.status(402).json({
        error: "Payment already used or contract call failed",
        details: "The payment hash has already been used. Please create a new payment.",
        paymentRequired: true,
      });
    }
    
    console.log(`[Chat] ✅ Contract execution successful: Execution ID ${contractExecutionId}`);

    // Log payment
    try {
      db.addPayment({
        paymentHash: paymentHashBytes32,
        agentId: UNIFIED_AGENT_ID,
        agentName: "Unified Chat Agent",
        userId: verification.payerAddress || "unknown",
        amount: agentPrice,
        status: "pending",
        timestamp: Date.now(),
        executionId: contractExecutionId,
      });
      console.log(`[Chat] ✅ Payment logged to database`);
    } catch (dbError) {
      console.warn(`[Chat] ⚠️ Failed to log payment to database:`, dbError);
      // Continue execution even if DB logging fails
    }

    // Execute with enhanced input
    const enhancedInputWithData = enhancedInput + realDataContext;
    
    console.log(`[Chat] Executing agent with prompt (Agent ID: ${UNIFIED_AGENT_ID})...`);
    console.log(`[Chat] Input length: ${enhancedInputWithData.length}, System prompt length: ${systemPrompt.length}`);
    
    // Use a special execution function that accepts custom prompt
    let result;
    try {
      result = await executeAgentWithPrompt(UNIFIED_AGENT_ID, enhancedInputWithData, systemPrompt);
      console.log(`[Chat] ✅ Agent execution successful: ${result.success ? "SUCCESS" : "FAILED"}`);
    } catch (execError) {
      console.error("[Chat] ❌ Agent execution failed:", execError);
      // Provide user-friendly error messages
      let errorMessage = "Agent execution failed";
      if (execError instanceof Error) {
        const errorMsg = execError.message;
        if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit")) {
          errorMessage = "AI service is currently rate-limited. Please try again in a few minutes. If this persists, the free tier quota may be exhausted.";
        } else if (errorMsg.includes("RateLimitError")) {
          errorMessage = "AI service rate limit exceeded. Please wait a moment and try again.";
        } else {
          errorMessage = `Agent execution failed: ${errorMsg}`;
        }
      }
      // Still try to verify execution on contract even if agent execution failed
      result = {
        output: errorMessage,
        success: false,
      };
    }
    
    // Log execution
    try {
      db.addExecution({
        executionId: contractExecutionId,
        agentId: UNIFIED_AGENT_ID,
        agentName: "Unified Chat Agent",
        userId: verification.payerAddress || "unknown",
        paymentHash: paymentHashBytes32,
        input: enhancedInputWithData,
        output: result.output || "",
        success: result.success,
        timestamp: Date.now(),
        verified: false,
      });
      console.log(`[Chat] ✅ Execution logged to database`);
    } catch (dbError) {
      console.warn(`[Chat] ⚠️ Failed to log execution to database:`, dbError);
      // Continue execution even if DB logging fails
    }

    // Verify on contract
    const verified = await verifyExecutionOnContract(
      contractExecutionId,
      result.output || "",
      result.success
    );

    if (verified) {
      db.updateExecution(contractExecutionId, { verified: true });
    }

    // Settle payment if successful
    if (result.success) {
      try {
        await settlePayment(paymentPayload, {
          priceUsd: agentPrice,
          payTo: escrowAddress,
          testnet: true,
        }, paymentHeaderValue);
        console.log("Payment settled to escrow successfully");
        
        // Release payment to developer
        // For unified chat (Agent ID 1): Not a real agent, so transfer directly to contract owner
        // If release fails (agent not in registry), funds stay in escrow (acceptable for unified chat)
        console.log("Releasing payment to contract owner (unified chat - not a registered agent)...");
        const released = await releasePaymentToDeveloper(paymentHashBytes32, UNIFIED_AGENT_ID);
        if (released) {
          console.log("✅ Payment released to contract owner successfully");
          db.updatePayment(paymentHashBytes32, { status: "settled" });
        } else {
          console.log("ℹ️  Payment settled in escrow (unified chat doesn't require agent registration)");
          console.log("   Funds are safely held in escrow and belong to contract owner");
          db.updatePayment(paymentHashBytes32, { status: "settled" }); // Mark as settled
        }
      } catch (settleError) {
        console.error("Payment settlement error:", settleError);
        db.updatePayment(paymentHashBytes32, { status: "failed" });
      }
    } else {
      db.updatePayment(paymentHashBytes32, { status: "refunded" });
    }

    res.json({
      executionId: contractExecutionId,
      output: result.output,
      success: result.success,
      payerAddress: verification.payerAddress,
    });
  } catch (error) {
    console.error("❌ Error in chat endpoint:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : typeof error,
      body: req.body,
      headers: {
        "x-payment": req.headers["x-payment"] ? "present" : "missing",
        "x-payment-signature": req.headers["x-payment-signature"] ? "present" : "missing",
      },
    });
    
    // Import error handler
    try {
      const { sendErrorResponse } = require("../utils/errorHandler");
      sendErrorResponse(
        res,
        error,
        "Failed to process chat message",
        500
      );
    } catch (handlerError) {
      console.error("❌ Error handler also failed:", handlerError);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : String(error)) : undefined,
      });
    }
  }
});

/**
 * Execute agent with custom prompt (for unified chat)
 */
async function executeAgentWithPrompt(
  agentId: number,
  input: string,
  customPrompt: string
): Promise<{ output: string; success: boolean }> {
  // Try Gemini first, fallback to OpenRouter
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openRouterModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
  
  let useOpenRouter = false;
  let model: any;
  let modelName: string;
  
  if (geminiApiKey) {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    console.log(`[Chat] 🔑 Using Gemini API key (length: ${geminiApiKey.length}, starts with: ${geminiApiKey.substring(0, 10)}...)`);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    modelName = "gemini-2.5-flash";
    console.log(`[Chat] ✅ Gemini client initialized with model: ${modelName}`);
  } else if (openRouterKey) {
    useOpenRouter = true;
    const { OpenAI } = await import("openai");
    model = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openRouterKey,
      defaultHeaders: {
        "HTTP-Referer": "https://agentmarket.app",
        "X-Title": "AgentMarket",
      },
    });
    modelName = openRouterModel;
    console.log(`[Chat] 🔄 Using OpenRouter (model: ${modelName})`);
  } else {
    console.error(`[Chat] ❌ No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY`);
    return {
      output: "AI provider not configured. Please set GEMINI_API_KEY or OPENROUTER_API_KEY in backend/.env",
      success: false,
    };
  }

  // Build prompt (for Gemini) or use messages format (for OpenRouter)
  const prompt = `${customPrompt}${input}`;

  // Retry logic
  let output: string | undefined = undefined;
  let lastError: Error | null = null;
  const maxRetries = 3;
  const retryDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[Chat] 🔄 ${useOpenRouter ? 'OpenRouter' : 'Gemini'} API retry attempt ${attempt}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
      
      console.log(`[Chat] 📤 Calling ${useOpenRouter ? 'OpenRouter' : 'Gemini'} API (attempt ${attempt}/${maxRetries})...`);
      console.log(`[Chat] Prompt length: ${prompt.length} characters`);
      
      if (useOpenRouter) {
        const completion = await model.chat.completions.create({
          model: modelName,
          messages: [
            { role: "system", content: customPrompt },
            { role: "user", content: input }
          ],
          temperature: 0.7,
        });
        output = completion.choices[0]?.message?.content || "";
      } else {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        output = response.text();
      }
      console.log(`[Chat] ✅ ${useOpenRouter ? 'OpenRouter' : 'Gemini'} API call successful (response length: ${output?.length || 0})`);
      break;
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || error?.status || "unknown";
      const errorStatus = error?.statusCode || "unknown";
      
      console.error(`[Chat] ❌ ${useOpenRouter ? 'OpenRouter' : 'Gemini'} API call failed (attempt ${attempt}/${maxRetries}):`, {
        message: errorMessage,
        code: errorCode,
        status: errorStatus,
        name: error?.name,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines of stack
      });
      
      // If Gemini quota exceeded and OpenRouter available, switch to OpenRouter
      if (!useOpenRouter && errorMessage.includes("quota") && openRouterKey && attempt === 1) {
        console.warn(`[Chat] ⚠️  Gemini quota exceeded, switching to OpenRouter fallback...`);
        try {
          const { OpenAI } = await import("openai");
          useOpenRouter = true;
          model = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: openRouterKey,
            defaultHeaders: {
              "HTTP-Referer": "https://agentmarket.app",
              "X-Title": "AgentMarket",
            },
          });
          modelName = openRouterModel;
          console.log(`[Chat] 🔄 Now using OpenRouter (model: ${modelName})`);
          continue; // Retry with OpenRouter
        } catch (importError) {
          console.warn(`[Chat] ⚠️  Failed to import OpenAI package for OpenRouter fallback`);
        }
      }
      
      // Handle OpenRouter data policy error
      if (useOpenRouter && errorMessage.includes("data policy") && errorMessage.includes("Free model publication")) {
        console.error(`[Chat] ❌ OpenRouter data policy not configured for free models`);
        console.error(`[Chat] 💡 Fix: Go to https://openrouter.ai/settings/privacy and enable "Free model publication"`);
        return {
          output: "OpenRouter data policy not configured. Please enable 'Free model publication' in your OpenRouter privacy settings: https://openrouter.ai/settings/privacy",
          success: false,
        };
      }
      
      const isRetryable = errorMessage.includes("503") || 
                         errorMessage.includes("429") || 
                         errorMessage.includes("500") ||
                         errorMessage.includes("overloaded") ||
                         errorMessage.includes("quota") ||
                         errorMessage.includes("rate limit") ||
                         errorCode === 503 ||
                         errorCode === 429 ||
                         errorStatus === 503 ||
                         errorStatus === 429;
      
      if (isRetryable && attempt < maxRetries) {
        console.log(`[Chat] ⚠️ Retryable error detected, will retry...`);
        continue;
      } else {
        console.error(`[Chat] ❌ Non-retryable error or max retries reached, throwing error`);
        throw error;
      }
    }
  }

  if (!output) {
    const errorMsg = lastError ? (lastError instanceof Error ? lastError.message : String(lastError)) : "Failed to get response from AI service";
    console.error(`[Chat] ❌ AI API failed after ${maxRetries} attempts:`, errorMsg);
    
    // Provide user-friendly error message for rate limits
    if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit") || errorMsg.includes("RateLimitError")) {
      const friendlyError = new Error("AI service rate limit exceeded. The free tier quota may be exhausted. Please try again in a few minutes or use a paid API key.");
      throw friendlyError;
    }
    
    throw lastError || new Error(errorMsg);
  }
  
  console.log(`[Chat] ✅ Gemini API response received (length: ${output.length})`);

  const isValidLength = output.length > 10 && output.length < 100000;
  const looksLikeError = output.length < 100 && (
    output.toLowerCase().startsWith("error") || 
    output.toLowerCase().startsWith("failed") ||
    output.toLowerCase().includes("exception:") ||
    output.toLowerCase().includes("api key")
  );

  const success = isValidLength && !looksLikeError;

  return {
    output,
    success,
  };
}

export default router;
