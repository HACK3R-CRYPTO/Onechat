"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { AGENT_REGISTRY_ABI, getContractAddresses } from "@/lib/contracts";
import { useRouter } from "next/navigation";

export default function NewAgentPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { agentRegistry } = getContractAddresses();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    } else if (formData.name.length > 100) {
      newErrors.name = "Name must be less than 100 characters";
    }
    
    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    } else if (formData.description.length < 10) {
      newErrors.description = "Description must be at least 10 characters";
    } else if (formData.description.length > 500) {
      newErrors.description = "Description must be less than 500 characters";
    }
    
    // Price validation
    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price <= 0) {
      newErrors.price = "Price must be a positive number";
    } else if (price > 1000) {
      newErrors.price = "Price cannot exceed $1000";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    // Convert price to 6 decimals (USDC has 6 decimals)
    const priceInDecimals = BigInt(Math.floor(parseFloat(formData.price) * 1_000_000));

    try {
      writeContract({
        address: agentRegistry as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: "registerAgent",
        args: [formData.name, formData.description, priceInDecimals],
      });
    } catch (err) {
      console.error("Error registering agent:", err);
    }
  };

  // Redirect after successful registration
  if (isSuccess) {
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-black text-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-neutral-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
                  Register New Agent
                </h1>
                <p className="text-sm text-neutral-400 mt-1">
                  Create and register your AI agent on OneChat
                </p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {!isConnected ? (
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-8 text-center">
            <p className="text-neutral-400 mb-4">Please connect your wallet to register an agent</p>
            <WalletConnect />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Agent Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent text-neutral-50"
                placeholder="e.g., Smart Contract Analyzer"
                disabled={isPending || isConfirming}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Description *
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent text-neutral-50 resize-none"
                placeholder="Describe what your agent does and its capabilities..."
                disabled={isPending || isConfirming}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-500">{errors.description}</p>
              )}
            </div>

            {/* Price Field */}
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-2">
                Price per Execution (USDC) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">$</span>
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full pl-8 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent text-neutral-50"
                  placeholder="0.10"
                  disabled={isPending || isConfirming}
                />
              </div>
              {errors.price && (
                <p className="mt-1 text-sm text-red-500">{errors.price}</p>
              )}
              <p className="mt-1 text-xs text-neutral-500">
                Users will pay this amount each time they execute your agent
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
                <p className="text-sm text-red-400">
                  Error: {error.message || "Failed to register agent"}
                </p>
              </div>
            )}

            {/* Success Message */}
            {isSuccess && (
              <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
                <p className="text-sm text-green-400">
                  ✅ Agent registered successfully! Redirecting to dashboard...
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending || isConfirming || isSuccess}
              className="w-full px-6 py-3 bg-gradient-to-r from-neutral-800 to-neutral-700 hover:from-neutral-700 hover:to-neutral-600 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isPending ? "Confirm in wallet..." : "Processing..."}
                </>
              ) : isSuccess ? (
                "Registered!"
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Register Agent
                </>
              )}
            </button>

            {/* Transaction Hash */}
            {hash && (
              <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <p className="text-xs text-neutral-400 mb-1">Transaction Hash:</p>
                <a
                  href={`https://explorer.cronos.org/testnet/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 break-all"
                >
                  {hash}
                </a>
              </div>
            )}
          </form>
        )}

        {/* Important Limitations */}
        <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
          <h3 className="font-bold text-yellow-400 mb-3 flex items-center gap-2">
            ⚠️ Important: Agent Limitations
          </h3>
          <ul className="space-y-2 text-sm text-yellow-300">
            <li>• <strong>Text Processing Only:</strong> Agents use AI to analyze and generate text. They cannot perform real-world actions.</li>
            <li>• <strong>No External Access:</strong> Agents cannot access external systems, APIs, accounts, or services.</li>
            <li>• <strong>No Guarantees:</strong> Agents cannot guarantee outcomes, profits, or specific results.</li>
            <li>• <strong>AI-Generated:</strong> All outputs are AI-generated and should be verified for accuracy.</li>
            <li>• <strong>Not Professional Services:</strong> Agents are tools, not replacements for professional services (legal, medical, financial, etc.).</li>
          </ul>
          <p className="mt-3 text-xs text-yellow-400">
            Your agent description should accurately reflect what the AI can do with text analysis and generation only.
          </p>
        </div>

        {/* Info Section */}
        <div className="mt-6 p-6 bg-neutral-900 rounded-lg border border-neutral-800">
          <h3 className="font-bold mb-3">About Agent Registration</h3>
          <ul className="space-y-2 text-sm text-neutral-400">
            <li>• Your agent will be registered on-chain on Cronos testnet</li>
            <li>• Initial reputation is set to 500/1000 (50%)</li>
            <li>• You'll receive payments when users execute your agent</li>
            <li>• You can track analytics and revenue in the dashboard</li>
            <li>• Agents start as active by default</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
