"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { cronos } from "wagmi/chains";
import { CRONOS_TESTNET } from "@/lib/contracts";
import { injected, walletConnect } from "wagmi/connectors";

const queryClient = new QueryClient();

const config = createConfig({
  chains: [CRONOS_TESTNET, cronos],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    }),
  ],
  transports: {
    [CRONOS_TESTNET.id]: http(
      process.env.NEXT_PUBLIC_CRONOS_RPC_URL || "https://evm-t3.cronos.org"
    ),
    [cronos.id]: http("https://evm.cronos.org"),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
