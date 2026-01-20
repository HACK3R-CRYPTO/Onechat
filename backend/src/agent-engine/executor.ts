import { GoogleGenerativeAI } from "@google/generative-ai";

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

interface AgentConfig {
  systemPrompt: string;
  model?: string;
}

const AGENT_CONFIGS: Record<number, AgentConfig> = {
  1: {
    systemPrompt: `You are a smart contract security expert. Analyze the provided Solidity smart contract code and identify potential vulnerabilities, security issues, and best practice violations. Return a structured security report with:
- Critical vulnerabilities
- Medium severity issues
- Low severity issues
- Recommendations for fixes
Format your response as a clear, professional security audit report.`,
    model: "gemini-2.5-flash", // Using gemini-2.5-flash (without models/ prefix - SDK handles it)
  },
  2: {
    systemPrompt: `You are a cryptocurrency market data analyst. Analyze the provided market data and provide insights about:
- Price trends
- Market sentiment
- Trading opportunities
- Risk factors
Format your response as a clear market analysis report.`,
    model: "gemini-2.5-flash",
  },
  3: {
    systemPrompt: `You are a marketing copywriter specializing in Web3 and cryptocurrency projects. Generate engaging, professional marketing content based on the provided brief. Your content should be:
- Clear and compelling
- Web3-native language
- Professional tone
- Action-oriented
Format your response as ready-to-use marketing copy.`,
    model: "gemini-2.5-flash",
  },
  4: {
    systemPrompt: `You are a DeFi portfolio analyst. Analyze the provided portfolio information and provide:
- Portfolio composition analysis
- Risk assessment
- Optimization recommendations
- Strategy suggestions
Format your response as a comprehensive portfolio analysis report.`,
    model: "gemini-2.5-flash",
  },
};

export async function executeAgent(
  agentId: number,
  input: string
): Promise<{ output: string; success: boolean }> {
  try {
    const config = AGENT_CONFIGS[agentId];
    if (!config) {
      return {
        output: "Agent not found",
        success: false,
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY not found when executing agent");
      return {
        output: "Gemini API key not configured",
        success: false,
      };
    }

    console.log("🔑 Using Gemini API key (length:", apiKey.length + ")");
    const model = getGenAI().getGenerativeModel({ 
      model: config.model || "gemini-2.5-flash" 
    });
    console.log("📤 Calling Gemini model:", config.model || "gemini-2.5-flash");

    const prompt = `${config.systemPrompt}\n\nUser Input:\n${input}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const output = response.text();

    if (!output) {
      return {
        output: "No response from agent",
        success: false,
      };
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
  return AGENT_CONFIGS[agentId] || null;
}
