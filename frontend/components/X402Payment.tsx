"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

interface X402PaymentProps {
  priceUsd: number;
  onPaymentComplete: (paymentHash: string) => void;
  onError: (error: string) => void;
}

export function X402Payment({
  priceUsd,
  onPaymentComplete,
  onError,
}: X402PaymentProps) {
  const { address, isConnected } = useAccount();
  const [paying, setPaying] = useState(false);

  const handlePayment = async () => {
    if (!isConnected || !address) {
      onError("Please connect your wallet first");
      return;
    }

    setPaying(true);

    try {
      // TODO: Implement actual x402 payment flow
      // This is a placeholder for the x402 payment integration
      // You'll need to:
      // 1. Request payment from x402 facilitator
      // 2. Get payment signature from user
      // 3. Return payment hash

      // For now, simulate payment
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockPaymentHash = `0x${Math.random().toString(16).slice(2)}`;
      onPaymentComplete(mockPaymentHash);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Payment failed");
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
