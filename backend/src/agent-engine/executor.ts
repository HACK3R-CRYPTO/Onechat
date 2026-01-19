import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    model: "gpt-4",
  },
  2: {
    systemPrompt: `You are a cryptocurrency market data analyst. Analyze the provided market data and provide insights about:
- Price trends
- Market sentiment
- Trading opportunities
- Risk factors
Format your response as a clear market analysis report.`,
    model: "gpt-4",
  },
  3: {
    systemPrompt: `You are a marketing copywriter specializing in Web3 and cryptocurrency projects. Generate engaging, professional marketing content based on the provided brief. Your content should be:
- Clear and compelling
- Web3-native language
- Professional tone
- Action-oriented
Format your response as ready-to-use marketing copy.`,
    model: "gpt-4",
  },
  4: {
    systemPrompt: `You are a DeFi portfolio analyst. Analyze the provided portfolio information and provide:
- Portfolio composition analysis
- Risk assessment
- Optimization recommendations
- Strategy suggestions
Format your response as a comprehensive portfolio analysis report.`,
    model: "gpt-4",
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

    if (!process.env.OPENAI_API_KEY) {
      return {
        output: "OpenAI API key not configured",
        success: false,
      };
    }

    const response = await openai.chat.completions.create({
      model: config.model || "gpt-4",
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: input },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const output = response.choices[0]?.message?.content || "";

    if (!output) {
      return {
        output: "No response from agent",
        success: false,
      };
    }

    // Simple output validation
    const success = output.length > 10 && output.length < 10000;

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
