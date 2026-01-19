"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { WalletConnect } from "@/components/WalletConnect";
import { X402Payment } from "@/components/X402Payment";

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
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/agents/${agentId}`);
      const data = await response.json();
      setAgent(data.agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = (hash: string) => {
    setPaymentHash(hash);
    setShowPayment(false);
    setPaymentError(null);
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

    setExecuting(true);
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/agents/${agentId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input,
          paymentHash: hash,
        }),
      });

      const data = await response.json();

      if (response.status === 402) {
        setPaymentError("Payment verification failed");
        setShowPayment(true);
        return;
      }

      if (data.error) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult(data.output);
      }
    } catch (error) {
      console.error("Error executing agent:", error);
      setResult("Failed to execute agent");
    } finally {
      setExecuting(false);
    }
  };

  const handleExecute = () => {
    if (!paymentHash) {
      setShowPayment(true);
      return;
    }
    executeAgent(paymentHash);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading agent...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Agent not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <a href="/" className="text-blue-600 hover:underline">
            ← Back to Marketplace
          </a>
          <WalletConnect />
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h1 className="text-4xl font-bold mb-4">{agent.name}</h1>
          <p className="text-lg text-gray-600 mb-6">{agent.description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-500">Price</div>
              <div className="text-2xl font-bold">${agent.price} USDC</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Reputation</div>
              <div className="text-2xl font-bold">{agent.reputation}/1000</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Executions</div>
              <div className="text-2xl font-bold">{agent.totalExecutions}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Success Rate</div>
              <div className="text-2xl font-bold">
                {agent.totalExecutions > 0
                  ? Math.round(
                      (agent.successfulExecutions / agent.totalExecutions) * 100
                    )
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-4">Execute Agent</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Input</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-3 border rounded-lg"
              rows={6}
              placeholder="Enter your input here..."
            />
          </div>
          {showPayment ? (
            <X402Payment
              priceUsd={agent.price}
              onPaymentComplete={handlePaymentComplete}
              onError={handlePaymentError}
            />
          ) : (
            <button
              onClick={handleExecute}
              disabled={executing || !input.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {executing
                ? "Executing..."
                : paymentHash
                  ? `Execute Agent ($${agent.price} USDC)`
                  : `Pay & Execute ($${agent.price} USDC)`}
            </button>
          )}

          {paymentError && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {paymentError}
            </div>
          )}

          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Result:</h3>
              <pre className="whitespace-pre-wrap text-sm">{result}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
