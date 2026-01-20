"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { CRONOS_TESTNET } from "@/lib/contracts";

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const isCorrectChain = chain?.id === CRONOS_TESTNET.id;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm">
          <div className="font-medium text-neutral-50">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
          {!isCorrectChain && (
            <div className="text-red-400 text-xs">
              Switch to Cronos Testnet
            </div>
          )}
        </div>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-50 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-50 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-colors"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}
