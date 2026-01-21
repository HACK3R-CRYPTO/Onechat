"use client";

import { wagmiAdapter, projectId, cronosTestnet, cronosMainnet } from './config'
import { createAppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

const queryClient = new QueryClient()

if (!projectId) {
  throw new Error('Project ID is not defined')
}

const metadata = {
  name: "OneChat",
  description: "One Chat. Multiple Superpowers.",
  url: typeof window !== 'undefined' ? window.location.origin : "https://onechat.app",
  icons: ["https://avatars.githubusercontent.com/u/179229932"]
}

const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [cronosTestnet, cronosMainnet], // Support both testnet and mainnet
  metadata: metadata,
  features: {
    analytics: true,
  },
  themeMode: 'dark'
})

export function Providers({ children, cookies }: { children: ReactNode; cookies?: string | null }) {
  // Safely parse cookies - handle null or empty strings
  let initialState;
  try {
    initialState = cookies ? cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies) : undefined;
  } catch (error) {
    console.warn('Failed to parse cookies for wagmi initialState:', error);
    initialState = undefined;
  }
  
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
