/**
 * VVS Finance Swap Agent Endpoint
 * Track 2 Requirement: Cronos dApp Integration
 * 
 * This endpoint allows agents to execute token swaps on VVS Finance DEX
 * Uses x402 for payment settlement
 */

import { Router, Request, Response } from "express";
import { verifyPayment, settlePayment, generatePaymentRequiredResponse } from "../x402/facilitator";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { getVVSQuote, buildVVSSwapTransaction, checkVVSLiquidity, getTokenAddress } from "../lib/vvs-finance";
import { executeAgentOnContract, verifyExecutionOnContract } from "../lib/contract";
import { db } from "../lib/database";
import { ethers } from "ethers";

const router = Router();

// Swap agent price
const SWAP_AGENT_PRICE = 0.15; // $0.15 per swap execution

/**
 * POST /api/vvs-swap/quote
 * Get swap quote from VVS Finance
 * No payment required for quotes
 */
router.post("/quote", async (req: Request, res: Response) => {
  try {
    const { tokenIn, tokenOut, amountIn } = req.body;

    if (!tokenIn || !tokenOut || !amountIn) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["tokenIn", "tokenOut", "amountIn"],
      });
    }

    // Get token addresses (async - may fetch from API if not in hardcoded list)
    const cronosRpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
    const isTestnet = cronosRpcUrl.includes("evm-t3") || cronosRpcUrl.includes("testnet");
    const networkForLookup = isTestnet ? 'testnet' : 'mainnet';
    const tokenInAddress = await getTokenAddress(tokenIn, networkForLookup) || tokenIn;
    const tokenOutAddress = await getTokenAddress(tokenOut, networkForLookup) || tokenOut;

    // Parse amount
    const amountInWei = ethers.parseUnits(amountIn, 18);

    // Get quote
    const quote = await getVVSQuote(
      tokenInAddress,
      tokenOutAddress,
      amountInWei.toString()
    );

    if (!quote) {
      // Check if it's a router address issue
      const routerAddress: string = process.env.VVS_ROUTER_ADDRESS || "0x145863Eb42cfAf17A673B8D3b682b1b2Ae";
      const isInvalidAddress = !ethers.isAddress(routerAddress);
      
      return res.status(400).json({
        error: "Failed to get quote",
        message: isInvalidAddress 
          ? `Invalid VVS Router address. Please set VVS_ROUTER_ADDRESS in backend/.env. Current address (${String(routerAddress).length} chars) is incomplete. Find correct address at https://explorer.cronos.org/testnet`
          : "Insufficient liquidity or invalid token pair. Check backend logs for details.",
        ...(isInvalidAddress && {
          hint: "VVS Router address must be 42 characters (0x + 40 hex). Search 'VVS Finance Router' on explorer.cronos.org/testnet"
        })
      });
    }

    // Check liquidity
    const hasLiquidity = await checkVVSLiquidity(tokenInAddress, tokenOutAddress);

    return res.json({
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: ethers.formatUnits(quote.amountOut, 18),
      path: quote.path,
      hasLiquidity,
      source: "VVS Finance DEX",
    });
  } catch (error) {
    console.error("[VVS Swap] Error getting quote:", error);
    return res.status(500).json({
      error: "Failed to get swap quote",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/vvs-swap/execute
 * Execute token swap on VVS Finance
 * Requires x402 payment
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    // Check if we're in mock mode (skip payment for demo)
    // Payment is REQUIRED on mainnet (real VVS), OPTIONAL on testnet (mock mode)
    const cronosRpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
    const isTestnet = cronosRpcUrl.includes("evm-t3") || cronosRpcUrl.includes("testnet");
    const isMainnet = !isTestnet;
    const mockMode = process.env.VVS_MOCK_MODE === "true";
    const networkForLookup = isTestnet ? 'testnet' : 'mainnet';
    
    // Skip payment ONLY if:
    // 1. On testnet AND (mock mode enabled OR no real router address)
    // NEVER skip on mainnet - always require payment for real swaps
    const skipPayment = isTestnet && (mockMode || !process.env.VVS_ROUTER_ADDRESS);
    
    console.log("[VVS Swap] Payment check:", {
      isTestnet,
      isMainnet,
      mockMode,
      hasRouter: !!process.env.VVS_ROUTER_ADDRESS,
      skipPayment: skipPayment,
      rpcUrl: cronosRpcUrl,
      note: isMainnet ? "Mainnet: Payment REQUIRED" : skipPayment ? "Testnet: Payment SKIPPED (mock)" : "Testnet: Payment REQUIRED",
    });
    
    // Verify x402 payment (skip in mock mode for easier testing)
    const paymentHeader = req.headers["x-payment"] as string;
    if (!skipPayment) {
      if (!paymentHeader) {
        const paymentRequired = await generatePaymentRequiredResponse({
          url: req.url || "",
          description: "VVS token swap",
          priceUsd: SWAP_AGENT_PRICE,
          payTo: process.env.AGENT_ESCROW_ADDRESS || "0x4352F2319c0476607F5E1cC9FDd568246074dF14",
          testnet: isTestnet,
        });
        return res.status(402).json({
          error: "Payment required",
          paymentRequired,
        });
      }

      // Decode and verify payment
      const paymentPayload = decodePaymentSignatureHeader(paymentHeader);
      const verification = await verifyPayment(paymentPayload, {
        priceUsd: SWAP_AGENT_PRICE,
        payTo: process.env.AGENT_ESCROW_ADDRESS || "0x4352F2319c0476607F5E1cC9FDd568246074dF14",
        testnet: isTestnet, // Use actual network, not hardcoded
      });

      if (!verification.valid) {
        return res.status(402).json({
          error: "Payment verification failed",
          details: verification.invalidReason,
        });
      }
    } else {
      console.log("[VVS Swap] 🎭 Mock mode: Skipping payment verification");
    }

    const { tokenIn, tokenOut, amountIn, amountOutMin, recipient } = req.body;

    if (!tokenIn || !tokenOut || !amountIn || !recipient) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["tokenIn", "tokenOut", "amountIn", "recipient"],
      });
    }

    // Get token addresses (async - may fetch from API if not in hardcoded list)
    // networkForLookup is already defined above
    const tokenInAddress = await getTokenAddress(tokenIn, networkForLookup) || tokenIn;
    const tokenOutAddress = await getTokenAddress(tokenOut, networkForLookup) || tokenOut;

    // Parse amounts
    const amountInWei = ethers.parseUnits(amountIn, 18);
    const amountOutMinWei = amountOutMin 
      ? ethers.parseUnits(amountOutMin, 18)
      : ethers.parseUnits("0", 18); // Will be calculated if not provided

    // Get quote first
    const quote = await getVVSQuote(
      tokenInAddress,
      tokenOutAddress,
      amountInWei.toString()
    );

    if (!quote) {
      return res.status(400).json({
        error: "Swap not possible",
        message: "Insufficient liquidity or invalid token pair",
      });
    }

    // Use quote amountOutMin if not provided (with 1% slippage tolerance)
    const finalAmountOutMin = amountOutMin 
      ? amountOutMinWei.toString()
      : (BigInt(quote.amountOut) * 99n / 100n).toString(); // 1% slippage

    // Build swap transaction
    const swapTx = buildVVSSwapTransaction(
      tokenInAddress,
      tokenOutAddress,
      amountInWei.toString(),
      finalAmountOutMin,
      recipient
    );

    // Execute agent on contract (for tracking) - skip in mock mode
    if (!skipPayment && paymentHeader) {
      const paymentHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(paymentHeader));
      const agentId = 999; // Special ID for VVS Swap Agent
      
      try {
        await executeAgentOnContract(agentId, paymentHashBytes32, JSON.stringify({
          action: "vvs_swap",
          tokenIn,
          tokenOut,
          amountIn,
        }));
      } catch (contractError) {
        console.warn("[VVS Swap] Contract execution failed (non-critical):", contractError);
      }

      // Settle payment
      if (paymentHeader) {
        const paymentPayload = decodePaymentSignatureHeader(paymentHeader);
        await settlePayment(paymentPayload, {
          priceUsd: SWAP_AGENT_PRICE,
          payTo: process.env.AGENT_ESCROW_ADDRESS || "0x4352F2319c0476607F5E1cC9FDd568246074dF14",
          testnet: isTestnet, // Use actual network, not hardcoded
        }, paymentHeader);
      }
    } else {
      console.log("[VVS Swap] 🎭 Mock mode: Skipping payment settlement");
    }

    return res.json({
      success: true,
      transaction: swapTx,
      quote: {
        amountIn,
        expectedAmountOut: ethers.formatUnits(quote.amountOut, 18),
        minimumAmountOut: ethers.formatUnits(finalAmountOutMin, 18),
      },
      message: "Swap transaction ready. Sign and broadcast to execute swap on VVS Finance.",
      note: "This returns the transaction data. User must sign and broadcast it from their wallet.",
      source: "VVS Finance DEX",
    });
  } catch (error) {
    console.error("[VVS Swap] Error executing swap:", error);
    return res.status(500).json({
      error: "Failed to execute swap",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
