/**
 * VVS Finance DEX Integration
 * Track 2 Requirement: Cronos dApp Integration
 * 
 * VVS Finance is a DEX on Cronos. This module provides functions to:
 * - Get swap quotes
 * - Execute token swaps
 * - Check liquidity
 * 
 * ⚠️ IMPORTANT: VVS Finance is only deployed on Cronos Mainnet, not testnet.
 * 
 * For testnet/demo purposes:
 * - Set VVS_MOCK_MODE=true in .env to enable mock quotes
 * - Mock mode returns realistic quotes without calling the router
 * - This allows demo/testing on testnet without real VVS deployment
 * 
 * Contract Addresses:
 * - Mainnet Router: 0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae (confirmed)
 * - Testnet Router: Not deployed (use mock mode instead)
 * - VVS Token: 0x2D03bECE6747ADC00E1A131bBA1469C15FD11E03
 */

import { ethers } from "ethers";

// VVS Finance Router Contract Addresses
// Mainnet: 0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae (confirmed from VVS Finance docs)
// Testnet: Find on testnet.cronoscan.com by searching "VVS Router" or "VVS Finance Router"
//
// Auto-detect based on RPC URL:
// - If RPC contains "evm-t3" or "testnet" → use testnet router
// - Otherwise → use mainnet router
//
// To override manually, set VVS_ROUTER_ADDRESS in backend/.env
const getVVSRouterAddress = (): string => {
  // Manual override from env
  if (process.env.VVS_ROUTER_ADDRESS) {
    return process.env.VVS_ROUTER_ADDRESS;
  }
  
  // Auto-detect based on RPC URL
  const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
  const isTestnet = rpcUrl.includes("evm-t3") || rpcUrl.includes("testnet");
  
  if (isTestnet) {
    // Testnet router address (update this when you find it)
    // Search testnet.cronoscan.com for "VVS Router" to find the correct address
    return process.env.VVS_ROUTER_ADDRESS_TESTNET || "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae"; // TODO: Replace with actual testnet address
  } else {
    // Mainnet router (confirmed)
    return "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae";
  }
};

const VVS_ROUTER_ADDRESS = getVVSRouterAddress();

// Common token addresses on Cronos
// Note: Some addresses differ between testnet and mainnet
const TOKEN_ADDRESSES: Record<string, string> = {
  CRO: "0x0000000000000000000000000000000000000000", // Native CRO (use WCRO for mainnet quotes)
  WCRO: "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23", // Wrapped CRO on Mainnet
  USDC: "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0", // devUSDC.e (testnet) / USDC.e (mainnet)
  USDT: "0x66e428c3f67a68878562e79A0234c1F83c208770", // USDT on Cronos Mainnet
  ETH: "0xe44Fd7fCb2b1581822D0c862B68222998a0c299a", // Wrapped ETH (WETH) on Cronos
  WBTC: "0x062E66477Faf219F25D27dCED647BF57C3107d52", // Wrapped BTC on Cronos Mainnet
  DAI: "0xF2001B145b43032AAF5Ee2884e456CCd805F677D", // DAI on Cronos
  VVS: "0x2D03bECE6747ADC00E1A131bBA1469C15FD11E03", // VVS token
  // Users can also provide contract addresses directly in their swap request
};

// Token decimals mapping (for proper formatting)
// USDC and USDT use 6 decimals, WBTC uses 8, most others use 18
const TOKEN_DECIMALS: Record<string, number> = {
  "0x0000000000000000000000000000000000000000": 18, // Native CRO
  "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23": 18, // WCRO
  "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0": 6,  // devUSDC.e (testnet) - 6 decimals
  "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59": 6,  // USDC.e (mainnet) - 6 decimals
  "0x66e428c3f67a68878562e79A0234c1F83c208770": 6,  // USDT - 6 decimals
  "0xe44Fd7fCb2b1581822D0c862B68222998a0c299a": 18, // WETH - 18 decimals
  "0x062E66477Faf219F25D27dCED647BF57C3107d52": 8,  // WBTC - 8 decimals
  "0xF2001B145b43032AAF5Ee2884e456CCd805F677D": 18, // DAI - 18 decimals
  "0x2D03bECE6747ADC00E1A131bBA1469C15FD11E03": 18, // VVS - 18 decimals
  // Default to 18 decimals for unknown tokens (most ERC20 tokens use 18)
};

