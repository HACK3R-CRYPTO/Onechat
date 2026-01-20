"use client";

import { useAccount, useSignTypedData } from "wagmi";
import { getAddress, toHex, keccak256, toBytes } from "viem";
import { CRONOS_TESTNET } from "@/lib/contracts";

interface PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
  extra: {
    name: string;
    version: string;
  };
}

interface PaymentRequest {
  x402Version: number;
  resource: {
    url: string;
    description?: string;
    mimeType: string;
  };
  accepts: PaymentRequirement[];
}

const USDC_CRONOS_TESTNET = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";

export function useX402Payment() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  async function requestPayment(
    priceUsd: number,
    payTo: string,
    resourceUrl: string
  ): Promise<PaymentRequest> {
    const amount = Math.floor(priceUsd * 1_000_000).toString();

    // Cronos facilitator supports x402Version 1
    return {
      x402Version: 1,
      resource: {
        url: resourceUrl,
        description: `Payment for agent execution`,
        mimeType: "application/json",
      },
      accepts: [
        {
          scheme: "exact",
          network: "cronos-testnet",
          amount,
          payTo: getAddress(payTo),
          asset: getAddress(USDC_CRONOS_TESTNET),
          maxTimeoutSeconds: 300,
          extra: {
            name: "Bridged USDC (Stargate)",
            version: "1",
          },
        },
      ],
    };
  }

  async function signPayment(
    paymentRequest: PaymentRequest
  ): Promise<{ signature: string; nonce: string; validAfter: string; validBefore: string }> {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected");
    }

    const firstAccept = paymentRequest.accepts[0];
    if (!firstAccept) {
      throw new Error("No payment option available");
    }

    const from = getAddress(address);
    const to = getAddress(firstAccept.payTo);
    const asset = getAddress(firstAccept.asset);
    const value = BigInt(firstAccept.amount);
    const maxTimeoutSeconds = firstAccept.maxTimeoutSeconds || 300;

    const now = Math.floor(Date.now() / 1000);
    // According to Cronos docs: validAfter = 0 (valid immediately)
    const validAfter = BigInt(0);
    const validBefore = BigInt(now + maxTimeoutSeconds);
    
    // CRITICAL: Generate a fresh random nonce each time
    // This ensures each payment is unique, even with the same agent input
    // Using crypto.getRandomValues ensures cryptographically secure randomness
    const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
    const nonce = toHex(nonceBytes);
    
    // Log for debugging - verify nonce is unique each time
    console.log("Generated new payment nonce:", nonce.slice(0, 20) + "...", "at", new Date().toISOString());

    // EIP-712 domain per Cronos documentation
    const domain = {
      name: "Bridged USDC (Stargate)",
      version: "1",
      chainId: CRONOS_TESTNET.id,
      verifyingContract: asset,
    };

    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    const message = {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
    };

    const signature = await signTypedDataAsync({
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
    });

    // Return signature AND the values used for signing so they can be reused in payment header
    return {
      signature,
      nonce,
      validAfter: "0", // String format for payment header
      validBefore: String(validBefore), // String format for payment header
    };
  }

  async function buildPaymentPayload(
    paymentRequest: PaymentRequest,
    signature: string,
    nonce: string,
    validAfter: string,
    validBefore: string
  ): Promise<{ header: string; hash: string }> {
    const firstAccept = paymentRequest.accepts[0];
    if (!firstAccept || !address) {
      throw new Error("No payment option available or wallet not connected");
    }

    // Use the EXACT same nonce, validAfter, and validBefore that were used for signing
    // This is critical - the signature verification will fail if these don't match!
    const paymentHeader = {
      x402Version: 1,
      scheme: firstAccept.scheme,
      network: firstAccept.network,
      payload: {
        from: getAddress(address),
        to: getAddress(firstAccept.payTo),
        value: firstAccept.amount,
        validAfter: validAfter,
        validBefore: validBefore,
        nonce: nonce,
        signature: signature,
        asset: getAddress(firstAccept.asset),
      },
    };

    const header = btoa(JSON.stringify(paymentHeader));
    
    // Generate payment hash from the header using keccak256 (same as backend)
    // The hash is deterministic based on the payment header, which includes:
    // - Random nonce (generated fresh each time with crypto.getRandomValues - line 90)
    // - Unique signature (based on nonce, so different each time)
    // - Timestamp-based validBefore (changes each second)
    // 
    // This ensures each payment hash is unique, even with the same agent input,
    // because the nonce is randomly generated each time signPayment() is called.
    // 
    // IMPORTANT: Use the same hash function as backend: keccak256(header)
    // Backend uses: ethers.keccak256(ethers.toUtf8Bytes(headerString))
    // We use: keccak256(toBytes(header)) which is equivalent
    const hash = keccak256(toBytes(header));
    
    // Log for debugging - each payment should have a unique hash
    console.log("Generated payment hash:", hash, "Nonce:", nonce.slice(0, 20) + "...");
    console.log("Header length:", header.length, "Header preview:", header.slice(0, 50) + "...");

    return { header, hash };
  }

  return {
    requestPayment,
    signPayment,
    buildPaymentPayload,
  };
}
