"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useX402Payment } from "@/hooks/useX402Payment";
import { getContractAddresses } from "@/lib/contracts";

interface X402PaymentProps {
  priceUsd: number;
  agentId: number;
  onPaymentComplete: (paymentHash: string) => void;
  onError: (error: string) => void;
}

export function X402Payment({
  priceUsd,
  agentId,
  onPaymentComplete,
  onError,
}: X402PaymentProps) {
  const { address, isConnected } = useAccount();
  const { requestPayment, signPayment, buildPaymentPayload } = useX402Payment();
  const [paying, setPaying] = useState(false);

  const handlePayment = async () => {
    if (!isConnected || !address) {
      onError("Please connect your wallet first");
      return;
    }

    setPaying(true);

    try {
      const { agentEscrow } = getContractAddresses();
      if (agentEscrow === "0x...") {
        onError("Contract not deployed. Please set AGENT_ESCROW_ADDRESS");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const resourceUrl = `${apiUrl}/api/agents/${agentId}/execute`;

      // Step 1: Request payment requirements from backend
      const paymentRequest = await requestPayment(
        priceUsd,
        agentEscrow,
        resourceUrl
      );

      // Step 2: Sign payment with wallet
      const signature = await signPayment(paymentRequest);

      // Step 3: Build payment payload
      const { header: paymentHeader, hash: paymentHash } = await buildPaymentPayload(
        paymentRequest,
        signature
      );

      // Store payment header for submission to backend
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`payment_${agentId}`, paymentHeader);
      }

      onPaymentComplete(paymentHash);
    } catch (error: any) {
      if (error.code === 4001) {
        onError("Transaction rejected by user");
      } else {
        onError(error.message || "Payment failed");
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handlePayment}
        disabled={paying || !isConnected}
        className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {paying
          ? "Processing Payment..."
          : `Pay $${priceUsd.toFixed(2)} USDC via x402`}
      </button>
      {!isConnected && (
        <p className="text-sm text-gray-500 mt-2 text-center">
          Connect wallet to pay
        </p>
      )}
    </div>
  );
}