// USDC addresses differ by network
const USDC_TESTNET = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0"; // devUSDC.e
const USDC_MAINNET = "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59"; // USDC.e on mainnet

// VVS Router ABI (simplified - only swap functions)
const VVS_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
];

/**
 * Get mock quote (for testnet/demo when VVS isn't available)
 */
function getMockQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): { amountOut: string; path: string[] } {
  const amountInBig = BigInt(amountIn);
  
  // Mock exchange rates (realistic for demo)
  const rates: Record<string, Record<string, bigint>> = {
    "0x0000000000000000000000000000000000000000": { // CRO
      "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0": 95n, // CRO -> USDC: 1 CRO = 0.95 USDC
      "0x2D03bECE6747ADC00E1A131bBA1469C15FD11E03": 1000n, // CRO -> VVS: 1 CRO = 1000 VVS
    },
    "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0": { // USDC
      "0x0000000000000000000000000000000000000000": 105n, // USDC -> CRO: 1 USDC = 1.05 CRO
      "0x2D03bECE6747ADC00E1A131bBA1469C15FD11E03": 1050n, // USDC -> VVS: 1 USDC = 1050 VVS
    },
    "0x2D03bECE6747ADC00E1A131bBA1469C15FD11E03": { // VVS
      "0x0000000000000000000000000000000000000000": 1n, // VVS -> CRO: 1000 VVS = 1 CRO
      "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0": 95n, // VVS -> USDC: 1000 VVS = 0.95 USDC
    },
  };
  
  const rate = rates[tokenIn.toLowerCase()]?.[tokenOut.toLowerCase()];
  if (!rate) {
    // Default: 5% slippage
    const amountOut = (amountInBig * 95n) / 100n;
    return {
      amountOut: amountOut.toString(),
      path: [tokenIn, tokenOut],
    };
  }
  
  // Apply rate with 5% slippage for demo
  const amountOut = (amountInBig * rate * 95n) / 10000n;
  
  return {
    amountOut: amountOut.toString(),
    path: [tokenIn, tokenOut],
  };
}

