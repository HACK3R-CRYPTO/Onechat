"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { AGENT_REGISTRY_ABI, getContractAddresses } from "@/lib/contracts";
import { useState, useEffect, useMemo } from "react";

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
  const { data: nextAgentId, error: nextAgentIdError, refetch: refetchNextAgentId } = useReadContract({
    address: agentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "nextAgentId",
    query: {
      enabled: agentRegistry !== "0x..." && agentRegistry !== "0x",
      refetchInterval: 5000, // Refetch every 5 seconds to catch new agents
    },
  });

  // Log errors for debugging
  useEffect(() => {
    if (nextAgentIdError) {
      console.error("Error fetching nextAgentId:", nextAgentIdError);
    }
  }, [nextAgentIdError]);

  // Build contract read requests for all agents
  // Use useMemo to prevent infinite loops - only recreate when nextAgentId changes
  const agentIds = useMemo(() => {
    if (!nextAgentId) return [];
    return Array.from({ length: Number(nextAgentId) }, (_, i) => i + 1);
  }, [nextAgentId]);

  const contractReads = useMemo(() => {
    return agentIds.map((id) => ({
      address: agentRegistry as `0x${string}`,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getAgent" as const,
      args: [BigInt(id)],
    }));
  }, [agentIds, agentRegistry]);

  const { data: agentsData, isLoading, error: agentsError, refetch: refetchAgents } = useReadContracts({
    contracts: contractReads,
    query: {
      enabled: agentRegistry !== "0x..." && agentRegistry !== "0x" && agentIds.length > 0,
      refetchInterval: 5000, // Refetch every 5 seconds to catch new agents
    },
  });

  // Log errors for debugging
  useEffect(() => {
    if (agentsError) {
      console.error("Error fetching agents from contract:", agentsError);
    }
  }, [agentsError]);

  // Process agents data
  // Use useMemo to prevent unnecessary recalculations
  const processedAgents = useMemo(() => {
    if (!agentsData || !agentIds.length) {
      return [];
    }

    return agentsData
      .map((data, index) => {
        if (!data || data.status !== "success" || !data.result) return null;
        const result = data.result as any;
        
        // viem returns tuples as objects with component names as keys when output name is empty
        // When output name is "", viem returns the tuple directly as an object
        // Log for debugging (only for first 2 agents to see the pattern)
        if (index < 2) {
          console.log(`[useAgents] Agent ${agentIds[index]} result:`, result);
          console.log(`[useAgents] Result keys:`, result && typeof result === 'object' ? Object.keys(result) : 'N/A');
        }
        
        // viem returns tuple directly as object when output name is empty string
        // Structure: { developer: address, name: string, description: string, ... }
        let agent;
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          // Direct object access (viem tuple format with named components)
          agent = {
            id: agentIds[index],
            developer: result.developer,
            name: result.name,
            description: result.description,
            pricePerExecution: result.pricePerExecution,
            totalExecutions: result.totalExecutions,
            successfulExecutions: result.successfulExecutions,
            reputation: result.reputation,
            active: result.active,
          };
        } else if (Array.isArray(result)) {
          // Array access (fallback - shouldn't happen with viem but just in case)
          agent = {
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
        } else {
          console.error(`[useAgents] Unknown result format for agent ${agentIds[index]}:`, result);
          return null;
        }
        
        // Only filter out if agent is truly invalid (no developer means agent doesn't exist)
        if (!agent.developer || agent.developer === '0x0000000000000000000000000000000000000000') {
          if (index < 5) { // Only log first few to avoid spam
            console.log(`[useAgents] Agent ${agentIds[index]} doesn't exist (no developer) - skipping`);
          }
          return null;
        }
        
        // Allow agents with missing name/description (might be edge case)
        if (!agent.name || agent.name === '') {
          if (index < 5) {
            console.warn(`[useAgents] Agent ${agentIds[index]} has no name, using fallback. Raw result:`, result);
          }
          agent.name = `Agent ${agentIds[index]}`;
        }
        if (!agent.description || agent.description === '') {
          agent.description = 'No description available';
        }
        
        return agent;
      })
      .filter((agent): agent is Agent => {
        if (!agent) return false;
        // Only filter by active if agent has valid data
        // Sometimes new agents might not have all fields set yet
        return agent.active !== false;
      });
  }, [agentsData, agentIds]);

  // Update state only when processedAgents actually changes
  useEffect(() => {
    console.log("[useAgents] Processed agents:", processedAgents.length, processedAgents);
    setAgents(processedAgents);
  }, [processedAgents]);

  // Log when nextAgentId changes (new agent registered)
  useEffect(() => {
    if (nextAgentId) {
      console.log("[useAgents] Total agents on contract:", Number(nextAgentId));
    }
  }, [nextAgentId]);

  return { agents, loading: isLoading };
}

export function useAgent(agentId: number) {
  const { agentRegistry } = getContractAddresses();

  const { data, isLoading, refetch } = useReadContract({
    address: agentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: [BigInt(agentId)],
    query: {
      enabled: agentRegistry !== "0x..." && agentId > 0,
      refetchInterval: 5000, // Auto-refetch every 5 seconds to catch metric updates
    },
  });

  if (!data) {
    return { agent: null, loading: isLoading };
  }

  // viem returns tuples as objects with component names as keys
  const agent: Agent = {
    id: agentId,
    developer: (data as any).developer ?? (data as any)[0],
    name: (data as any).name ?? (data as any)[1],
    description: (data as any).description ?? (data as any)[2],
    pricePerExecution: (data as any).pricePerExecution ?? (data as any)[3],
    totalExecutions: (data as any).totalExecutions ?? (data as any)[4],
    successfulExecutions: (data as any).successfulExecutions ?? (data as any)[5],
    reputation: (data as any).reputation ?? (data as any)[6],
    active: (data as any).active ?? (data as any)[7],
  };

  return { agent, loading: isLoading, refetch };
}
