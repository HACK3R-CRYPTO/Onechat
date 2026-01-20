"use client";

import { useState, useEffect } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { useAgents } from "@/hooks/useAgents";

interface Agent {
  id: number;
  name: string;
  description: string;
  price: number;
  reputation: number;
}

export default function Home() {
  const { agents: contractAgents, loading: contractLoading } = useAgents();
  const [apiAgents, setApiAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      console.log("Fetching agents from API:", apiUrl);
      const response = await fetch(`${apiUrl}/api/agents`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      console.log("API response:", data);
      setApiAgents(data.agents || []);
    } catch (error) {
      console.error("Error fetching agents from API:", error);
      // Set empty array on error so we don't show loading forever
      setApiAgents([]);
    } finally {
      setLoading(false);
    }
  };

  // Use contract agents if available, otherwise fall back to API
  const agents = contractAgents.length > 0 
    ? contractAgents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        price: Number(a.pricePerExecution) / 1_000_000, // Convert from 6 decimals
        reputation: Number(a.reputation),
      }))
    : apiAgents;

  // Debug logging
  useEffect(() => {
    console.log("Contract agents:", contractAgents);
    console.log("API agents:", apiAgents);
    console.log("Final agents:", agents);
  }, [contractAgents, apiAgents, agents]);

  if (loading || contractLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">AgentMarket</h1>
            <p className="text-lg text-gray-600">
              Buy AI agents. Use AI agents. Pay per use. On-chain verification.
            </p>
          </div>
          <WalletConnect />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-2xl font-semibold mb-2">{agent.name}</h2>
              <p className="text-gray-600 mb-4">{agent.description}</p>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-500">Price</div>
                  <div className="text-xl font-bold">${agent.price} USDC</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Reputation</div>
                  <div className="text-xl font-bold">{agent.reputation}/1000</div>
                </div>
              </div>
              <a
                href={`/agents/${agent.id}`}
                className="mt-4 block w-full text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
              >
                View Agent
              </a>
            </div>
          ))}
        </div>

        {agents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No agents available</p>
          </div>
        )}
      </div>
    </div>
  );
}
