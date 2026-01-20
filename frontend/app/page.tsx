"use client";

import { useState, useEffect } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { useAgents } from "@/hooks/useAgents";
import { SplineSceneBasic } from "@/components/ui/spline-demo";
import TetrisLoading from "@/components/ui/tetris-loader";

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <TetrisLoading size="md" speed="normal" loadingText="Loading agents..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-50">
      {/* Header at the top */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-neutral-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
                AgentMarket
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                AI Agent Marketplace on Cronos
              </p>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Hero Section with 3D Spline */}
        <div className="mb-8 md:mb-12">
          <SplineSceneBasic />
        </div>

        {/* Section Header */}
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 mb-2">
            Available Agents
          </h2>
          <p className="text-sm md:text-base text-neutral-400">
            Select an agent to execute tasks with AI-powered capabilities
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-neutral-900 rounded-lg border border-neutral-800 shadow-lg hover:shadow-xl hover:border-neutral-700 transition-all duration-300 p-6 group"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-neutral-50 mb-2 group-hover:text-neutral-100 transition-colors">
                  {agent.name}
                </h3>
                <p className="text-sm text-neutral-400 line-clamp-2">
                  {agent.description}
                </p>
              </div>
              
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-neutral-800">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Price</div>
                  <div className="text-lg font-bold text-neutral-50">
                    ${agent.price}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Reputation</div>
                  <div className="text-lg font-bold text-neutral-50">
                    {agent.reputation}/1000
                  </div>
                </div>
              </div>
              
              <a
                href={`/agents/${agent.id}`}
                className="block w-full text-center bg-neutral-800 hover:bg-neutral-700 text-neutral-50 py-2.5 rounded-lg font-medium transition-all duration-200 border border-neutral-700 hover:border-neutral-600"
              >
                View Agent →
              </a>
            </div>
          ))}
        </div>

        {agents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-500">No agents available</p>
          </div>
        )}
      </div>
    </div>
  );
}
