/**
 * x402 Facilitator Integration for Cronos
 *
 * Uses the official @x402/core and @x402/evm SDKs for payment verification and settlement.
 * Handles payment verification and settlement with the Cronos x402 facilitator.
 */

import {
  x402ResourceServer,
  HTTPFacilitatorClient,
} from "@x402/core/server";
import {
  decodePaymentSignatureHeader,
} from "@x402/core/http";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
  AssetAmount,
} from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";

// Configuration from environment
const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://x402.cronos.org/facilitator";

// Networks (typed as template literals for SDK compatibility)
const CRONOS_TESTNET = "eip155:338" as const;
const CRONOS_MAINNET = "eip155:25" as const;

// USDC.e contract addresses on Cronos
const USDC_CRONOS_TESTNET = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";
const USDC_CRONOS_MAINNET = "0x..."; // Update when mainnet address available

// Chain IDs
const CRONOS_TESTNET_CHAIN_ID = 338;
const CRONOS_MAINNET_CHAIN_ID = 25;

// Debug logging prefix
const LOG_PREFIX = "[x402-facilitator]";

function debugLog(message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : "");
}

function errorLog(message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, error);
}

let resourceServer: x402ResourceServer | null = null;
let serverInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function getResourceServer(): Promise<x402ResourceServer> {
  if (!resourceServer) {
    debugLog("Initializing x402 resource server", {
      facilitatorUrl: FACILITATOR_URL,
      networks: [CRONOS_TESTNET],
    });

    const facilitatorClient = new HTTPFacilitatorClient({
      url: FACILITATOR_URL,
    });

    resourceServer = new x402ResourceServer(facilitatorClient).register(
      CRONOS_TESTNET,
      new ExactEvmScheme()
    );
  }

  if (!serverInitialized) {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        try {
          await resourceServer!.initialize();
          serverInitialized = true;
          debugLog("x402 resource server initialized successfully");
          debugLog("hasRegisteredScheme", resourceServer!.hasRegisteredScheme(CRONOS_TESTNET, "exact"));
          debugLog("getSupportedKind", resourceServer!.getSupportedKind(2, CRONOS_TESTNET, "exact"));
        } catch (error) {
          errorLog("Failed to initialize x402 resource server", error);
          throw error;
        }
      })();
    }
    await initializationPromise;
  }

  return resourceServer;
}

// Export function to pre-initialize facilitator on server startup
export async function initializeFacilitator(): Promise<void> {
  await getResourceServer();
}

export type { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse };

export function usdToUsdc(usdAmount: number, testnet = true): AssetAmount {
  const asset = testnet ? USDC_CRONOS_TESTNET : USDC_CRONOS_MAINNET;
  const amount = Math.floor(usdAmount * 1_000_000).toString();

  debugLog("Converting USD to USDC", {
    usdAmount,
    atomicAmount: amount,
    asset,
    testnet,
  });

  return {
    asset,
    amount,
    extra: {
      name: "USDC",
      version: "2",
    },
  };
}

export function buildExactPaymentOption(config: {
  price: AssetAmount;
  payTo: string;
  testnet?: boolean;
  maxTimeoutSeconds?: number;
}) {
  const network = config.testnet ? CRONOS_TESTNET : CRONOS_MAINNET;

  const option = {
    scheme: "exact" as const,
    network,
    price: config.price,
    payTo: config.payTo,
    maxTimeoutSeconds: config.maxTimeoutSeconds ?? 300,
  };

  debugLog("Built exact payment option", option);
  return option;
}

export function parsePaymentSignature(request: Request): PaymentPayload | null {
  const signatureFromX = request.headers.get("X-PAYMENT-SIGNATURE");
  const signatureFromPlain = request.headers.get("PAYMENT-SIGNATURE");
  const signature = signatureFromX || signatureFromPlain;

  debugLog("Parsing payment signature from headers", {
    hasXPaymentSignature: !!signatureFromX,
    hasPaymentSignature: !!signatureFromPlain,
    signatureLength: signature?.length,
  });

  if (!signature) {
    debugLog("No payment signature found in headers");
    return null;
  }

  try {
    const decoded = decodePaymentSignatureHeader(signature);
    debugLog("Successfully decoded payment signature", {
      x402Version: decoded.x402Version,
      resource: decoded.resource,
      accepted: decoded.accepted,
    });
    return decoded;
  } catch (error) {
    errorLog("Failed to decode payment signature", error);
    return null;
  }
}

