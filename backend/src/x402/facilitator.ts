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
  process.env.X402_FACILITATOR_URL || "https://facilitator.cronoslabs.org/v2/x402";

// Networks
// Note: Cronos facilitator uses "cronos-testnet" format, but x402 SDK uses "eip155:338"
// We need to use the facilitator's format for registration
const CRONOS_TESTNET_FACILITATOR = "cronos-testnet" as const;
const CRONOS_MAINNET_FACILITATOR = "cronos-mainnet" as const;
// Keep EIP-155 format for SDK internal use
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
      networks: [CRONOS_TESTNET_FACILITATOR],
    });

    const facilitatorClient = new HTTPFacilitatorClient({
      url: FACILITATOR_URL,
    });

    // Register with facilitator's network format (cronos-testnet) not EIP-155 format
    // The SDK will handle the mapping internally
    // Type assertion needed: SDK types expect EIP-155 format but Cronos facilitator uses "cronos-testnet"
    resourceServer = new x402ResourceServer(facilitatorClient).register(
      CRONOS_TESTNET_FACILITATOR as `${string}:${string}`,
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
          debugLog("hasRegisteredScheme", resourceServer!.hasRegisteredScheme(CRONOS_TESTNET_FACILITATOR as `${string}:${string}`, "exact"));
          debugLog("getSupportedKind v1", resourceServer!.getSupportedKind(1, CRONOS_TESTNET_FACILITATOR as `${string}:${string}`, "exact"));
          debugLog("getSupportedKind v2", resourceServer!.getSupportedKind(2, CRONOS_TESTNET_FACILITATOR as `${string}:${string}`, "exact"));
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
      name: "Bridged USDC (Stargate)",
      version: "1",
    },
  };
}

export function buildExactPaymentOption(config: {
  price: AssetAmount;
  payTo: string;
  testnet?: boolean;
  maxTimeoutSeconds?: number;
}) {
  // Use facilitator's network format for payment options
  const network = config.testnet ? CRONOS_TESTNET_FACILITATOR : CRONOS_MAINNET_FACILITATOR;

  // Normalize address to lowercase for consistency (Ethereum addresses are case-insensitive)
  // But keep original for display - facilitator should handle both
  const normalizedPayTo = config.payTo.toLowerCase();

  const option = {
    scheme: "exact" as const,
    network,
    price: config.price,
    payTo: normalizedPayTo,
    maxTimeoutSeconds: config.maxTimeoutSeconds ?? 300,
  };

  debugLog("Built exact payment option", { ...option, originalPayTo: config.payTo });
  return option;
}

