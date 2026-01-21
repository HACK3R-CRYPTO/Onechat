"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { AGENT_REGISTRY_ABI, getContractAddresses } from "@/lib/contracts";
import { useMemo } from "react";

export interface Execution {
  id: number;
  agentId: number;
  user: string;
  paymentHash: string;
  input: string;
  output: string;
  verified: boolean;
  timestamp: bigint;
}

export function useExecutions(limit?: number) {
  const { agentRegistry } = getContractAddresses();

  // Get total number of executions
  const { data: nextExecutionId } = useReadContract({
    address: agentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: "nextExecutionId",
    query: {
      enabled: agentRegistry !== "0x..." && agentRegistry !== "0x",
      refetchInterval: 5000,
    },
  });

  // Build execution IDs to fetch (most recent first)
  const executionIds = useMemo(() => {
    if (!nextExecutionId) return [];
    const total = Number(nextExecutionId);
    if (total === 0) return [];
    
    // Get most recent executions
    const start = Math.max(1, total - (limit || 10) + 1);
    const ids: number[] = [];
    for (let i = total; i >= start && i > 0; i--) {
      ids.push(i);
    }
    return ids;
  }, [nextExecutionId, limit]);

  // Fetch executions
  const contractReads = useMemo(() => {
    return executionIds.map((id) => ({
      address: agentRegistry as `0x${string}`,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getExecution" as const,
      args: [BigInt(id)],
    }));
  }, [executionIds, agentRegistry]);

  const { data: executionsData, isLoading } = useReadContracts({
    contracts: contractReads,
    query: {
      enabled: agentRegistry !== "0x..." && agentRegistry !== "0x" && executionIds.length > 0,
      refetchInterval: 5000,
    },
  });

  // Process executions
  const executions = useMemo(() => {
    if (!executionsData || !executionIds.length) return [];

    return executionsData
      .map((data, index) => {
        if (!data || data.status !== "success" || !data.result) return null;
        const result = data.result as any;
        const executionId = executionIds[index];

        // Check if execution exists (agentId != 0)
        if (!result.agentId || result.agentId === BigInt(0)) return null;

        return {
          id: executionId,
          agentId: Number(result.agentId),
          user: result.user,
          paymentHash: result.paymentHash,
          input: result.input,
          output: result.output,
          verified: result.verified,
          timestamp: result.timestamp,
        } as Execution;
      })
      .filter((exec): exec is Execution => exec !== null);
  }, [executionsData, executionIds]);

  return { executions, loading: isLoading };
}
