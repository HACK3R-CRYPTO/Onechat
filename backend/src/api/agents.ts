import { Router, Request, Response } from "express";
import { verifyPayment, settlePayment, parsePaymentSignature } from "../x402/facilitator";
import { executeAgent } from "../agent-engine/executor";
import { getAllAgentsFromContract, getAgentFromContract } from "../lib/contract";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    // Try to fetch from contract first
    const contractAgents = await getAllAgentsFromContract();
    
    if (contractAgents.length > 0) {
      const formattedAgents = contractAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        price: Number(agent.pricePerExecution) / 1_000_000, // Convert from 6 decimals
        reputation: Number(agent.reputation),
      }));
      return res.json({ agents: formattedAgents });
    }

    // Fallback to hardcoded agents if contract not deployed
    const agents = [
      {
        id: 1,
        name: "Smart Contract Analyzer",
        description: "Analyzes Solidity contracts for vulnerabilities",
        price: 0.10,
        reputation: 850,
      },
      {
        id: 2,
        name: "Market Data Agent",
        description: "Fetches and analyzes Crypto.com market data",
        price: 0.05,
        reputation: 920,
      },
      {
        id: 3,
        name: "Content Generator",
        description: "Creates marketing content for Web3 projects",
        price: 0.02,
        reputation: 780,
      },
      {
        id: 4,
        name: "Portfolio Analyzer",
        description: "Analyzes DeFi portfolios and suggests optimizations",
        price: 0.15,
        reputation: 890,
      },
    ];

    res.json({ agents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const agentId = parseInt(req.params.id);
    
    // Try to fetch from contract first
    const contractAgent = await getAgentFromContract(agentId);
    if (contractAgent) {
      return res.json({
        agent: {
          id: contractAgent.id,
          name: contractAgent.name,
          description: contractAgent.description,
          price: Number(contractAgent.pricePerExecution) / 1_000_000,
          reputation: Number(contractAgent.reputation),
          developer: contractAgent.developer,
          totalExecutions: Number(contractAgent.totalExecutions),
          successfulExecutions: Number(contractAgent.successfulExecutions),
        },
      });
    }

    // Fallback to hardcoded agent if contract not deployed
    const agent = {
      id: agentId,
      name: "Smart Contract Analyzer",
      description: "Analyzes Solidity contracts for vulnerabilities",
      price: 0.10,
      reputation: 850,
      developer: "0x...",
      totalExecutions: 150,
      successfulExecutions: 128,
    };

    res.json({ agent });
  } catch (error) {
    console.error("Error fetching agent:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

router.post("/:id/execute", async (req: Request, res: Response) => {
  try {
    const agentId = parseInt(req.params.id);
    const { input, paymentHash } = req.body;

    if (!input) {
      return res.status(400).json({ error: "Input required" });
    }

    if (!paymentHash) {
      return res.status(402).json({
        error: "Payment required",
        paymentRequired: true,
      });
    }

    // Parse payment signature from headers
    // Convert Express request to Web API Request for x402
    const webRequest = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: new Headers(req.headers as any),
      body: req.body ? JSON.stringify(req.body) : undefined,
    });
    const paymentPayload = parsePaymentSignature(webRequest);
    if (!paymentPayload) {
      return res.status(402).json({
        error: "Invalid payment signature",
        paymentRequired: true,
      });
    }

    // Get agent details (TODO: from contract)
    const agentPrice = 0.10; // USD
    const escrowAddress = process.env.AGENT_ESCROW_ADDRESS || "0x...";

    // Verify payment
    const verification = await verifyPayment(paymentPayload, {
      priceUsd: agentPrice,
      payTo: escrowAddress,
      testnet: true,
    });

    if (!verification.valid) {
      return res.status(402).json({
        error: verification.invalidReason || "Payment verification failed",
        paymentRequired: true,
      });
    }

    // Execute agent
    const result = await executeAgent(agentId, input);

    // Settle payment if execution successful
    if (result.success) {
      await settlePayment(paymentPayload, {
        priceUsd: agentPrice,
        payTo: escrowAddress,
        testnet: true,
      });
    }

    res.json({
      executionId: Date.now(),
      agentId,
      output: result.output,
      success: result.success,
      payerAddress: verification.payerAddress,
    });
  } catch (error) {
    console.error("Error executing agent:", error);
    res.status(500).json({ error: "Failed to execute agent" });
  }
});

export default router;