export async function verifyPayment(
  payload: PaymentPayload,
  expectedDetails: {
    priceUsd: number;
    payTo: string;
    testnet?: boolean;
  }
): Promise<{
  valid: boolean;
  invalidReason?: string;
  payerAddress?: string;
  chainId?: number;
}> {
  debugLog("=== VERIFY PAYMENT START ===");
  debugLog("Expected details", expectedDetails);

  try {
    const server = await getResourceServer();
    const network = expectedDetails.testnet ? CRONOS_TESTNET : CRONOS_MAINNET;

    const priceAsset = usdToUsdc(expectedDetails.priceUsd, expectedDetails.testnet);
    const paymentOption = buildExactPaymentOption({
      price: priceAsset,
      payTo: expectedDetails.payTo,
      testnet: expectedDetails.testnet,
    });

    const paymentRequirements = await server.buildPaymentRequirementsFromOptions(
      [paymentOption],
      undefined
    );

    const paymentRequirement = paymentRequirements[0];
    if (!paymentRequirement) {
      errorLog("Failed to build payment requirements");
      return {
        valid: false,
        invalidReason: "Failed to build payment requirements",
      };
    }

    debugLog("Calling facilitator verifyPayment...");
    const verifyResult = await server.verifyPayment(payload, paymentRequirement);

    debugLog("Facilitator verification result", {
      isValid: verifyResult?.isValid,
      invalidReason: verifyResult?.invalidReason,
      payer: verifyResult?.payer,
    });

    if (!verifyResult || !verifyResult.isValid) {
      errorLog("Payment verification failed", {
        isValid: verifyResult?.isValid,
        invalidReason: verifyResult?.invalidReason,
      });
      return {
        valid: false,
        invalidReason: verifyResult?.invalidReason || "Payment verification failed",
      };
    }

    const payerAddress = verifyResult.payer || extractPayerAddress(payload);
    const chainId = expectedDetails.testnet
      ? CRONOS_TESTNET_CHAIN_ID
      : CRONOS_MAINNET_CHAIN_ID;

    debugLog("=== VERIFY PAYMENT SUCCESS ===", {
      payerAddress,
      chainId,
    });

    return {
      valid: true,
      payerAddress: payerAddress ?? undefined,
      chainId,
    };
  } catch (error) {
    errorLog("Payment verification threw exception", error);
    return {
      valid: false,
      invalidReason: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

export async function settlePayment(
  payload: PaymentPayload,
  expectedDetails: {
    priceUsd: number;
    payTo: string;
    testnet?: boolean;
  }
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  chainId?: number;
  network?: string;
}> {
  debugLog("=== SETTLE PAYMENT START ===");

  try {
    const server = await getResourceServer();
    const network = expectedDetails.testnet ? CRONOS_TESTNET : CRONOS_MAINNET;

    const priceAsset = usdToUsdc(expectedDetails.priceUsd, expectedDetails.testnet);
    const paymentOption = buildExactPaymentOption({
      price: priceAsset,
      payTo: expectedDetails.payTo,
      testnet: expectedDetails.testnet,
    });

    const paymentRequirements = await server.buildPaymentRequirementsFromOptions(
      [paymentOption],
      undefined
    );

    const paymentRequirement = paymentRequirements[0];
    if (!paymentRequirement) {
      errorLog("Failed to build payment requirements for settlement");
      return {
        success: false,
        error: "Failed to build payment requirements",
      };
    }

    debugLog("Calling facilitator settlePayment...");
    const settleResult = await server.settlePayment(payload, paymentRequirement);

    debugLog("Facilitator settlement result", {
      success: settleResult?.success,
      transaction: settleResult?.transaction,
      errorReason: settleResult?.errorReason,
    });

    if (!settleResult || !settleResult.success) {
      errorLog("Payment settlement failed", {
        success: settleResult?.success,
        errorReason: settleResult?.errorReason,
      });
      return {
        success: false,
        error: settleResult?.errorReason || "Payment settlement failed",
      };
    }

    debugLog("=== SETTLE PAYMENT SUCCESS ===", {
      txHash: settleResult.transaction,
      network,
    });

    return {
      success: true,
      txHash: settleResult.transaction,
      chainId: expectedDetails.testnet
        ? CRONOS_TESTNET_CHAIN_ID
        : CRONOS_MAINNET_CHAIN_ID,
      network,
    };
  } catch (error) {
    errorLog("Payment settlement threw exception", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Settlement failed",
    };
  }
}

export function generatePaymentRequiredResponse(config: {
  url: string;
  description?: string;
  priceUsd: number;
  payTo: string;
  testnet?: boolean;
}) {
  const network = config.testnet ? CRONOS_TESTNET : CRONOS_MAINNET;
  const usdcAsset = usdToUsdc(config.priceUsd, config.testnet);

  const response = {
    x402Version: 2,
    resource: {
      url: config.url,
      description: config.description,
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network,
        amount: usdcAsset.amount,
        payTo: config.payTo,
        maxTimeoutSeconds: 300,
        asset: usdcAsset.asset,
        extra: usdcAsset.extra,
      },
    ],
  };

  debugLog("Generated payment required response", response);
  return response;
}

function extractPayerAddress(payload: PaymentPayload): string | null {
  try {
    const innerPayload = payload.payload;
    if (innerPayload && typeof innerPayload === "object") {
      const obj = innerPayload as Record<string, unknown>;

      if ("from" in obj && typeof obj.from === "string") {
        return obj.from;
      }

      if ("authorization" in obj && typeof obj.authorization === "object") {
        const auth = obj.authorization as Record<string, unknown>;
        if ("from" in auth && typeof auth.from === "string") {
          return auth.from;
        }
      }

      if ("sender" in obj && typeof obj.sender === "string") {
        return obj.sender;
      }

      if ("payer" in obj && typeof obj.payer === "string") {
        return obj.payer;
      }
    }

    return null;
  } catch (error) {
    errorLog("Error extracting payer address", error);
    return null;
  }
}

export function getNetworkInfo(testnet?: boolean) {
  return {
    network: testnet ? CRONOS_TESTNET : CRONOS_MAINNET,
    chainId: testnet ? CRONOS_TESTNET_CHAIN_ID : CRONOS_MAINNET_CHAIN_ID,
    chainIdHex: testnet ? "0x152" : "0x19",
    chainName: testnet ? "Cronos Testnet" : "Cronos",
    usdcAddress: testnet ? USDC_CRONOS_TESTNET : USDC_CRONOS_MAINNET,
    rpcUrl: testnet ? "https://evm-t3.cronos.org" : "https://evm.cronos.org",
    blockExplorer: testnet
      ? "https://testnet.cronoscan.com"
      : "https://cronoscan.com",
  };
}
