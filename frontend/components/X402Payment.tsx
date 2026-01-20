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
      // CRITICAL: Clear any old payment before creating a new one
      // This ensures we never reuse an old payment hash
      if (typeof window !== "undefined") {
        const oldPayment = sessionStorage.getItem(`payment_${agentId}`);
        if (oldPayment) {
          console.log("Clearing old payment before creating new one");
          sessionStorage.removeItem(`payment_${agentId}`);
        }
      }

      const { agentEscrow } = getContractAddresses();
      if (agentEscrow === "0x...") {
        onError("Contract not deployed. Please set AGENT_ESCROW_ADDRESS");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const resourceUrl = `${apiUrl}/api/agents/${agentId}/execute`;

      console.log("Creating NEW payment - this will generate a unique nonce and hash");

      // Step 1: Request payment requirements from backend
      const paymentRequest = await requestPayment(
        priceUsd,
        agentEscrow,
        resourceUrl
      );

      // Step 2: Sign payment with wallet (generates fresh random nonce each time)
      const { signature, nonce, validAfter, validBefore } = await signPayment(paymentRequest);

      // Step 3: Build payment payload using the SAME nonce and timestamps from signing
      const { header: paymentHeader, hash: paymentHash } = await buildPaymentPayload(
        paymentRequest,
        signature,
        nonce,
        validAfter,
        validBefore
      );

      console.log("New payment created with hash:", paymentHash);

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
        className="w-full bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:opacity-50 text-neutral-50 py-3 rounded-lg border border-neutral-700 hover:border-neutral-600 disabled:border-neutral-800 disabled:cursor-not-allowed transition-all duration-200 font-medium"
      >
        {paying
          ? "Processing Payment..."
          : `Pay $${priceUsd.toFixed(2)} USDC via x402`}
      </button>
      {!isConnected && (
        <p className="text-sm text-neutral-500 mt-2 text-center">
          Connect wallet to pay
        </p>
      )}
    </div>
  );
}
