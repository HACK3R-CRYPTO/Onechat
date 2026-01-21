"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { AGENT_REGISTRY_ABI, getContractAddresses } from "@/lib/contracts";
import { useAgents } from "./useAgents";
import { useMemo } from "react";

export interface PlatformStats {
  totalAgents: number;
  totalExecutions: number;
  totalSuccessfulExecutions: number;
  totalRevenue: string;
  successRate: string;
}

export function usePlatformStats() {
  const { agentRegistry } = getContractAddresses();
  const { agents } = useAgents();

  // Get nextExecutionId (total executions)
  const { data: nextExecutionId } = useReadContract({
    address: agentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "nextExecutionId",
    query: {
      enabled: agentRegistry !== "0x..." && agentRegistry !== "0x",
      refetchInterval: 5000,
    },
  });

  // Calculate stats from contract data
  const stats = useMemo<PlatformStats>(() => {
    const totalAgents = agents.length;
    
    // Sum up all agent stats
    const totalExecutions = agents.reduce(
      (sum, agent) => sum + Number(agent.totalExecutions),
      0
    );
    
    const totalSuccessfulExecutions = agents.reduce(
      (sum, agent) => sum + Number(agent.successfulExecutions),
      0
    );

    // Calculate revenue (sum of pricePerExecution * successfulExecutions for each agent)
    const totalRevenue = agents.reduce((sum, agent) => {
      const price = Number(agent.pricePerExecution) / 1_000_000; // Convert from 6 decimals
      const successful = Number(agent.successfulExecutions);
      return sum + price * successful;
    }, 0);

    // Calculate success rate
    const successRate =
      totalExecutions > 0
        ? ((totalSuccessfulExecutions / totalExecutions) * 100).toFixed(1)
        : "0";

    return {
      totalAgents,
      totalExecutions,
      totalSuccessfulExecutions,
      totalRevenue: totalRevenue.toFixed(2),
      successRate,
    };
  }, [agents]);

  return { stats, loading: false };
}
