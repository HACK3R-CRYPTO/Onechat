/**
 * x402 Payment Client for Frontend
 * Handles payment requests and signatures for Cronos
 */

interface PaymentRequest {
  network: string;
  amount: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
}

interface PaymentResponse {
  paymentHash: string;
  signature: string;
}

export async function requestPayment(
  priceUsd: number,
  payTo: string,
  testnet: boolean = true
): Promise<PaymentRequest> {
  const network = testnet ? "eip155:338" : "eip155:25";
  const usdcAddress = testnet
    ? "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0"
    : "0x..."; // Mainnet address

  // Convert USD to atomic units (6 decimals for USDC)
  const amount = Math.floor(priceUsd * 1_000_000).toString();

  return {
    network,
    amount,
    payTo,
    asset: usdcAddress,
    maxTimeoutSeconds: 300,
  };
}

export async function signPayment(
  paymentRequest: PaymentRequest,
  signer: any // ethers signer or viem wallet client
): Promise<string> {
  // This will be implemented with actual wallet signing
  // For now, return a placeholder
  // TODO: Implement actual EIP-3009 transferWithAuthorization signing
  throw new Error("Payment signing not yet implemented");
}

export function generatePaymentHash(
  paymentRequest: PaymentRequest,
  signature: string
): string {
  // Generate a unique hash for this payment
  // This should match what the backend expects
  const data = JSON.stringify({ paymentRequest, signature });
  // In production, use proper hashing
  return `0x${Buffer.from(data).toString("hex").slice(0, 64)}`;
}
