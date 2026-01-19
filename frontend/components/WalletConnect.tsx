"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { cronosTestnet } from "wagmi/chains";

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const isCorrectChain = chain?.id === cronosTestnet.id;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm">
          <div className="font-medium">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
          {!isCorrectChain && (
            <div className="text-red-500 text-xs">
              Switch to Cronos Testnet
            </div>
          )}
        </div>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
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
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}