export function parsePaymentSignature(request: Request): PaymentPayload | null {
  // According to Cronos docs, payment header can be in X-PAYMENT or X-PAYMENT-SIGNATURE
  // The official format uses X-PAYMENT per documentation
  const paymentHeader = request.headers.get("X-PAYMENT") || 
                        request.headers.get("X-PAYMENT-SIGNATURE") ||
                        request.headers.get("PAYMENT-SIGNATURE");

  debugLog("Parsing payment signature from headers", {
    hasXPayment: !!request.headers.get("X-PAYMENT"),
    hasXPaymentSignature: !!request.headers.get("X-PAYMENT-SIGNATURE"),
    hasPaymentSignature: !!request.headers.get("PAYMENT-SIGNATURE"),
    headerLength: paymentHeader?.length,
  });

  if (!paymentHeader) {
    debugLog("No payment header found in headers");
    return null;
  }

  try {
    // The payment header is base64-encoded JSON
    // Try to decode it directly first (Cronos format)
    try {
      const decodedJson = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));
      debugLog("Decoded payment header (direct base64)", {
        x402Version: decodedJson.x402Version,
        scheme: decodedJson.scheme,
        network: decodedJson.network,
        hasPayload: !!decodedJson.payload,
      });
      
      // Convert Cronos format to SDK format if needed
      if (decodedJson.payload && decodedJson.scheme && decodedJson.network) {
        // This is the Cronos format - convert to SDK PaymentPayload format
        const sdkPayload: PaymentPayload = {
          x402Version: decodedJson.x402Version || 1,
          payload: {
            signature: decodedJson.payload.signature,
            authorization: {
              from: decodedJson.payload.from,
              to: decodedJson.payload.to,
              value: decodedJson.payload.value,
              validAfter: decodedJson.payload.validAfter,
              validBefore: decodedJson.payload.validBefore,
              nonce: decodedJson.payload.nonce,
            },
          },
          accepted: {
            scheme: decodedJson.scheme,
            network: decodedJson.network,
            amount: decodedJson.payload.value,
            payTo: decodedJson.payload.to,
            asset: decodedJson.payload.asset,
            maxTimeoutSeconds: 300,
            extra: {
              name: "Bridged USDC (Stargate)",
              version: "1",
            },
          },
          resource: {
            url: "",
            description: "",
            mimeType: "application/json",
          },
        };
        return sdkPayload;
      }
    } catch (base64Error) {
      // If direct base64 decode fails, try SDK's decodePaymentSignatureHeader
      debugLog("Direct base64 decode failed, trying SDK decoder", base64Error);
    }

    // Fallback to SDK's decoder (for compatibility with SDK format)
    const decoded = decodePaymentSignatureHeader(paymentHeader);
    debugLog("Successfully decoded payment signature (SDK format)", {
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
  },
  originalPaymentHeader?: string
): Promise<{
  valid: boolean;
  invalidReason?: string;
  payerAddress?: string;
  chainId?: number;
}> {
  debugLog("=== VERIFY PAYMENT START ===");
  debugLog("Expected details", expectedDetails);
  
  // Extract payTo from payment payload for comparison
  let paymentPayTo: string | undefined;
  if (payload.accepted?.payTo) {
    paymentPayTo = payload.accepted.payTo.toLowerCase();
  } else if ((payload.payload as any)?.to) {
    paymentPayTo = (payload.payload as any).to.toLowerCase();
  } else if ((payload.payload as any)?.authorization?.to) {
    paymentPayTo = (payload.payload as any).authorization.to.toLowerCase();
  }
  
  const expectedPayTo = expectedDetails.payTo.toLowerCase();
  debugLog("Address comparison", {
    paymentPayTo,
    expectedPayTo,
    match: paymentPayTo === expectedPayTo,
  });
  
  if (paymentPayTo && paymentPayTo !== expectedPayTo) {
    errorLog("PayTo address mismatch", {
      paymentPayTo,
      expectedPayTo,
    });
    return {
      valid: false,
      invalidReason: `Recipient does not match payTo address. Payment has ${paymentPayTo}, expected ${expectedPayTo}`,
    };
  }

  try {
    const server = await getResourceServer();
    // Use facilitator's network format
    const network = expectedDetails.testnet ? CRONOS_TESTNET_FACILITATOR : CRONOS_MAINNET_FACILITATOR;

    const priceAsset = usdToUsdc(expectedDetails.priceUsd, expectedDetails.testnet);
    const paymentOption = buildExactPaymentOption({
      price: priceAsset,
      payTo: expectedDetails.payTo,
      testnet: expectedDetails.testnet,
    });

    // Workaround: Manually construct PaymentRequirements since buildPaymentRequirementsFromOptions
    // fails with "Facilitator does not support exact on cronos-testnet" even though it's initialized.
    // The SDK's internal check seems to have an issue with version 1 support detection.
    // We know the structure is correct because getSupportedKind(1, ...) returns the right kind.
    const paymentRequirement: PaymentRequirements = {
      scheme: paymentOption.scheme,
      network: paymentOption.network as `${string}:${string}`, // Type assertion: SDK types expect EIP-155 but facilitator uses "cronos-testnet"
      amount: paymentOption.price.amount,
      payTo: paymentOption.payTo,
      asset: paymentOption.price.asset,
      maxTimeoutSeconds: paymentOption.maxTimeoutSeconds,
      extra: paymentOption.price.extra || {},
    };

    debugLog("Manually constructed payment requirement", paymentRequirement);

    // Call facilitator verify endpoint directly with X402-Version header
    // The SDK doesn't include this header, but Cronos facilitator requires it
    debugLog("Calling facilitator verify endpoint directly...");
    
    // Use the original payment header if provided, otherwise reconstruct it
    // IMPORTANT: We should use the original header to preserve the exact signature
    let paymentHeader: string;
    if (originalPaymentHeader) {
      paymentHeader = originalPaymentHeader;
      debugLog("Using original payment header from client");
    } else {
      // Fallback: reconstruct header (may cause signature issues)
      debugLog("WARNING: Reconstructing payment header - signature may be invalid");
      paymentHeader = Buffer.from(JSON.stringify({
        x402Version: payload.x402Version || 1,
        scheme: paymentRequirement.scheme,
        network: paymentRequirement.network,
        payload: {
          from: extractPayerAddress(payload) || (payload.payload as any)?.authorization?.from || (payload.payload as any)?.from,
          to: paymentRequirement.payTo,
          value: paymentRequirement.amount,
          validAfter: (payload.payload as any)?.authorization?.validAfter || (payload.payload as any)?.validAfter || "0",
          validBefore: (payload.payload as any)?.authorization?.validBefore || (payload.payload as any)?.validBefore,
          nonce: (payload.payload as any)?.authorization?.nonce || (payload.payload as any)?.nonce,
          signature: (payload.payload as any)?.signature,
          asset: paymentRequirement.asset,
        },
      })).toString('base64');
    }

    const verifyRequestBody = {
      x402Version: 1,
      paymentHeader: paymentHeader,
      paymentRequirements: {
        scheme: paymentRequirement.scheme,
        network: paymentRequirement.network,
        payTo: paymentRequirement.payTo,
        asset: paymentRequirement.asset,
        description: "Agent execution payment",
        mimeType: "application/json",
        maxAmountRequired: paymentRequirement.amount,
        maxTimeoutSeconds: paymentRequirement.maxTimeoutSeconds,
      },
    };

    debugLog("Verify request body", verifyRequestBody);

    try {
      const verifyResponse = await fetch(`${FACILITATOR_URL}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X402-Version': '1',
        },
        body: JSON.stringify(verifyRequestBody),
      });

      const verifyData = await verifyResponse.json() as { isValid?: boolean; invalidReason?: string; payer?: string };
      debugLog("Facilitator verify response", verifyData);

      if (!verifyData.isValid) {
        errorLog("Payment verification failed", {
          isValid: verifyData.isValid,
          invalidReason: verifyData.invalidReason,
        });
        return {
          valid: false,
          invalidReason: verifyData.invalidReason || "Payment verification failed",
        };
      }

      const payerAddress = verifyData.payer || extractPayerAddress(payload);
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
    } catch (fetchError) {
      errorLog("Facilitator verify request failed", fetchError);
      // Fallback to SDK method if direct call fails
      debugLog("Falling back to SDK verifyPayment method...");
      try {
        const verifyResult = await server.verifyPayment(payload, paymentRequirement);
        if (!verifyResult || !verifyResult.isValid) {
          return {
            valid: false,
            invalidReason: verifyResult?.invalidReason || "Payment verification failed",
          };
        }
        const payerAddress = verifyResult.payer || extractPayerAddress(payload);
        return {
          valid: true,
          payerAddress: payerAddress ?? undefined,
          chainId: expectedDetails.testnet ? CRONOS_TESTNET_CHAIN_ID : CRONOS_MAINNET_CHAIN_ID,
        };
      } catch (sdkError) {
        errorLog("SDK verifyPayment also failed", sdkError);
        return {
          valid: false,
          invalidReason: fetchError instanceof Error ? fetchError.message : "Verification failed",
        };
      }
    }
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
  },
  originalPaymentHeader?: string
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
    // Use facilitator's network format
    const network = expectedDetails.testnet ? CRONOS_TESTNET_FACILITATOR : CRONOS_MAINNET_FACILITATOR;

    const priceAsset = usdToUsdc(expectedDetails.priceUsd, expectedDetails.testnet);
    const paymentOption = buildExactPaymentOption({
      price: priceAsset,
      payTo: expectedDetails.payTo,
      testnet: expectedDetails.testnet,
    });

    // Workaround: Manually construct PaymentRequirements since buildPaymentRequirementsFromOptions
    // fails with "Facilitator does not support exact on cronos-testnet" even though it's initialized.
    // The SDK's internal check seems to have an issue with version 1 support detection.
    // We know the structure is correct because getSupportedKind(1, ...) returns the right kind.
    const paymentRequirement: PaymentRequirements = {
      scheme: paymentOption.scheme,
      network: paymentOption.network as `${string}:${string}`, // Type assertion: SDK types expect EIP-155 but facilitator uses "cronos-testnet"
      amount: paymentOption.price.amount,
      payTo: paymentOption.payTo,
      asset: paymentOption.price.asset,
      maxTimeoutSeconds: paymentOption.maxTimeoutSeconds,
      extra: paymentOption.price.extra || {},
    };

    debugLog("Manually constructed payment requirement for settlement", paymentRequirement);

    // Call facilitator settle endpoint directly with X402-Version header
    debugLog("Calling facilitator settle endpoint directly...");
    
    // Use the original payment header if provided, otherwise reconstruct it
    // IMPORTANT: We should use the original header to preserve the exact signature
    let paymentHeader: string;
    if (originalPaymentHeader) {
      paymentHeader = originalPaymentHeader;
      debugLog("Using original payment header from client");
    } else {
      // Fallback: reconstruct header (may cause signature issues)
      debugLog("WARNING: Reconstructing payment header - signature may be invalid");
      paymentHeader = Buffer.from(JSON.stringify({
        x402Version: payload.x402Version || 1,
        scheme: paymentRequirement.scheme,
        network: paymentRequirement.network,
        payload: {
          from: extractPayerAddress(payload) || (payload.payload as any)?.authorization?.from || (payload.payload as any)?.from,
          to: paymentRequirement.payTo,
          value: paymentRequirement.amount,
          validAfter: (payload.payload as any)?.authorization?.validAfter || (payload.payload as any)?.validAfter || "0",
          validBefore: (payload.payload as any)?.authorization?.validBefore || (payload.payload as any)?.validBefore,
          nonce: (payload.payload as any)?.authorization?.nonce || (payload.payload as any)?.nonce,
          signature: (payload.payload as any)?.signature,
          asset: paymentRequirement.asset,
        },
      })).toString('base64');
    }

    const settleRequestBody = {
      x402Version: 1,
      paymentHeader: paymentHeader,
      paymentRequirements: {
        scheme: paymentRequirement.scheme,
        network: paymentRequirement.network,
        payTo: paymentRequirement.payTo,
        asset: paymentRequirement.asset,
        description: "Agent execution payment",
        mimeType: "application/json",
        maxAmountRequired: paymentRequirement.amount,
        maxTimeoutSeconds: paymentRequirement.maxTimeoutSeconds,
      },
    };

    debugLog("Settle request body", settleRequestBody);

    try {
      const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X402-Version': '1',
        },
        body: JSON.stringify(settleRequestBody),
      });

      const settleData = await settleResponse.json() as { event?: string; success?: boolean; error?: string; errorReason?: string; txHash?: string; from?: string; to?: string; value?: string; blockNumber?: number };
      debugLog("Facilitator settle response", settleData);

      // Check if payment was settled successfully
      // The facilitator returns event: 'payment.settled' with txHash when successful
      // It doesn't always include a 'success' field, so we check for txHash instead
      if (settleData.event !== 'payment.settled' || !settleData.txHash) {
        errorLog("Payment settlement failed", {
          event: settleData.event,
          txHash: settleData.txHash,
          error: settleData.error || settleData.errorReason,
        });
        return {
          success: false,
          error: settleData.error || settleData.errorReason || "Payment settlement failed",
        };
      }

      debugLog("=== SETTLE PAYMENT SUCCESS ===", {
        txHash: settleData.txHash,
        network,
      });

      return {
        success: true,
        txHash: settleData.txHash,
        chainId: expectedDetails.testnet
          ? CRONOS_TESTNET_CHAIN_ID
          : CRONOS_MAINNET_CHAIN_ID,
        network,
      };
    } catch (fetchError) {
      errorLog("Facilitator settle request failed", fetchError);
      // Fallback to SDK method if direct call fails
      debugLog("Falling back to SDK settlePayment method...");
      try {
        const settleResult = await server.settlePayment(payload, paymentRequirement);
        if (!settleResult || !settleResult.success) {
          return {
            success: false,
            error: settleResult?.errorReason || "Payment settlement failed",
          };
        }
        return {
          success: true,
          txHash: settleResult.transaction,
          chainId: expectedDetails.testnet ? CRONOS_TESTNET_CHAIN_ID : CRONOS_MAINNET_CHAIN_ID,
          network,
        };
      } catch (sdkError) {
        errorLog("SDK settlePayment also failed", sdkError);
        return {
          success: false,
          error: fetchError instanceof Error ? fetchError.message : "Settlement failed",
        };
      }
    }
  } catch (error) {
    errorLog("Payment settlement threw exception", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Settlement failed",
    };
  }
}

export async function generatePaymentRequiredResponse(config: {
  url: string;
  description?: string;
  priceUsd: number;
  payTo: string;
  testnet?: boolean;
}) {
  // Ensure facilitator is initialized first
  try {
    const server = await getResourceServer();
    debugLog("Facilitator initialized, checking supported schemes", {
      hasExact: server.hasRegisteredScheme((config.testnet ? CRONOS_TESTNET_FACILITATOR : CRONOS_MAINNET_FACILITATOR) as `${string}:${string}`, "exact"),
      supportedKindV1: server.getSupportedKind(1, (config.testnet ? CRONOS_TESTNET_FACILITATOR : CRONOS_MAINNET_FACILITATOR) as `${string}:${string}`, "exact"),
      supportedKindV2: server.getSupportedKind(2, (config.testnet ? CRONOS_TESTNET_FACILITATOR : CRONOS_MAINNET_FACILITATOR) as `${string}:${string}`, "exact"),
    });
  } catch (error) {
    errorLog("Failed to initialize facilitator for payment response", error);
    // Continue anyway - we'll return the response but it might not work
  }

  // Use facilitator's network format for payment requirements
  const network = config.testnet ? CRONOS_TESTNET_FACILITATOR : CRONOS_MAINNET_FACILITATOR;
  const usdcAsset = usdToUsdc(config.priceUsd, config.testnet);

  // Cronos facilitator supports x402Version 1, not 2
  const response = {
    x402Version: 1,
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
    network: testnet ? CRONOS_TESTNET_FACILITATOR : CRONOS_MAINNET_FACILITATOR,
    chainId: testnet ? CRONOS_TESTNET_CHAIN_ID : CRONOS_MAINNET_CHAIN_ID,
    chainIdHex: testnet ? "0x152" : "0x19",
    chainName: testnet ? "Cronos Testnet" : "Cronos",
    usdcAddress: testnet ? USDC_CRONOS_TESTNET : USDC_CRONOS_MAINNET,
    rpcUrl: testnet ? "https://evm-t3.cronos.org" : "https://evm.cronos.org",
    blockExplorer: testnet
      ? "https://explorer.cronos.org/testnet"
      : "https://explorer.cronos.org",
  };
}
