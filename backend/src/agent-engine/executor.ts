import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAgentFromContract } from "../lib/contract";
import {
  determineAgentTools,
  createCryptoComClient,
  fetchMarketData,
  executeBlockchainQuery,
  buildEnhancedPrompt,
} from "./tools";

// Create fresh genAI instance each time to ensure API key is always loaded
// (Don't cache it, as it might be created before dotenv loads)
function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not found in process.env");
    console.error("Available env keys:", Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('API')));
    throw new Error("GEMINI_API_KEY not configured");
  }
  // Create fresh instance each time to ensure we always have the latest API key
  return new GoogleGenerativeAI(apiKey);
}

// OpenRouter fallback (OpenAI-compatible)
async function getOpenRouterClient() {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return null;
  }
  
  try {
    const { OpenAI } = await import("openai");
    return new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openRouterKey,
      defaultHeaders: {
        "HTTP-Referer": "https://onechat.app", // Optional, for analytics
        "X-Title": "OneChat", // Optional, for analytics
      },
    });
  } catch (error) {
    console.warn("⚠️ OpenAI package not installed. Install with: npm install openai");
    return null;
  }
}

// Generate default prompt from agent description
function generateDefaultPrompt(description: string): string {
  return `You are an AI agent specialized in: ${description}

## Your Role:
You MUST stay focused on your specialization: ${description}
- Only answer questions related to your specialization
- If asked about unrelated topics, politely redirect: "I'm specialized in ${description}. I can help you with questions related to that, but not with [unrelated topic]."
- Provide detailed, accurate, and professional responses within your domain
- Be thorough, clear, and actionable

## Important:
- DO NOT answer generic questions outside your specialization
- DO NOT act as a general-purpose assistant
- STAY FOCUSED on: ${description}
- If the question is not related to your specialization, politely decline and explain what you can help with

User Input:
`;
}

interface AgentConfig {
  systemPrompt: string;
  model?: string;
}

// Hardcoded configs removed - all agents now use contract descriptions
// Agents are registered on-chain and prompts are auto-generated from their descriptions

