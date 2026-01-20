"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { WalletConnect } from "@/components/WalletConnect";
import { X402Payment } from "@/components/X402Payment";
import { useAgent } from "@/hooks/useAgents";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { AGENT_REGISTRY_ABI, getContractAddresses } from "@/lib/contracts";
import TetrisLoading from "@/components/ui/tetris-loader";

interface Agent {
  id: number;
  name: string;
  description: string;
  price: number;
  reputation: number;
  developer: string;
  totalExecutions: number;
  successfulExecutions: number;
}

export default function AgentDetail() {
  const params = useParams();
  const agentId = params.id as string;
  const agentIdNum = parseInt(agentId);
  const { agent: contractAgent, loading: contractLoading } = useAgent(agentIdNum);
  const queryClient = useQueryClient();
  const [apiAgent, setApiAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgent();
    
    // CRITICAL: Clear any old payments from sessionStorage on page load/refresh
    // This prevents reusing payments that may have already been used
    // Each execution requires a fresh payment, so we clear old ones
    if (typeof window !== "undefined") {
      const oldPayment = sessionStorage.getItem(`payment_${agentIdNum}`);
      if (oldPayment) {
        console.log("Clearing old payment from sessionStorage (page refreshed)");
        sessionStorage.removeItem(`payment_${agentIdNum}`);
      }
    }
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/agents/${agentId}`);
      const data = await response.json();
      setApiAgent(data.agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
    } finally {
      setLoading(false);
    }
  };

  // Use contract agent if available, otherwise fall back to API
  const agent = contractAgent
    ? {
        id: contractAgent.id,
        name: contractAgent.name,
        description: contractAgent.description,
        price: Number(contractAgent.pricePerExecution) / 1_000_000,
        reputation: Number(contractAgent.reputation),
        developer: contractAgent.developer,
        totalExecutions: Number(contractAgent.totalExecutions),
        successfulExecutions: Number(contractAgent.successfulExecutions),
      }
    : apiAgent;

  const handlePaymentComplete = (hash: string) => {
    // Set payment hash and immediately execute
    // Note: Payment will be cleared after execution (success or failure)
    setPaymentHash(hash);
    setShowPayment(false);
    setPaymentError(null);
    // Execute immediately with the new payment
    executeAgent(hash);
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    setShowPayment(false);
  };

  const executeAgent = async (hash: string) => {
    if (!input.trim()) {
      alert("Please provide input");
      return;
    }

    // CRITICAL: Each payment can only be used ONCE
    // If hash is null or empty, user needs to create a new payment
    if (!hash || hash.trim() === "") {
      setPaymentError("No payment found. Please create a new payment.");
      setShowPayment(true);
      return;
    }

    setExecuting(true);
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      
      // Get payment header from session storage
      // NOTE: This should only exist if we just created a payment in this session
      // If page was refreshed, sessionStorage should be empty (we clear it on mount)
      const paymentHeader = typeof window !== "undefined" 
        ? sessionStorage.getItem(`payment_${agentIdNum}`)
        : null;
      
      // If no payment header in storage, payment was already used, cleared, or page was refreshed
      if (!paymentHeader) {
        console.warn("No payment header in sessionStorage - payment may have been used or page was refreshed");
        setPaymentHash(null);
        setPaymentError("Payment not found. Please create a new payment.");
        setShowPayment(true);
        setExecuting(false);
        return;
      }
      
      // Note: We don't check paymentHash state here because:
      // 1. State updates are async, so paymentHash might not be set yet
      // 2. We're passing the hash directly as a parameter, so we trust it
      // 3. The payment header in sessionStorage is the source of truth
      // If there's a mismatch, it will fail on the backend anyway
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      // Cronos docs use X-PAYMENT, but we also send other headers for compatibility
      headers["X-PAYMENT"] = paymentHeader;
      headers["X-PAYMENT-SIGNATURE"] = paymentHeader;
      headers["PAYMENT-SIGNATURE"] = paymentHeader;

      // CRITICAL: Clear payment IMMEDIATELY after sending request (before waiting for response)
      // This prevents reuse if user tries to execute again quickly
      // Each payment can only be used ONCE, so we clear it right away
      const clearPayment = () => {
        setPaymentHash(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`payment_${agentIdNum}`);
        }
      };

      const response = await fetch(`${apiUrl}/api/agents/${agentId}/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          input,
          paymentHash: hash,
        }),
      });

      // Parse response first to check for errors
      const data = await response.json();

      // Clear payment AFTER checking response (but before processing)
      // This prevents reuse while still allowing us to handle errors properly
      clearPayment();

      if (response.status === 402 || data.paymentRequired) {
        // Payment expired, invalid, or already used - clear and show payment UI
        console.warn("Payment error - requiring new payment:", data.error || data.details);
        setPaymentError(data.details || data.error || "Payment expired or invalid. Please create a new payment.");
        setShowPayment(true);
        setResult(null);
        return;
      }

      if (data.error) {
        // If error mentions "payment" or "already used", show payment UI
        const isPaymentError = data.error.toLowerCase().includes("payment") || 
                               data.error.toLowerCase().includes("already used") ||
                               data.details?.toLowerCase().includes("payment already used") ||
                               data.details?.toLowerCase().includes("payment");
        
        if (isPaymentError) {
          console.warn("Payment-related error - requiring new payment:", data.error, data.details);
          setPaymentError(data.details || data.error || "Payment was already used or invalid. Please create a new payment.");
          setShowPayment(true);
        } else {
          setPaymentError(null);
        }
        setResult(`Error: ${data.error}${data.details ? ` - ${data.details}` : ''}`);
      } else {
        setResult(data.output);
        setPaymentError(null);
        
        // Refresh agent data to show updated metrics
        // Wait a bit for blockchain to confirm (2-3 seconds)
        setTimeout(async () => {
          // Refetch API data
          await fetchAgent();
          // Refetch contract data via wagmi
          const { agentRegistry } = getContractAddresses();
          await queryClient.invalidateQueries({
            queryKey: [
              "readContract",
              {
                address: agentRegistry,
                functionName: "getAgent",
                args: [BigInt(agentIdNum)],
              },
            ],
          });
        }, 3000);
      }
    } catch (error) {
      console.error("Error executing agent:", error);
      setResult("Failed to execute agent");
      // Clear payment on any error - user will need to create a new one
      setPaymentHash(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`payment_${agentIdNum}`);
      }
      setPaymentError("Execution failed. Please create a new payment to try again.");
      setShowPayment(true);
    } finally {
      setExecuting(false);
    }
  };

  const handleExecute = () => {
    // CRITICAL: Each execution requires a NEW payment
    // If no payment hash in state, user must create a new payment
    if (!paymentHash) {
      setPaymentError(null);
      setShowPayment(true);
      return;
    }
    
    // Execute with the payment hash we have
    // Note: Payment will be cleared immediately after execution (success or failure)
    executeAgent(paymentHash);
  };

  if (loading || contractLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <TetrisLoading size="md" speed="normal" loadingText="Loading agent..." />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-xl text-neutral-400">Agent not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-50">
      {/* Header at the top */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-neutral-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <a 
                href="/" 
                className="inline-flex items-center text-neutral-400 hover:text-neutral-300 font-medium transition-colors"
              >
                ← Back
              </a>
              <div className="h-6 w-px bg-neutral-700"></div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
                  AgentMarket
                </h1>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 md:py-8">

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 shadow-lg p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            {agent.name}
          </h1>
          <p className="text-base md:text-lg text-neutral-400 mb-6">
            {agent.description}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
              <div className="text-xs text-neutral-400 font-medium mb-1">Price</div>
              <div className="text-xl md:text-2xl font-bold text-neutral-50">
                ${agent.price}
              </div>
              <div className="text-xs text-neutral-500 mt-1">USDC</div>
            </div>
            <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
              <div className="text-xs text-neutral-400 font-medium mb-1">Reputation</div>
              <div className="text-xl md:text-2xl font-bold text-neutral-50">
                {agent.reputation}
              </div>
              <div className="text-xs text-neutral-500 mt-1">/1000</div>
            </div>
            <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
              <div className="text-xs text-neutral-400 font-medium mb-1">Executions</div>
              <div className="text-xl md:text-2xl font-bold text-neutral-50">
                {agent.totalExecutions}
              </div>
              <div className="text-xs text-neutral-500 mt-1">Total</div>
            </div>
            <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
              <div className="text-xs text-neutral-400 font-medium mb-1">Success Rate</div>
              <div className="text-xl md:text-2xl font-bold text-neutral-50">
                {agent.totalExecutions > 0
                  ? Math.round(
                      (agent.successfulExecutions / agent.totalExecutions) * 100
                    )
                  : 0}%
              </div>
              <div className="text-xs text-neutral-500 mt-1">Reliability</div>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 shadow-lg p-6 md:p-8">
          <h2 className="text-2xl font-bold mb-4 text-neutral-50">Execute Agent</h2>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-neutral-300">
              Input
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-4 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-neutral-600 focus:border-neutral-600 text-neutral-50 placeholder-neutral-500 transition-colors"
              rows={6}
              placeholder="Enter your input here... (e.g., 'Create a tweet about DeFi', 'Analyze this smart contract', etc.)"
            />
          </div>
          {showPayment ? (
            <X402Payment
              priceUsd={agent.price}
              agentId={agentIdNum}
              onPaymentComplete={handlePaymentComplete}
              onError={handlePaymentError}
            />
          ) : (
            <button
              onClick={handleExecute}
              disabled={executing || !input.trim()}
              className="w-full bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:opacity-50 text-neutral-50 py-3 rounded-lg font-medium border border-neutral-700 hover:border-neutral-600 disabled:border-neutral-800 disabled:cursor-not-allowed transition-all duration-200"
            >
              {executing
                ? "Executing Agent..."
                : paymentHash
                  ? `Execute Agent ($${agent.price} USDC)`
                  : `Pay & Execute ($${agent.price} USDC)`}
            </button>
          )}

          {paymentError && (
            <div className="mt-4 p-4 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-sm">
              <strong className="text-red-400">Error:</strong> <span className="text-neutral-400">{paymentError}</span>
            </div>
          )}

          {result && (
            <div className="mt-6 p-5 bg-neutral-800 rounded-lg border border-neutral-700">
              <h3 className="font-semibold mb-3 text-neutral-50 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Result:
              </h3>
              <pre className="whitespace-pre-wrap text-sm text-neutral-300 leading-relaxed">
                {result}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
