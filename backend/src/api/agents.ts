import { Router, Request, Response } from "express";
import { verifyPayment, settlePayment, generatePaymentRequiredResponse } from "../x402/facilitator";
import { decodePaymentSignatureHeader } from "@x402/core/http";
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
    console.log("=== Agent Execution Request ===");
    console.log("Agent ID:", req.params.id);
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("Payment headers:", {
      "x-payment-signature": req.headers["x-payment-signature"] ? "present" : "missing",
      "payment-signature": req.headers["payment-signature"] ? "present" : "missing",
    });

    const agentId = parseInt(req.params.id);
    const { input, paymentHash } = req.body;

    if (!input) {
      return res.status(400).json({ error: "Input required" });
    }

    // Get agent details from contract
    console.log("Fetching agent from contract...");
    const contractAgent = await getAgentFromContract(agentId);
    if (!contractAgent) {
      console.log("Agent not found in contract");
      return res.status(404).json({ error: "Agent not found" });
    }
    
    const agentPrice = Number(contractAgent.pricePerExecution) / 1_000_000; // Convert from 6 decimals to USD
    const escrowAddress = process.env.AGENT_ESCROW_ADDRESS || "0xE2228Cf8a49Cd23993442E5EE5a39d6180E0d25f";
    console.log("Agent price:", agentPrice, "USD, Escrow:", escrowAddress);

    // Check for payment header
    const paymentHeader = req.headers["x-payment-signature"] || req.headers["payment-signature"];
    console.log("Payment header present:", !!paymentHeader, "Payment hash in body:", !!paymentHash);

    if (!paymentHash && !paymentHeader) {
      console.log("No payment provided, ensuring facilitator is initialized...");
      // Ensure facilitator is initialized before generating payment requirements
      try {
        const { initializeFacilitator } = await import("../x402/facilitator");
        await initializeFacilitator();
        console.log("Facilitator initialized successfully");
      } catch (initError) {
        console.error("Failed to initialize facilitator for payment requirements:", initError);
        // Continue anyway - generatePaymentRequiredResponse doesn't need facilitator
      }
      
      // Return 402 with payment requirements
      const paymentRequired = generatePaymentRequiredResponse({
        url: req.url || "",
        description: `Execute agent ${agentId}`,
        priceUsd: agentPrice,
        payTo: escrowAddress,
        testnet: true,
      });
      return res.status(402).json({
        error: "Payment required",
        paymentRequired: paymentRequired,
      });
    }

    // Parse payment signature from headers
    console.log("Parsing payment signature...");
    
    // Extract payment header directly (can be string or string[])
    const paymentHeaderValue = req.headers["x-payment-signature"] || req.headers["payment-signature"];
    const headerString = Array.isArray(paymentHeaderValue) 
      ? paymentHeaderValue[0] 
      : paymentHeaderValue;
    
    if (!headerString || typeof headerString !== "string") {
      console.log("No payment header found");
      return res.status(402).json({
        error: "Payment signature header missing",
        paymentRequired: true,
      });
    }
    
    let paymentPayload;
    try {
      // Decode the payment signature header directly
      paymentPayload = decodePaymentSignatureHeader(headerString);
      console.log("Payment payload decoded successfully");
    } catch (parseError) {
      console.error("Payment parsing error:", parseError);
      return res.status(402).json({
        error: "Invalid payment signature format",
        details: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }
    
    if (!paymentPayload) {
      console.log("Payment payload is null");
      return res.status(402).json({
        error: "Invalid payment signature",
        paymentRequired: true,
      });
    }
    console.log("Payment payload parsed successfully");

    // Verify payment
    console.log("Verifying payment...");
    let verification;
    try {
      verification = await verifyPayment(paymentPayload, {
        priceUsd: agentPrice,
        payTo: escrowAddress,
        testnet: true,
      });
    } catch (verifyError) {
      console.error("Payment verification error:", verifyError);
      return res.status(402).json({
        error: "Payment verification failed",
        details: verifyError instanceof Error ? verifyError.message : String(verifyError),
      });
    }

    if (!verification.valid) {
      console.log("Payment verification failed:", verification.invalidReason);
      return res.status(402).json({
        error: verification.invalidReason || "Payment verification failed",
        paymentRequired: true,
      });
    }
    console.log("Payment verified successfully");

    // Execute agent
    console.log("Executing agent with Gemini...");
    const result = await executeAgent(agentId, input);
    console.log("Agent execution result:", { success: result.success, outputLength: result.output?.length });

    // Settle payment if execution successful
    if (result.success) {
      console.log("Settling payment...");
      try {
        await settlePayment(paymentPayload, {
          priceUsd: agentPrice,
          payTo: escrowAddress,
          testnet: true,
        });
        console.log("Payment settled successfully");
      } catch (settleError) {
        console.error("Payment settlement error:", settleError);
        // Don't fail the request if settlement fails, just log it
      }
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
    console.error("Error details:", error instanceof Error ? error.stack : error);
    res.status(500).json({ 
      error: "Failed to execute agent",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