export async function getVVSQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  forceMainnet?: boolean
): Promise<{ amountOut: string; path: string[] } | null> {
  // Check if mock mode is enabled
  const mockMode = process.env.VVS_MOCK_MODE === "true";
  // Allow forcing mainnet even if backend is on testnet
  const cronosRpcUrl = forceMainnet 
    ? "https://evm.cronos.org" 
    : (process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org");
  const isTestnet = !forceMainnet && (cronosRpcUrl.includes("evm-t3") || cronosRpcUrl.includes("testnet"));
  const isMainnet = !isTestnet || forceMainnet;
  
  // Convert native CRO (0x0000...0000) to WCRO for mainnet quotes
  // VVS router doesn't accept zero address, so we use WCRO for quotes
  // But we'll still use native CRO in the actual swap transaction
  let quoteTokenIn = tokenIn;
  let quoteTokenOut = tokenOut;
  
  if (isMainnet) {
    // Use WCRO for native CRO swaps on mainnet
    if (tokenIn.toLowerCase() === "0x0000000000000000000000000000000000000000") {
      quoteTokenIn = TOKEN_ADDRESSES.WCRO;
    }
    if (tokenOut.toLowerCase() === "0x0000000000000000000000000000000000000000") {
      quoteTokenOut = TOKEN_ADDRESSES.WCRO;
    }
    // Use mainnet USDC address if needed
    if (tokenOut.toLowerCase() === USDC_TESTNET.toLowerCase()) {
      quoteTokenOut = USDC_MAINNET;
    }
    if (tokenIn.toLowerCase() === USDC_TESTNET.toLowerCase()) {
      quoteTokenIn = USDC_MAINNET;
    }
  }
  
  // Use mock mode if enabled or on testnet (since VVS isn't on testnet)
  // But skip mock mode if forceMainnet is true (user explicitly wants mainnet quote)
  if (!forceMainnet && (mockMode || (isTestnet && !process.env.VVS_ROUTER_ADDRESS))) {
    console.log("[VVS] 🎭 Using MOCK mode (VVS Finance not available on testnet)");
    const mockQuote = getMockQuote(tokenIn, tokenOut, amountIn);
    console.log("[VVS] ✅ Mock quote:", {
      amountIn: ethers.formatUnits(amountIn, 18),
      amountOut: ethers.formatUnits(mockQuote.amountOut, 18),
      path: mockQuote.path,
    });
    return mockQuote;
  }
  
  // If forceMainnet, use mainnet router address
  const routerAddress = forceMainnet 
    ? (process.env.VVS_ROUTER_ADDRESS || "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae")
    : VVS_ROUTER_ADDRESS;
  
  try {
    const provider = new ethers.JsonRpcProvider(cronosRpcUrl);
    
    console.log("[VVS] Getting quote:", {
      originalTokenIn: tokenIn,
      originalTokenOut: tokenOut,
      quoteTokenIn,
      quoteTokenOut,
      amountIn,
      router: routerAddress,
      rpcUrl: cronosRpcUrl,
      network: forceMainnet ? "mainnet" : (isTestnet ? "testnet" : "mainnet"),
      forceMainnet: forceMainnet || false,
      usingWCRO: quoteTokenIn !== tokenIn || quoteTokenOut !== tokenOut,
    });
    
    // Validate router address
    if (!ethers.isAddress(routerAddress)) {
      const errorMsg = `Invalid VVS Router address: ${routerAddress} (length: ${String(routerAddress).length}, expected: 42). Please set a valid VVS_ROUTER_ADDRESS in backend/.env or enable VVS_MOCK_MODE=true for testnet.`;
      console.error("[VVS] ❌", errorMsg);
      throw new Error(errorMsg);
    }
    
    const router = new ethers.Contract(routerAddress, VVS_ROUTER_ABI, provider);
    
    // Build swap path (use quote tokens which may be WCRO instead of native CRO)
    const path = [quoteTokenIn, quoteTokenOut];
    
    console.log("[VVS] Calling getAmountsOut with path:", path);
    
    // Get quote
    const amounts = await router.getAmountsOut(amountIn, path);
    
    console.log("[VVS] ✅ Quote received:", {
      amountIn: amounts[0].toString(),
      amountOut: amounts[1].toString(),
    });
    
    // Return path with original tokens (not WCRO) for display/transaction building
    // But the quote was calculated using WCRO if needed
    return {
      amountOut: amounts[1].toString(),
      path: [tokenIn, tokenOut], // Return original path (native CRO, not WCRO)
    };
  } catch (error) {
    console.error("[VVS] ❌ Error getting quote:", error);
    if (error instanceof Error) {
      console.error("[VVS] Error message:", error.message);
      
      // If on testnet and error, fall back to mock mode
      if (isTestnet) {
        console.log("[VVS] 🎭 Falling back to MOCK mode (VVS not available on testnet)");
        return getMockQuote(tokenIn, tokenOut, amountIn);
      }
    }
    return null;
  }
}

/**
 * Execute token swap on VVS Finance
 * Note: This requires user's wallet signature - typically done on frontend
 * This function provides the transaction data
 */
export function buildVVSSwapTransaction(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  amountOutMin: string,
  recipient: string,
  deadline: number = Math.floor(Date.now() / 1000) + 1200 // 20 minutes
): {
  to: string;
  data: string;
  value?: string;
} {
  // Create interface for encoding (no provider needed)
  const routerInterface = new ethers.Interface(VVS_ROUTER_ABI);
  const path = [tokenIn, tokenOut];
  
  // Determine swap function based on token types
  const isNativeIn = tokenIn === "0x0000000000000000000000000000000000000000";
  const isNativeOut = tokenOut === "0x0000000000000000000000000000000000000000";
  
  let data: string;
  let value: string | undefined;
  
  if (isNativeIn) {
    // swapExactETHForTokens
    data = routerInterface.encodeFunctionData("swapExactETHForTokens", [
      amountOutMin,
      path,
      recipient,
      deadline,
    ]);
    value = amountIn;
  } else if (isNativeOut) {
    // swapExactTokensForETH
    data = routerInterface.encodeFunctionData("swapExactTokensForETH", [
      amountIn,
      amountOutMin,
      path,
      recipient,
      deadline,
    ]);
  } else {
    // swapExactTokensForTokens
    data = routerInterface.encodeFunctionData("swapExactTokensForTokens", [
      amountIn,
      amountOutMin,
      path,
      recipient,
      deadline,
    ]);
  }
  
  return {
    to: VVS_ROUTER_ADDRESS,
    data,
    value,
  };
}

/**
 * Check if VVS Finance has liquidity for a token pair
 */
export async function checkVVSLiquidity(
  tokenIn: string,
  tokenOut: string
): Promise<boolean> {
  try {
    // Try to get a quote with a small amount
    const smallAmount = ethers.parseUnits("0.001", 18); // 0.001 tokens
    const quote = await getVVSQuote(tokenIn, tokenOut, smallAmount.toString());
    
    // In mock mode, always return true (for demo purposes)
    const mockMode = process.env.VVS_MOCK_MODE === "true";
    const cronosRpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
    const isTestnet = cronosRpcUrl.includes("evm-t3") || cronosRpcUrl.includes("testnet");
    
    if (mockMode || (isTestnet && !process.env.VVS_ROUTER_ADDRESS)) {
      return true; // Mock mode assumes liquidity
    }
    
    return quote !== null && BigInt(quote.amountOut) > 0n;
  } catch (error) {
    console.error("[VVS] Error checking liquidity:", error);
    return false;
  }
}

/**
 * Get token address by symbol
 * First checks hardcoded list, then tries to fetch from token registry/API
 */
export async function getTokenAddress(symbol: string, network: 'mainnet' | 'testnet' = 'mainnet'): Promise<string | null> {
  const upperSymbol = symbol.toUpperCase();
  
  // First check hardcoded list (fast)
  if (TOKEN_ADDRESSES[upperSymbol]) {
    return TOKEN_ADDRESSES[upperSymbol];
  }
  
  // Try to fetch from token registry/API
  try {
    const address = await fetchTokenAddressFromAPI(upperSymbol, network);
    if (address) {
      console.log(`[VVS] ✅ Found token ${upperSymbol} address from API: ${address}`);
      return address;
    }
  } catch (error) {
    console.warn(`[VVS] ⚠️ Failed to fetch token address for ${upperSymbol}:`, error);
  }
  
  // If symbol looks like an address (starts with 0x), return it directly
  if (symbol.startsWith('0x') && symbol.length === 42) {
    return symbol;
  }
  
  return null;
}

/**
 * Fetch token address from external API/registry
 * Uses multiple sources as fallback
 */
async function fetchTokenAddressFromAPI(symbol: string, network: 'mainnet' | 'testnet'): Promise<string | null> {
  // Try CoinGecko API - search for tokens on Cronos
  try {
    // CoinGecko doesn't have direct symbol->address lookup, but we can try their coins list
    // For now, we'll use a simpler approach: try common token registries
    
    // Alternative: Use 1inch Token List API (they have Cronos support)
    // https://tokens.1inch.io/v1.1/25 (Cronos mainnet chain ID is 25)
    try {
      const oneInchUrl = network === 'mainnet' 
        ? 'https://tokens.1inch.io/v1.1/25'
        : 'https://tokens.1inch.io/v1.1/338'; // Testnet chain ID 338
      
      const response = await fetch(oneInchUrl, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json() as { tokens: Array<{ address: string; symbol: string; decimals: number }> };
        if (data.tokens) {
          const token = data.tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
          if (token) {
            console.log(`[VVS] ✅ Found ${symbol} in 1inch token list: ${token.address}`);
            return token.address;
          }
        }
      }
    } catch (error) {
      // 1inch failed, continue
    }
    
    // Try CoinGecko's coins list (slower but comprehensive)
    // This endpoint returns all coins with their platform addresses
    try {
      const coinGeckoUrl = 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
      const response = await fetch(coinGeckoUrl, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json() as Array<{ id: string; symbol: string; platforms?: Record<string, string> }>;
        const cronosPlatform = network === 'mainnet' ? 'cronos' : 'cronos-testnet';
        
        // Find token by symbol that has Cronos platform
        const token = data.find(t => 
          t.symbol.toUpperCase() === symbol.toUpperCase() && 
          t.platforms && 
          t.platforms[cronosPlatform]
        );
        
        if (token && token.platforms && token.platforms[cronosPlatform]) {
          console.log(`[VVS] ✅ Found ${symbol} in CoinGecko: ${token.platforms[cronosPlatform]}`);
          return token.platforms[cronosPlatform];
        }
      }
    } catch (error) {
      // CoinGecko failed
    }
  } catch (error) {
    console.warn(`[VVS] ⚠️ Token lookup failed for ${symbol}:`, error);
  }
  
  // If all APIs fail, return null - user can provide address directly
  return null;
}

/**
 * Get token decimals by address
 */
export function getTokenDecimals(tokenAddress: string): number {
  return TOKEN_DECIMALS[tokenAddress.toLowerCase()] || 18; // Default to 18 decimals
}