export async function executeAgent(
  agentId: number,
  input: string
): Promise<{ output: string; success: boolean }> {
  try {
    // Always fetch agent from contract to get actual name and description
    const agent = await getAgentFromContract(agentId);
    
    if (!agent) {
      return {
        output: "Agent not found on contract",
        success: false,
      };
    }

    // All agents use contract description - no hardcoded configs
    console.log(`[Agent ${agentId}] Generating prompt from contract description for "${agent.name}"`);
    
    // Determine tools from contract description
    const tools = determineAgentTools(agent.description);
    
    // Generate prompt from description
    const basePrompt = generateDefaultPrompt(agent.description);
    
    // Enhance prompt with tool instructions
    const enhancedPrompt = buildEnhancedPrompt(basePrompt, tools, agent.description);
    
    const config: AgentConfig = {
      systemPrompt: enhancedPrompt,
      model: "gemini-2.5-flash"
    };
    
    console.log(`[Agent ${agentId}] Using auto-generated prompt with tools: ${tools.tools.join(", ") || "none"}`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY not found when executing agent");
      return {
        output: "Gemini API key not configured",
        success: false,
      };
    }

    // Try Gemini first, fallback to OpenRouter if quota exceeded
    let useOpenRouter = false;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openRouterModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
    
    let model: any;
    let modelName: string;
    
    if (geminiApiKey) {
      console.log("🔑 Using Gemini API key (length:", geminiApiKey.length + ")");
      model = getGenAI().getGenerativeModel({ 
        model: config.model || "gemini-2.5-flash" 
      });
      modelName = config.model || "gemini-2.5-flash";
      console.log("📤 Calling Gemini model:", modelName);
    } else if (openRouterKey) {
      useOpenRouter = true;
      const openRouterClient = await getOpenRouterClient();
      if (!openRouterClient) {
        throw new Error("OpenRouter client creation failed. Install openai package: npm install openai");
      }
      model = openRouterClient;
      modelName = openRouterModel;
      console.log("🔄 Using OpenRouter fallback (model:", modelName + ")");
    } else {
      throw new Error("No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY");
    }

    // Tools already determined above from contract description
    
    // Pre-process input to fetch real data if needed
    let enhancedInput = input;
    let realDataContext = "";

    // Check if user is asking for market data
    if (tools.hasMarketDataAccess) {
      const marketDataPattern = /(?:price|price of|current price|what's the price|how much is|trading at)\s+([A-Z]{2,10}|bitcoin|btc|ethereum|eth|solana|sol|cardano|ada)/i;
      const match = input.match(marketDataPattern);
      if (match) {
        const symbol = match[1].toUpperCase();
        console.log(`[Agent ${agentId}] Fetching market data for ${symbol}...`);
        try {
          // OPTIMIZATION: Use cache if available (shared with chat endpoint)
          let marketData = null;
          try {
            // Try to get from cache (if cache functions are available)
            const cacheModule = require("../api/chat");
            if (cacheModule.getCachedMarketData) {
              marketData = cacheModule.getCachedMarketData(symbol);
            }
          } catch (e) {
            // Cache not available, continue with fetch
          }
          
          if (!marketData) {
            marketData = await fetchMarketData(symbol);
            // Cache the result if cache is available
            try {
              const cacheModule = require("../api/chat");
              if (cacheModule.setCachedMarketData && marketData) {
                cacheModule.setCachedMarketData(symbol, marketData);
              }
            } catch (e) {
              // Cache not available, continue
            }
          } else {
            console.log(`[Agent ${agentId}] ✅ Market data from cache`);
          }
          
          if (marketData) {
            realDataContext += `\n\n[Real Market Data for ${symbol}]:\n${JSON.stringify(marketData, null, 2)}\n`;
            console.log(`[Agent ${agentId}] ✅ Market data fetched successfully`);
          }
        } catch (error) {
          console.warn(`[Agent ${agentId}] Failed to fetch market data:`, error);
        }
      }
    }

    // Check if user is asking for blockchain data
    if (tools.hasBlockchainAccess) {
      const blockchainClient = createCryptoComClient();
      if (blockchainClient) {
        const blockchainPattern = /(?:balance|transaction|block|address|contract|on-chain|blockchain)/i;
        if (blockchainPattern.test(input)) {
          console.log(`[Agent ${agentId}] 🔗 Detected blockchain query, using Crypto.com AI Agent SDK...`);
          console.log(`[Agent ${agentId}] 📡 SDK Status: ACTIVE - Querying Cronos blockchain via Crypto.com AI Agent SDK`);
          try {
            const blockchainResult = await executeBlockchainQuery(blockchainClient, input);
            if (blockchainResult && !blockchainResult.includes("not available") && !blockchainResult.includes("Error:")) {
              realDataContext += `\n\n[Real Blockchain Data - Fetched via Crypto.com AI Agent SDK]:\n${blockchainResult}\n`;
              console.log(`[Agent ${agentId}] ✅ Blockchain data fetched successfully via Crypto.com AI Agent SDK`);
              console.log(`[Agent ${agentId}] 📊 SDK Result: ${blockchainResult.substring(0, 100)}...`);
            } else {
              console.warn(`[Agent ${agentId}] ⚠️ SDK returned error or unavailable: ${blockchainResult}`);
            }
          } catch (error) {
            console.warn(`[Agent ${agentId}] ❌ Failed to fetch blockchain data via SDK:`, error);
          }
        }
      } else {
        console.log(`[Agent ${agentId}] ⚠️ Crypto.com AI Agent SDK not configured (missing API keys)`);
      }
    }

    // Check if user is asking for token swap
    if (tools.hasSwapAccess) {
      const swapPattern = /(?:swap|exchange|trade|convert|vvs|dex).*?(?:token|coin|crypto)/i;
      if (swapPattern.test(input)) {
        console.log(`[Agent ${agentId}] 💱 Detected swap request, providing swap information...`);
        const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
        const isTestnet = rpcUrl.includes("evm-t3") || rpcUrl.includes("testnet");
        const network = isTestnet ? "Cronos Testnet" : "Cronos Mainnet";
        const vvsRouter = isTestnet 
          ? (process.env.VVS_ROUTER_ADDRESS_TESTNET || "Not deployed on testnet - use mock mode")
          : (process.env.VVS_ROUTER_ADDRESS || "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae");
        
        realDataContext += `\n\n[VVS Finance Swap Information]:\n`;
        realDataContext += `Network: ${network}\n`;
        realDataContext += `VVS Router Address: ${vvsRouter}\n`;
        realDataContext += `To execute a swap, I can help you:\n`;
        realDataContext += `1. Get a quote for your token swap\n`;
        realDataContext += `2. Execute the swap transaction (requires x402 payment)\n`;
        realDataContext += `3. Check liquidity for token pairs\n`;
        realDataContext += `\nSupported tokens: CRO, USDC, VVS, and other tokens on Cronos\n`;
        realDataContext += `Note: VVS Finance is primarily on Mainnet. For testnet, mock mode may be used.\n`;
        console.log(`[Agent ${agentId}] ✅ Swap information added to context`);
      }
    }

    // Build enhanced prompt with real data
    enhancedInput = input + realDataContext;
    const prompt = config.systemPrompt.includes("User Input:") 
      ? `${config.systemPrompt}${enhancedInput}`
      : `${config.systemPrompt}\n\nUser Input:\n${enhancedInput}`;

    // Retry logic for transient errors (503, 429, etc.)
    let output: string | undefined = undefined;
    let lastError: Error | null = null;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${retryDelay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt)); // Exponential backoff
        }
        
        if (useOpenRouter) {
          // OpenRouter uses OpenAI-compatible API
          const completion = await model.chat.completions.create({
            model: modelName,
            messages: [
              { role: "system", content: config.systemPrompt },
              { role: "user", content: enhancedInput }
            ],
            temperature: 0.7,
          });
          output = completion.choices[0]?.message?.content || "";
        } else {
          // Gemini API
          const result = await model.generateContent(prompt);
          const response = await result.response;
          output = response.text();
        }
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        
        // Check if it's a retryable error (503, 429, 500, etc.)
        const isRetryable = errorMessage.includes("503") || 
                           errorMessage.includes("429") || 
                           errorMessage.includes("500") ||
                           errorMessage.includes("overloaded") ||
                           errorMessage.includes("quota") ||
                           errorMessage.includes("rate limit");
        
        // If Gemini quota exceeded and OpenRouter available, switch to OpenRouter
        if (!useOpenRouter && errorMessage.includes("quota") && openRouterKey && attempt === 1) {
          console.warn(`⚠️  Gemini quota exceeded, switching to OpenRouter fallback...`);
          const openRouterClient = await getOpenRouterClient();
          if (openRouterClient) {
            useOpenRouter = true;
            model = openRouterClient;
            modelName = openRouterModel;
            console.log(`🔄 Now using OpenRouter (model: ${modelName})`);
            continue; // Retry with OpenRouter
          }
        }
        
        if (isRetryable && attempt < maxRetries) {
          console.warn(`⚠️  Attempt ${attempt} failed with retryable error: ${errorMessage.split('\n')[0]}`);
          continue; // Retry
        } else {
          // Not retryable or max retries reached
          throw error;
        }
      }
    }

    if (!output) {
      throw lastError || new Error("Failed to get response from Gemini after retries");
    }

    // Output validation - be more lenient with length
    // Long outputs are valid (e.g., detailed security reports)
    const isValidLength = output.length > 10 && output.length < 100000; // Increased limit
    // Only mark as error if it's clearly an error message, not just long content
    const looksLikeError = output.length < 100 && (
      output.toLowerCase().startsWith("error") || 
      output.toLowerCase().startsWith("failed") ||
      output.toLowerCase().includes("exception:") ||
      output.toLowerCase().includes("api key")
    );
    
    const success = isValidLength && !looksLikeError;

    if (!success) {
      console.warn(`[Agent] Output validation failed: length=${output.length}, looksLikeError=${looksLikeError}`);
      console.warn(`[Agent] Output preview: ${output.substring(0, 200)}...`);
    } else {
      console.log(`[Agent] ✅ Output validated: length=${output.length}, success=true`);
    }

    return {
      output,
      success,
    };
  } catch (error) {
    console.error("Agent execution error:", error);
    return {
      output: error instanceof Error ? error.message : "Execution failed",
      success: false,
    };
  }
}

export function getAgentConfig(agentId: number): AgentConfig | null {
  // All agents now use contract descriptions - no hardcoded configs
  return null;
}
