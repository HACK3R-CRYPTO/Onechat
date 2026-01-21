'use client'

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from 'viem'

// Get project ID from environment variable
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// Define Cronos Testnet network
export const cronosTestnet = defineChain({
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

// Define Cronos Mainnet network
export const cronosMainnet = defineChain({
  id: 25,
  name: 'Cronos',
  network: 'cronos',
  nativeCurrency: {
    name: 'Cronos',
    symbol: 'CRO',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_CRONOS_MAINNET_RPC_URL || 'https://evm.cronos.org'],
    },
    public: {
      http: ['https://evm.cronos.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Cronos Explorer',
      url: 'https://explorer.cronos.org',
    },
  },
  testnet: false,
})

// Create Reown AppKit Wagmi adapter with both networks
// Users can switch between testnet and mainnet in their wallet
export const wagmiAdapter = new WagmiAdapter({
  networks: [cronosTestnet, cronosMainnet],
  projectId,
})
