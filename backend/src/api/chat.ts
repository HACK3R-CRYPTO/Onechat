import { Router, Request, Response } from "express";
import { verifyPayment, settlePayment, generatePaymentRequiredResponse } from "../x402/facilitator";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { executeAgent } from "../agent-engine/executor";
import { getAgentFromContract, executeAgentOnContract, verifyExecutionOnContract } from "../lib/contract";
import { db } from "../lib/database";
import { ethers } from "ethers";
import { determineAgentTools, fetchMarketData, executeBlockchainQuery, createCryptoComClient } from "../agent-engine/tools";
import { releasePaymentToDeveloper } from "../lib/contract";
import { getVVSQuote, getTokenAddress, buildVVSSwapTransaction, getTokenDecimals } from "../lib/vvs-finance";

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
    
    // For unified chat: Get platform fee recipient from escrow contract or env var
    // Unified chat payments should go directly to platform treasury, not to any agent developer
    let platformFeeRecipient: string | null = null;
    
    // Try environment variable first
    if (process.env.PLATFORM_FEE_RECIPIENT) {
      platformFeeRecipient = process.env.PLATFORM_FEE_RECIPIENT;
      console.log(`[Chat] Using platform fee recipient from env: ${platformFeeRecipient}`);
    } else {
      // Try reading from escrow contract
      // Note: platformFeeRecipient is a public immutable variable, accessed as a property (not a function)
      try {
        const { getAgentEscrow } = require("../lib/contract");
        const escrowContract = getAgentEscrow();
        if (escrowContract) {
          // Public variables in Solidity are accessed without parentheses in ethers.js
          platformFeeRecipient = await escrowContract.platformFeeRecipient;
          console.log(`[Chat] Platform fee recipient from escrow contract: ${platformFeeRecipient}`);
        }
      } catch (error) {
        console.warn(`[Chat] Could not read platform fee recipient from escrow:`, error);
      }
    }
    
    // Use platform fee recipient for unified chat, fallback to escrow if not available
    // This ensures unified chat revenue goes to platform, not to contract creator/agent developer
    const unifiedChatPayTo = platformFeeRecipient || escrowAddress;
    if (platformFeeRecipient) {
      console.log(`[Chat] ✅ Unified chat payments will go to platform fee recipient: ${unifiedChatPayTo}`);
    } else {
      console.warn(`[Chat] ⚠️  No platform fee recipient found, using escrow address: ${unifiedChatPayTo}`);
    }

    // Check for payment
    const paymentHeader = req.headers["x-payment"] || 
                          req.headers["x-payment-signature"] || 
                          req.headers["payment-signature"];

    if (!paymentHash && !paymentHeader) {
      const paymentRequired = await generatePaymentRequiredResponse({
        url: req.url || "",
        description: `Chat message`,
        priceUsd: agentPrice,
        payTo: unifiedChatPayTo, // Use platform fee recipient for unified chat
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
        payTo: unifiedChatPayTo, // Use platform fee recipient for unified chat
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

    // Check if payment hash has already been used (prevent double-spending for unified chat)
    // Since we skip contract execution for unified chat, we need to check database
    // Also check if payment was used in previous executions (before we removed contract execution)
    const existingPayment = db.getPayments({ paymentHash: paymentHashBytes32 });
    const existingExecution = db.getExecutions({ paymentHash: paymentHashBytes32 });
    
    if (existingPayment.length > 0 && existingPayment[0].status !== "failed" && existingPayment[0].status !== "refunded") {
      console.warn(`[Chat] ⚠️ Payment hash ${paymentHashBytes32} has already been used (found in payments)`);
      return res.status(402).json({
        error: "Payment already used",
        details: "This payment has already been used. Please create a new payment to continue.",
        paymentRequired: true,
      });
    }
    
    if (existingExecution && existingExecution.length > 0) {
      console.warn(`[Chat] ⚠️ Payment hash ${paymentHashBytes32} has already been used (found in executions)`);
      return res.status(402).json({
        error: "Payment already used",
        details: "This payment has already been used in a previous execution. Please create a new payment to continue.",
        paymentRequired: true,
      });
    }

    // Analyze user input to determine what tools/capabilities are needed
    const inputLower = input.toLowerCase();
    
    // Detect intent
    const needsMarketData = /(?:price|price of|current price|what's the price|how much is|trading at|market|volume|bitcoin|btc|ethereum|eth|crypto)/i.test(input);
    const needsBlockchain = /(?:balance|transaction|block|address|contract|on-chain|blockchain|wallet|wrap|wrapping|ticker|tickers|exchange|defi|farm|protocol|cronosid|0x[a-fA-F0-9]{40})/i.test(input);
    // Detect swap requests: "swap 1 CRO for USDC", "exchange 100 CRO to USDC", etc.
    const needsSwap = /(?:swap|exchange|trade|convert|vvs|dex)\s+\d+.*?(?:for|to|into)/i.test(input);
    // Detect transfer requests: "transfer 5 CRO to 0x...", "send 100 USDC to 0x...", "send 10 CRO 0x..." (without "to")
    const needsTransfer = /(?:transfer|send)\s+\d+(?:\.\d+)?\s+(?:\w+\s+)*(?:to\s+)?0x[a-fA-F0-9]{40}/i.test(input);
    // Detect portfolio queries: "portfolio", "my tokens", "my balances", "show my wallet"
    const needsPortfolio = /(?:portfolio|my tokens|my balances|show my wallet|wallet balance|all my tokens|token holdings)/i.test(input);
    // Detect transaction history queries: "my transactions", "transaction history", "recent transactions"
    const needsHistory = /(?:my transactions|transaction history|recent transactions|tx history|last transactions|show my tx)/i.test(input);
    
    let swapTransactionData: { to: string; data: string; value?: string } | null = null;
    let swapQuoteInfo: { amountIn: string; tokenIn: string; tokenOut: string; expectedAmountOut: string; network: string } | null = null;
    let transferMagicLink: { url: string; amount: string; token: string; to: string; type: string } | null = null;
    let portfolioData: { address: string; balances: Array<{ symbol: string; balance: string; contractAddress?: string }> } | null = null;
    let transactionHistory: { address: string; transactions: Array<{ hash: string; from: string; to: string; value: string; timestamp: number; blockNumber: number }> } | null = null;
    
    if (needsSwap) {
      console.log(`[Chat] 💱 Swap request detected in input: "${input}"`);
    }
    if (needsTransfer) {
      console.log(`[Chat] 💸 Transfer request detected in input: "${input}"`);
    }
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
      // Exchange, Defi, and CronosID queries are handled by AI Agent SDK
      // AI Agent SDK internally uses Developer Platform SDK and provides better formatting
      // Token wrap queries still use Developer Platform SDK directly (not supported by AI Agent SDK)
      const inputLower = input.toLowerCase();
      let directSDKResult: string | null = null;
      
      // Token wrap queries - must use Developer Platform SDK (not supported by AI Agent SDK)
      if (inputLower.includes('wrap') && (inputLower.includes('cro') || inputLower.includes('token'))) {
        console.log(`[Chat] 📦 Token wrap query detected - routing directly to Developer Platform SDK...`);
        try {
          const { wrapTokenViaSDK } = require("../agent-engine/tools");
          directSDKResult = await wrapTokenViaSDK(input);
        } catch (error) {
          console.warn(`[Chat] ⚠️ Token wrap query failed:`, error);
        }
      }
      
      // If we got a direct SDK result (wrap), use it
      if (directSDKResult) {
        realDataContext += `\n\n[Real Data - Fetched via Crypto.com Developer Platform SDK]:\n${directSDKResult}\n`;
        console.log(`[Chat] ✅ Data fetched successfully via Developer Platform SDK`);
      } else {
        // Exchange, Defi, and CronosID queries go through AI Agent SDK (if OPENAI_API_KEY is set)
        // If AI Agent SDK not available, fall back to Developer Platform SDK directly
        // AI Agent SDK handles: "Get all tickers", "Get whitelisted tokens", "Get all farms", "Resolve CronosId", etc.
        // AI Agent SDK internally uses Developer Platform SDK and provides formatted responses
        
        // Check if AI Agent SDK is available (requires OPENAI_API_KEY)
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        const inputLower = input.toLowerCase();
        const isExchangeQuery = (inputLower.includes('get all tickers') || (inputLower.includes('all tickers') && inputLower.includes('get'))) ||
                                (inputLower.includes('ticker') && (inputLower.includes('information') || inputLower.includes('of') || inputLower.includes('for')));
        const isDefiQuery = (inputLower.includes('whitelisted tokens') && inputLower.includes('protocol')) ||
                            (inputLower.includes('all farms') && inputLower.includes('protocol')) ||
                            (inputLower.includes('farm') && inputLower.includes('protocol') && inputLower.includes('symbol'));
        const isCronosIdQuery = (inputLower.includes('resolve') && inputLower.includes('cronosid') && inputLower.includes('name')) ||
                                (inputLower.includes('lookup') && inputLower.includes('cronosid') && input.match(/0x[a-fA-F0-9]{40}/));
        
        let directSDKResult: string | null = null;
        
        // Priority 1: Try AI Agent SDK first if OPENAI_API_KEY is available
        if (hasOpenAIKey) {
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
                directSDKResult = blockchainResult; // Mark as successful
              } else {
                console.warn(`[Chat] ⚠️ AI Agent SDK returned error or unavailable: ${blockchainResult}`);
                // Check if it's a 403 error from Explorer API - this means we should try RPC fallback
                if (blockchainResult && (blockchainResult.includes("403") || blockchainResult.includes("Forbidden") || blockchainResult.includes("status code 403"))) {
                  console.log(`[Chat] 🔄 AI Agent SDK got 403 from Explorer API, trying RPC fallback for block queries...`);
                  // For block queries, try RPC directly
                  if (blockchainQuery.toLowerCase().includes('block')) {
                    try {
                      const { queryBlockInfoViaRPC } = require("../agent-engine/tools");
                      const rpcResult = await queryBlockInfoViaRPC(blockchainQuery);
                      if (rpcResult && !rpcResult.includes("Error:")) {
                        realDataContext += `\n\n[Real Blockchain Data - Fetched via RPC (AI Agent SDK Explorer API unavailable)]:\n${rpcResult}\n`;
                        console.log(`[Chat] ✅ Block data fetched successfully via RPC fallback`);
                        directSDKResult = rpcResult;
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
              }
            } catch (error) {
              console.warn(`[Chat] ❌ Failed to fetch blockchain data via AI Agent SDK:`, error);
            }
          } else {
            console.log(`[Chat] ⚠️ Crypto.com AI Agent SDK client creation failed (check OPENAI_API_KEY and CRYPTO_COM_DEVELOPER_PLATFORM_API_KEY)`);
          }
        }
        
        // Priority 2: Fallback to Developer Platform SDK directly for Exchange/Defi/CronosID if AI Agent SDK didn't work
        if (!directSDKResult && (isExchangeQuery || isDefiQuery || isCronosIdQuery)) {
          try {
            if (isExchangeQuery) {
              if (inputLower.includes('get all tickers') || (inputLower.includes('all tickers') && inputLower.includes('get'))) {
                console.log(`[Chat] 📊 Exchange query - trying Developer Platform SDK fallback...`);
                const { getAllTickersViaSDK } = require("../agent-engine/tools");
                directSDKResult = await getAllTickersViaSDK();
              } else if (inputLower.includes('ticker') && (inputLower.includes('information') || inputLower.includes('of') || inputLower.includes('for'))) {
                console.log(`[Chat] 📊 Exchange ticker query - trying Developer Platform SDK fallback...`);
                const { getTickerByInstrumentViaSDK } = require("../agent-engine/tools");
                directSDKResult = await getTickerByInstrumentViaSDK(input);
              }
            } else if (isDefiQuery) {
              if (inputLower.includes('whitelisted tokens') && inputLower.includes('protocol')) {
                console.log(`[Chat] 🏦 Defi whitelisted tokens query - trying Developer Platform SDK fallback...`);
                const { getWhitelistedTokensViaSDK } = require("../agent-engine/tools");
                directSDKResult = await getWhitelistedTokensViaSDK(input);
              } else if (inputLower.includes('all farms') && inputLower.includes('protocol')) {
                console.log(`[Chat] 🏦 Defi all farms query - trying Developer Platform SDK fallback...`);
                const { getAllFarmsViaSDK } = require("../agent-engine/tools");
                directSDKResult = await getAllFarmsViaSDK(input);
              } else if (inputLower.includes('farm') && inputLower.includes('protocol') && inputLower.includes('symbol')) {
                console.log(`[Chat] 🏦 Defi farm by symbol query - trying Developer Platform SDK fallback...`);
                const { getFarmBySymbolViaSDK } = require("../agent-engine/tools");
                directSDKResult = await getFarmBySymbolViaSDK(input);
              }
            } else if (isCronosIdQuery) {
              if (inputLower.includes('resolve') && inputLower.includes('cronosid') && inputLower.includes('name')) {
                console.log(`[Chat] 🆔 CronosID resolve query - trying Developer Platform SDK fallback...`);
                const { resolveCronosIdNameViaSDK } = require("../agent-engine/tools");
                directSDKResult = await resolveCronosIdNameViaSDK(input);
              } else if (inputLower.includes('lookup') && inputLower.includes('cronosid') && input.match(/0x[a-fA-F0-9]{40}/)) {
                console.log(`[Chat] 🆔 CronosID lookup query - trying Developer Platform SDK fallback...`);
                const { lookupCronosIdAddressViaSDK } = require("../agent-engine/tools");
                directSDKResult = await lookupCronosIdAddressViaSDK(input);
              }
            }
            
            if (directSDKResult) {
              realDataContext += `\n\n[Real Data - Fetched via Crypto.com Developer Platform SDK (fallback)]:\n${directSDKResult}\n`;
              console.log(`[Chat] ✅ Data fetched successfully via Developer Platform SDK (fallback)`);
            }
          } catch (error) {
            console.warn(`[Chat] ⚠️ Developer Platform SDK fallback also failed:`, error);
          }
        }
        
        // For other blockchain queries (not Exchange/Defi/CronosID), use AI Agent SDK if available
        if (!directSDKResult && !isExchangeQuery && !isDefiQuery && !isCronosIdQuery) {
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
                      const { queryBlockInfoViaRPC } = require("../agent-engine/tools");
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
            console.log(`[Chat] ⚠️ Crypto.com AI Agent SDK not configured (missing OPENAI_API_KEY - required for AI Agent SDK)`);
          }
        }
      }
    }

    // Add swap context and execute swap quote if swap is requested
    if (needsSwap) {
      // Get network info from backend configuration (not frontend wallet)
      const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
      const isTestnet = rpcUrl.includes("evm-t3") || rpcUrl.includes("testnet");
      const network = isTestnet ? "Testnet" : "Mainnet";
      const isMainnet = !isTestnet;
      const vvsRouter = isMainnet
        ? (process.env.VVS_ROUTER_ADDRESS || "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae")
        : (process.env.VVS_ROUTER_ADDRESS_TESTNET || "Not deployed on testnet - use mock mode");
      
      realDataContext += `\n\n[VVS Finance Swap Information]:\n`;
      realDataContext += `Backend Network Configuration: Cronos ${network}\n`;
      realDataContext += `VVS Router Address: ${vvsRouter}\n`;
      realDataContext += `Swap Execution Cost: $0.15 (via x402 payment)\n`;
              realDataContext += `Supported Tokens: CRO, USDC, VVS, and any token address on Cronos (users can provide contract addresses)\n`;
      
      if (isMainnet) {
        realDataContext += `\n⚠️ IMPORTANT: VVS Finance swaps are on Cronos MAINNET.\n`;
        realDataContext += `- Backend is configured for mainnet\n`;
        realDataContext += `- User MUST switch their wallet to Cronos Mainnet (Chain ID: 25) to execute swaps\n`;
        realDataContext += `- Quotes are fetched from real VVS Finance mainnet DEX\n`;
        realDataContext += `- Real swaps will execute on mainnet\n`;
      } else {
        realDataContext += `\n⚠️ NOTE: Backend is on testnet, but VVS Finance is primarily on mainnet.\n`;
        realDataContext += `- Quotes may use mock mode for demonstration\n`;
        realDataContext += `- For real swaps, switch backend to mainnet configuration\n`;
        realDataContext += `- User should switch wallet to Cronos Mainnet (Chain ID: 25) for real swaps\n`;
      }
      
      // Try to extract swap parameters and get a quote
      try {
        // More flexible pattern: "swap 1 CRO for USDC" or "swap 100 CRO to USDC" or "exchange 50 CRO into USDC"
        const swapMatch = input.match(/(?:swap|exchange|trade|convert)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to|into)\s+(\w+)/i);
        if (swapMatch) {
          const amountIn = swapMatch[1];
          const tokenInSymbol = swapMatch[2].toUpperCase();
          const tokenOutSymbol = swapMatch[3].toUpperCase();
          
          // Check if user explicitly requests mainnet quote (needed for network lookup)
          const wantsMainnet = /mainnet|main|production/i.test(input);
          
          // Get token addresses (async - may fetch from API if not in hardcoded list)
          const networkForLookup = wantsMainnet || isMainnet ? 'mainnet' : 'testnet';
          const tokenInAddress = await getTokenAddress(tokenInSymbol, networkForLookup) || tokenInSymbol;
          const tokenOutAddress = await getTokenAddress(tokenOutSymbol, networkForLookup) || tokenOutSymbol;
          
          console.log(`[Chat] 💱 Detected swap: ${amountIn} ${tokenInSymbol} → ${tokenOutSymbol}`);
          
          // Check if user explicitly requests mainnet quote (already defined above)
          const quoteNetwork = wantsMainnet ? "Mainnet" : network;
          const useMainnetForQuote = wantsMainnet || isMainnet;
          
          // Get swap quote (free, no payment needed)
          // If user requests mainnet or backend is on mainnet, fetch from mainnet VVS Finance
          // Otherwise use backend's network configuration
          try {
            const amountInWei = ethers.parseUnits(amountIn, 18);
            console.log(`[Chat] 💱 Fetching quote from ${quoteNetwork} VVS Finance (user requested mainnet: ${wantsMainnet}, backend is mainnet: ${isMainnet})...`);
            
            // Pass forceMainnet flag to getVVSQuote if user explicitly wants mainnet
            const quote = await getVVSQuote(
              tokenInAddress,
              tokenOutAddress,
              amountInWei.toString(),
              wantsMainnet // Force mainnet if user explicitly requests it
            );
            
            if (quote) {
              // Get correct decimals for tokenOut (USDC has 6, most others have 18)
              const tokenOutDecimals = getTokenDecimals(tokenOutAddress);
              const amountOut = ethers.formatUnits(quote.amountOut, tokenOutDecimals);
              realDataContext += `\n\n[Live Swap Quote - Fetched from VVS Finance ${quoteNetwork}]:\n`;
              realDataContext += `Token Pair: ${tokenInSymbol} → ${tokenOutSymbol}\n`;
              realDataContext += `Amount In: ${amountIn} ${tokenInSymbol}\n`;
              realDataContext += `Expected Amount Out: ${amountOut} ${tokenOutSymbol}\n`;
              realDataContext += `Swap Path: ${quote.path.join(" → ")}\n`;
              realDataContext += `Quote Network: Cronos ${quoteNetwork}\n`;
              
              // Build swap transaction for direct signing
              const amountInWei = ethers.parseUnits(amountIn, 18);
              const amountOutMin = (BigInt(quote.amountOut) * 99n / 100n).toString(); // 1% slippage
              swapTransactionData = buildVVSSwapTransaction(
                tokenInAddress,
                tokenOutAddress,
                amountInWei.toString(),
                amountOutMin,
                verification.payerAddress || "0x0000000000000000000000000000000000000000"
              );
              swapQuoteInfo = {
                amountIn,
                tokenIn: tokenInSymbol,
                tokenOut: tokenOutSymbol,
                expectedAmountOut: amountOut,
                network: quoteNetwork,
              };
              
              if (useMainnetForQuote) {
                realDataContext += `\n⚠️ IMPORTANT: This quote is from Cronos MAINNET VVS Finance.\n`;
                realDataContext += `- User MUST switch their wallet to Cronos Mainnet (Chain ID: 25) to execute this swap\n`;
                realDataContext += `- Current quote is from real mainnet VVS Finance DEX\n`;
                realDataContext += `- User's wallet must be on Cronos Mainnet to sign the transaction\n`;
                realDataContext += `- Transaction data is ready - user can sign directly from chat interface\n`;
                if (wantsMainnet && isTestnet) {
                  realDataContext += `- Note: You requested a mainnet quote even though backend is on testnet. Quote fetched from mainnet.\n`;
                }
              } else {
                realDataContext += `\n⚠️ NOTE: This quote is from testnet (may use mock mode).\n`;
                realDataContext += `- For real swaps with actual liquidity, request a mainnet quote\n`;
                realDataContext += `- To get mainnet quote: Ask "swap X TOKEN_A for TOKEN_B on mainnet"\n`;
                realDataContext += `- Transaction data is ready - user can sign directly from chat interface\n`;
              }
              realDataContext += `\nSwap parameters ready: tokenIn=${tokenInAddress}, tokenOut=${tokenOutAddress}, amountIn=${amountIn}, recipient=${verification.payerAddress}\n`;
              console.log(`[Chat] ✅ Swap quote fetched from ${quoteNetwork}: ${amountIn} ${tokenInSymbol} → ${amountOut} ${tokenOutSymbol}`);
              console.log(`[Chat] ✅ Swap transaction built for direct signing`);
            } else {
              realDataContext += `\n\n[Swap Quote]: Could not get quote from ${quoteNetwork} - insufficient liquidity or invalid token pair.\n`;
              if (useMainnetForQuote) {
                realDataContext += `- This was a mainnet quote request. Try a different token pair or amount.\n`;
              }
              console.log(`[Chat] ⚠️ Could not get swap quote from ${quoteNetwork}`);
            }
          } catch (quoteError) {
            console.warn(`[Chat] ⚠️ Failed to get swap quote from ${quoteNetwork}:`, quoteError);
            realDataContext += `\n\n[Swap Quote]: Quote service temporarily unavailable for ${quoteNetwork}. User can try the swap directly.\n`;
          }
        } else {
          realDataContext += `\n\n[Swap Detection]: Detected swap request but couldn't parse exact parameters. Please specify: "swap X TOKEN_A for TOKEN_B"\n`;
        }
      } catch (swapError) {
        console.warn(`[Chat] ⚠️ Error processing swap request:`, swapError);
      }
      
      // Log the actual quote network if available, otherwise backend network
      const actualQuoteNetwork = swapQuoteInfo?.network || network;
      console.log(`[Chat] 💱 Swap context added for ${actualQuoteNetwork}${actualQuoteNetwork !== network ? ` (quote network, backend is ${network})` : ''}`);
    }

    // Process transfer requests using SDK's Token.transfer() (returns magic links)
    if (needsTransfer) {
      try {
        // Extract transfer parameters - handle both "send X TOKEN to 0x..." and "send X TOKEN 0x..." formats
        // Also handle "testnet cro", "testnet CRO", etc.
        // Pattern: (transfer|send) amount (optional words like "testnet") token (to)? address
        let transferMatch = input.match(/(?:transfer|send)\s+(\d+(?:\.\d+)?)\s+((?:\w+\s+)*?)(\w+)\s+to\s+(0x[a-fA-F0-9]{40})/i);
        if (!transferMatch) {
          // Try without "to" - "send X TOKEN 0x..."
          transferMatch = input.match(/(?:transfer|send)\s+(\d+(?:\.\d+)?)\s+((?:\w+\s+)*?)(\w+)\s+(0x[a-fA-F0-9]{40})/i);
        }
        
        if (transferMatch) {
          const amount = transferMatch[1];
          const optionalWords = (transferMatch[2] || '').trim(); // e.g., "testnet "
          let tokenSymbol = (transferMatch[3] || '').toUpperCase(); // e.g., "cro"
          const toAddress = transferMatch[4];
          
          // Combine optional words with token symbol for normalization
          const fullTokenString = (optionalWords + ' ' + tokenSymbol).trim().toUpperCase();
          
          // Handle "testnet cro", "testnet CRO", "TCRO" variations
          // Normalize token symbol - remove "TESTNET" prefix if present
          if (fullTokenString.includes('TESTNET')) {
            tokenSymbol = fullTokenString.replace(/TESTNET/gi, '').trim() || 'CRO';
          }
          if (tokenSymbol === 'TCRO') {
            tokenSymbol = 'CRO'; // Treat testnet CRO as CRO for native transfer
          }
          
          // Check for contract address for ERC-20 tokens
          const contractMatch = input.match(/contract[:\s]+(0x[a-fA-F0-9]{40})/i);
          const contractAddress = contractMatch ? contractMatch[1] : undefined;
          
          const isNativeToken = tokenSymbol === 'CRO' || tokenSymbol === 'NATIVE';
          
          console.log(`[Chat] 💸 Processing transfer: ${amount} ${tokenSymbol} to ${toAddress}`);
          
          // Call SDK's Token.transfer() to get magic link
          // Use Developer Platform SDK (not AI Agent SDK) for Token.transfer()
          const { initDeveloperPlatformSDK } = require("../agent-engine/tools");
          const sdk = initDeveloperPlatformSDK();
          
          if (sdk && sdk.Token) {
            try {
              let transferResponse;
              
              // SDK gets provider from Client.getProvider() (set in Client.init())
              // Don't pass provider in payload - SDK handles it automatically
              if (isNativeToken) {
                console.log(`[Chat] 💸 Calling Token.transfer() for native CRO`);
                console.log(`[Chat] 💸 Transfer params:`, { to: toAddress, amount: parseFloat(amount) });
                transferResponse = await sdk.Token.transfer({
                  to: toAddress,
                  amount: parseFloat(amount)
                });
              } else if (contractAddress) {
                console.log(`[Chat] 💸 Calling Token.transfer() for ERC-20 token`);
                console.log(`[Chat] 💸 Transfer params:`, { to: toAddress, amount: parseFloat(amount), contractAddress });
                transferResponse = await sdk.Token.transfer({
                  to: toAddress,
                  amount: parseFloat(amount),
                  contractAddress: contractAddress
                });
              } else {
                console.warn(`[Chat] ⚠️ ERC-20 transfer requires contract address`);
                // Will be handled by agent response
              }
              
              if (transferResponse) {
                console.log(`[Chat] 💸 Transfer response:`, JSON.stringify(transferResponse, null, 2).substring(0, 200));
                const responseData = transferResponse?.data || transferResponse;
                const magicLink = responseData?.magicLink || responseData?.magic_link || responseData?.link;
                
                if (magicLink) {
                  transferMagicLink = {
                    url: magicLink,
                    amount: amount,
                    token: tokenSymbol,
                    to: toAddress,
                    type: isNativeToken ? 'native' : 'erc20'
                  };
                  console.log(`[Chat] ✅ Magic link generated for transfer: ${magicLink.substring(0, 50)}...`);
                } else {
                  console.warn(`[Chat] ⚠️ Transfer response received but no magic link found:`, transferResponse);
                }
              }
            } catch (transferError: any) {
              console.error(`[Chat] ⚠️ Error calling SDK Token.transfer():`, transferError);
              console.error(`[Chat] Transfer parameters attempted:`, {
                to: toAddress,
                amount: amount,
                tokenSymbol,
                isNativeToken,
                contractAddress: contractAddress || 'N/A'
              });
              
              // Check if error is about missing provider
              if (transferError.message && transferError.message.includes('provider')) {
                console.error(`[Chat] ⚠️ Provider URL is required for Token.transfer()`);
                console.error(`[Chat] ⚠️ See backend/PROVIDER_URL_GUIDE.md for how to get provider URL`);
                console.error(`[Chat] ⚠️ Set CRYPTO_COM_PROVIDER or CRYPTO_COM_SSO_WALLET_URL in .env`);
                console.error(`[Chat] ⚠️ Provider URL can be found in Crypto.com Developer Platform dashboard`);
              }
              
              // Continue - agent will handle the error in response
            }
          } else {
            console.warn(`[Chat] ⚠️ Developer Platform SDK not available for Token.transfer()`);
          }
        }
      } catch (transferError) {
        console.warn(`[Chat] ⚠️ Error processing transfer request:`, transferError);
      }
    }

    // Handle Portfolio Queries
    if (needsPortfolio && verification.payerAddress) {
      console.log(`[Chat] 💼 Portfolio query detected for address: ${verification.payerAddress}`);
      try {
        const { initDeveloperPlatformSDK } = require("../agent-engine/tools");
        const sdk = initDeveloperPlatformSDK();
        
        if (sdk && sdk.Wallet && sdk.Token) {
          const balances: Array<{ symbol: string; balance: string; contractAddress?: string }> = [];
          
          // Get native CRO balance
          try {
            const nativeBalance = await sdk.Wallet.balance(verification.payerAddress);
            if (nativeBalance && nativeBalance.data && nativeBalance.data.balance) {
              balances.push({
                symbol: 'CRO',
                balance: nativeBalance.data.balance
              });
            }
          } catch (e) {
            console.warn(`[Chat] ⚠️ Failed to fetch native balance:`, e);
          }
          
          // Get common ERC-20 token balances (USDC, VVS, etc.)
          const commonTokens = [
            { address: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0', symbol: 'USDC' }, // USDC.e on testnet
            { address: '0x2D03bECE6747ADC00E1A131bBA1469C15FD11E03', symbol: 'VVS' }, // VVS on testnet
          ];
          
          for (const token of commonTokens) {
            try {
              const tokenBalance = await sdk.Token.getERC20TokenBalance(verification.payerAddress, token.address);
              if (tokenBalance && tokenBalance.data && tokenBalance.data.balance) {
                const balanceStr = tokenBalance.data.balance;
                // Only include if balance > 0
                if (parseFloat(balanceStr) > 0) {
                  balances.push({
                    symbol: token.symbol,
                    balance: balanceStr,
                    contractAddress: token.address
                  });
                }
              }
            } catch (e) {
              // Token might not exist or have no balance - skip
              continue;
            }
          }
          
          if (balances.length > 0) {
            portfolioData = {
              address: verification.payerAddress,
              balances: balances
            };
            console.log(`[Chat] ✅ Portfolio data fetched: ${balances.length} tokens`);
            realDataContext += `\n\n[Portfolio Data]:\nUser wallet: ${verification.payerAddress}\nToken balances:\n${balances.map(b => `- ${b.symbol}: ${b.balance}`).join('\n')}\n`;
          }
        }
      } catch (portfolioError) {
        console.error(`[Chat] ⚠️ Error fetching portfolio:`, portfolioError);
      }
    }

    // Handle Transaction History Queries
    if (needsHistory && verification.payerAddress) {
      console.log(`[Chat] 📜 Transaction history query detected for address: ${verification.payerAddress}`);
      try {
        const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Get transaction count (nonce) to know how many transactions exist
        const txCount = await provider.getTransactionCount(verification.payerAddress);
        console.log(`[Chat] ✅ Transaction count: ${txCount}`);
        
        // Fetch recent transactions by scanning recent blocks
        // We'll get the last 20 blocks and check for transactions from/to this address
        const currentBlock = await provider.getBlockNumber();
        const txList: any[] = [];
        const blocksToCheck = Math.min(20, currentBlock); // Check last 20 blocks (faster)
        const addressLower = verification.payerAddress.toLowerCase();
        
        console.log(`[Chat] 🔍 Scanning last ${blocksToCheck} blocks for transactions...`);
        
        for (let i = 0; i < blocksToCheck && txList.length < 10; i++) {
          try {
            const blockNumber = currentBlock - i;
            const block = await provider.getBlock(blockNumber, true); // true = include transactions
            
            if (block && block.transactions && Array.isArray(block.transactions)) {
              for (const txHash of block.transactions) {
                if (txList.length >= 10) break;
                
                try {
                  const tx = await provider.getTransaction(txHash);
                  if (tx && tx.hash && 
                      (tx.from?.toLowerCase() === addressLower || 
                       tx.to?.toLowerCase() === addressLower)) {
                    txList.push({
                      hash: tx.hash,
                      from: tx.from || 'N/A',
                      to: tx.to || 'N/A',
                      value: tx.value ? ethers.formatEther(tx.value) + ' CRO' : '0 CRO',
                      timestamp: block.timestamp ? Number(block.timestamp) * 1000 : Date.now(),
                      blockNumber: Number(block.number)
                    });
                  }
                } catch (txError) {
                  // Skip individual tx errors
                }
              }
            }
          } catch (blockError) {
            // Skip block errors and continue
            console.log(`[Chat] ⚠️ Error fetching block ${currentBlock - i}:`, blockError);
            break;
          }
        }
        
        if (txList.length > 0) {
          // Sort by block number (newest first)
          txList.sort((a, b) => b.blockNumber - a.blockNumber);
          
          transactionHistory = {
            address: verification.payerAddress,
            transactions: txList
          };
          console.log(`[Chat] ✅ Transaction history fetched: ${txList.length} transactions`);
          realDataContext += `\n\n[Transaction History]:\nUser wallet: ${verification.payerAddress}\nTotal transactions: ${txCount}\nRecent transactions found: ${txList.length}\n`;
        } else {
          // Even if no recent transactions found, provide the count
          console.log(`[Chat] ℹ️ No recent transactions found in last ${blocksToCheck} blocks (total: ${txCount})`);
          realDataContext += `\n\n[Transaction History]:\nUser wallet: ${verification.payerAddress}\nTotal transaction count: ${txCount}\nNote: No recent transactions found in last ${blocksToCheck} blocks. View full history on explorer.\n`;
        }
      } catch (historyError) {
        console.error(`[Chat] ⚠️ Error fetching transaction history:`, historyError);
      }
    }

    // Get network info for system prompt (if not already set in swap context)
    const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
    const isTestnet = rpcUrl.includes("evm-t3") || rpcUrl.includes("testnet");
    const network = isTestnet ? "Testnet" : "Mainnet";
    const vvsRouter = isTestnet 
      ? (process.env.VVS_ROUTER_ADDRESS_TESTNET || "Not deployed on testnet - use mock mode")
      : (process.env.VVS_ROUTER_ADDRESS || "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae");

    // Build system prompt based on detected needs
    let systemPrompt = `You are OneChat, a unified AI assistant with access to multiple tools and capabilities.

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
1. **Network Detection**: Backend is configured for Cronos ${network}
2. **VVS Router**: ${vvsRouter}
3. **Agent-Driven Workflow**: 
   - I automatically detect swap requests and extract parameters (amount, tokens)
   - I can fetch quotes from either mainnet or testnet based on user request or backend config
   - If user says "on mainnet" or "mainnet quote", fetch from mainnet VVS Finance (even if backend is on testnet)
   - Otherwise, use backend's network configuration
   - I provide the quote and swap details to the user
   - Swaps require x402 payment ($0.15 per swap execution via /api/vvs-swap/execute)
4. **Network Requirements**: 
   - Users can request mainnet quotes even if their wallet is on testnet
   - If quote is from mainnet: User MUST switch wallet to Cronos Mainnet (Chain ID: 25) to execute
   - If quote is from testnet: May use mock mode, inform user about mainnet for real swaps
   - Always clearly state which network the quote is from
5. **Response Format**: 
   - If I have a live quote: Show the exact quote with amounts, path, and network
   - Clearly state which network the quote is from (Mainnet/Testnet)
   - If mainnet quote: Warn user they need to switch wallet to mainnet (Chain ID: 25)
   - Explain the swap will cost $0.15 via x402 payment
   - Provide the swap parameters ready for execution
   - Guide users to execute via the swap API endpoint
6. **Examples**: 
   - "swap 100 CRO for USDC" → Use backend's network (testnet or mainnet)
   - "swap 100 CRO for USDC on mainnet" → Fetch from mainnet VVS Finance, warn about wallet switch
   - "get mainnet quote for 50 CRO to USDC" → Fetch mainnet quote regardless of backend config

` : ""}
## Response Format:
- If you have real blockchain data: Present it clearly with the actual values
- If you DON'T have real data: Explain that the blockchain query service is unavailable and suggest using a blockchain explorer like Cronos Explorer (https://explorer.cronos.org/testnet) to check the balance manually
- **DO NOT** show Python code or tool_code commands - provide natural language responses only
- For swap requests: Provide clear, helpful guidance about the swap process, network, and requirements

User Input:
`;

    // SKIP contract execution for unified chat to avoid counting toward agent 1's metrics
    // Unified chat should NOT increment any agent's totalExecutions or affect reputation
    // We still track in database for analytics, but don't create on-chain execution records
    console.log(`[Chat] ℹ️  Skipping contract execution for unified chat (does not affect agent metrics)`);
    console.log(`[Chat] Using payment hash for tracking: ${paymentHashBytes32}`);
    
    // Generate a unique execution ID for database tracking (not on-chain)
    // Use timestamp + hash to ensure uniqueness
    const contractExecutionId = parseInt(
      `9${Date.now().toString().slice(-8)}${paymentHashBytes32.slice(2, 10)}`,
      16
    ) % 2147483647; // Keep within int32 range for database

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
    
    // Log execution to database (for analytics/tracking)
    // NOTE: We do NOT verify on contract for unified chat to avoid counting toward agent 1's metrics
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
        verified: false, // Unified chat executions are not verified on contract
      });
      console.log(`[Chat] ✅ Execution logged to database (unified chat - not counted toward agent metrics)`);
    } catch (dbError) {
      console.warn(`[Chat] ⚠️ Failed to log execution to database:`, dbError);
      // Continue execution even if DB logging fails
    }

    // SKIP contract verification for unified chat
    // Unified chat should NOT count toward any agent's execution count or reputation
    // We still log to database for analytics, but don't update contract metrics
    console.log(`[Chat] ℹ️  Skipping contract verification for unified chat (does not affect agent metrics)`);

    // Settle payment if successful
    if (result.success) {
      try {
        // For unified chat: Settle directly to platform fee recipient (not escrow)
        // This ensures unified chat revenue goes to the platform, not to any agent developer
        await settlePayment(paymentPayload, {
          priceUsd: agentPrice,
          payTo: unifiedChatPayTo, // Platform fee recipient for unified chat
          testnet: true,
        }, paymentHeaderValue);
        console.log(`[Chat] ✅ Payment settled directly to platform fee recipient: ${unifiedChatPayTo}`);
        console.log(`[Chat] ℹ️  Unified chat revenue goes to platform, not to any agent developer`);
        db.updatePayment(paymentHashBytes32, { status: "settled" });
      } catch (settleError) {
        console.error("[Chat] Payment settlement error:", settleError);
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
      // Include swap transaction data if available
      ...(swapTransactionData && swapQuoteInfo && {
        swapTransaction: swapTransactionData,
        swapQuote: swapQuoteInfo,
      }),
      // Include transfer magic link if available
      ...(transferMagicLink && {
        transferMagicLink: transferMagicLink,
      }),
      // Include portfolio data if available
      ...(portfolioData && {
        portfolio: portfolioData,
      }),
      // Include transaction history if available
      ...(transactionHistory && {
        transactionHistory: transactionHistory,
      }),
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
        "HTTP-Referer": "https://onechat.app",
        "X-Title": "OneChat",
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
              "HTTP-Referer": "https://onechat.app",
              "X-Title": "OneChat",
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
