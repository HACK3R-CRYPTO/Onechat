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
  const { data: nextAgentId, error: nextAgentIdError } = useReadContract({
    address: agentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "nextAgentId",
    query: {
      enabled: agentRegistry !== "0x..." && agentRegistry !== "0x",
    },
  });

  // Log errors for debugging
  useEffect(() => {
    if (nextAgentIdError) {
      console.error("Error fetching nextAgentId:", nextAgentIdError);
    }
  }, [nextAgentIdError]);

  // Build contract read requests for all agents
  const agentIds = nextAgentId 
    ? Array.from({ length: Number(nextAgentId) }, (_, i) => i + 1)
    : [];

  const contractReads = agentIds.map((id) => ({
    address: agentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent" as const,
    args: [BigInt(id)],
  }));

  const { data: agentsData, isLoading, error: agentsError } = useReadContracts({
    contracts: contractReads,
    query: {
      enabled: agentRegistry !== "0x..." && agentRegistry !== "0x" && agentIds.length > 0,
    },
  });

  // Log errors for debugging
  useEffect(() => {
    if (agentsError) {
      console.error("Error fetching agents from contract:", agentsError);
    }
  }, [agentsError]);

  // Process agents data
  useEffect(() => {
    if (!agentsData || !agentIds.length) {
      setAgents([]);
      return;
    }

    const processedAgents: Agent[] = agentsData
      .map((data, index) => {
        if (!data || !data.result) return null;
        const result = data.result as any;
        return {
          id: agentIds[index],
          developer: result[0],
          name: result[1],
          description: result[2],
          pricePerExecution: result[3],
          totalExecutions: result[4],
          successfulExecutions: result[5],
          reputation: result[6],
          active: result[7],
        };
      })
      .filter((agent): agent is Agent => agent !== null && agent.active);

    setAgents(processedAgents);
  }, [agentsData, agentIds]);

  return { agents, loading: isLoading };
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
