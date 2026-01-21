'use client'

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from 'viem'

// Get project ID from environment variable
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// Define Cronos Testnet network
const cronosTestnet = defineChain({
  id: 338,
  name: 'Cronos Testnet',
  network: 'cronos-testnet',
  nativeCurrency: {
    name: 'Cronos',
    symbol: 'TCRO',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_CRONOS_RPC_URL || 'https://evm-t3.cronos.org'],
    },
    public: {
      http: ['https://evm-t3.cronos.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Cronos Explorer Testnet',
      url: 'https://explorer.cronos.org/testnet',
    },
  },
  testnet: true,
})

// Create Reown AppKit Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  networks: [cronosTestnet],
  projectId,
})
