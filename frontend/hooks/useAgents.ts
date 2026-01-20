"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { AGENT_REGISTRY_ABI, getContractAddresses } from "@/lib/contracts";
import { useState, useEffect } from "react";

export interface Agent {
  id: number;
  developer: string;
  name: string;
  description: string;
  pricePerExecution: bigint;
  totalExecutions: bigint;
  successfulExecutions: bigint;
  reputation: bigint;
  active: boolean;
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const { agentRegistry } = getContractAddresses();

  // Get total number of agents
  const { data: nextAgentId } = useReadContract({
    address: agentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "nextAgentId",
    query: {
      enabled: agentRegistry !== "0x...",
    },
  });

  // Fetch all agents
  useEffect(() => {
    if (!nextAgentId || agentRegistry === "0x...") {
      return;
    }

    const agentIds = Array.from(
      { length: Number(nextAgentId) },
      (_, i) => i + 1
    );

    // For now, return empty array - will implement contract reads
    // This requires multiple contract calls which we'll optimize later
    setAgents([]);
  }, [nextAgentId, agentRegistry]);

  return { agents, loading: false };
}

export function useAgent(agentId: number) {
  const { agentRegistry } = getContractAddresses();

  const { data, isLoading } = useReadContract({
    address: agentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: [BigInt(agentId)],
    query: {
      enabled: agentRegistry !== "0x..." && agentId > 0,
    },
  });

  if (!data) {
    return { agent: null, loading: isLoading };
  }

  const agent: Agent = {
    id: agentId,
    developer: data[0],
    name: data[1],
    description: data[2],
    pricePerExecution: data[3],
    totalExecutions: data[4],
    successfulExecutions: data[5],
    reputation: data[6],
    active: data[7],
  };

  return { agent, loading: isLoading };
}
