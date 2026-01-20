"use client";

import { useAccount, useSignTypedData } from "wagmi";
import { getAddress, toHex } from "viem";
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

    return {
      x402Version: 2,
      resource: {
        url: resourceUrl,
        description: `Payment for agent execution`,
        mimeType: "application/json",
      },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:338",
          amount,
          payTo: getAddress(payTo),
          asset: getAddress(USDC_CRONOS_TESTNET),
          maxTimeoutSeconds: 300,
          extra: {
            name: "USDC",
            version: "2",
          },
        },
      ],
    };
  }

  async function signPayment(
    paymentRequest: PaymentRequest
  ): Promise<string> {
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
    const validAfter = BigInt(now - 600);
    const validBefore = BigInt(now + maxTimeoutSeconds);
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

    const domain = {
      name: firstAccept.extra.name,
      version: firstAccept.extra.version,
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

    return signature;
  }

  async function buildPaymentPayload(
    paymentRequest: PaymentRequest,
    signature: string
  ): Promise<{ header: string; hash: string }> {
    const firstAccept = paymentRequest.accepts[0];
    if (!firstAccept || !address) {
      throw new Error("No payment option available or wallet not connected");
    }

    const now = Math.floor(Date.now() / 1000);
    const maxTimeoutSeconds = firstAccept.maxTimeoutSeconds || 300;
    const validAfter = String(now - 600);
    const validBefore = String(now + maxTimeoutSeconds);
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

    const paymentPayload = {
      x402Version: 2,
      payload: {
        signature,
        authorization: {
          from: getAddress(address),
          to: getAddress(firstAccept.payTo),
          value: firstAccept.amount,
          validAfter,
          validBefore,
          nonce,
        },
      },
      accepted: firstAccept,
      resource: paymentRequest.resource,
    };

    const header = btoa(JSON.stringify(paymentPayload));
    const hash = `0x${Buffer.from(header).toString("hex").slice(0, 64)}`;

    return { header, hash };
  }

  return {
    requestPayment,
    signPayment,
    buildPaymentPayload,
  };
}
