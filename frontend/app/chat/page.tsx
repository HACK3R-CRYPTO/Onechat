"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { X402Payment } from "@/components/X402Payment";
import { useQueryClient } from "@tanstack/react-query";
import TetrisLoading from "@/components/ui/tetris-loader";
import { Send, Bot, Loader2, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { keccak256, toBytes } from "viem";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  swapTransaction?: {
    to: string;
    data: string;
    value?: string;
  };
  swapQuote?: {
    amountIn: string;
    tokenIn: string;
    tokenOut: string;
    expectedAmountOut: string;
    network: string;
  };
}

export default function ChatPage() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: swapTxHash, isPending: isSwapPending } = useWriteContract();
  const { isLoading: isSwapConfirming, isSuccess: isSwapConfirmed } = useWaitForTransactionReceipt({
    hash: swapTxHash,
  });
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [conversationId] = useState<string>(() => `conv_${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fixed price for unified chat (can be made dynamic)
  const CHAT_PRICE = 0.10; // $0.10 per message

  useEffect(() => {
    // Clear old payments on load
    if (typeof window !== "undefined") {
      const oldPayment = sessionStorage.getItem(`payment_chat`);
      if (oldPayment) {
        sessionStorage.removeItem(`payment_chat`);
      }
    }
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handlePaymentComplete = (hash: string) => {
    setPaymentHash(hash);
    setShowPayment(false);
    setPaymentError(null);
    // Get payment header from sessionStorage
    const paymentHeader = sessionStorage.getItem(`payment_1`);
    if (paymentHeader && typeof window !== "undefined") {
      // Store for chat endpoint
      sessionStorage.setItem(`payment_chat`, paymentHeader);
      // Also store the hash alongside the header for consistency
      sessionStorage.setItem(`payment_chat_hash`, hash);
    }
    
    // Auto-send pending message if exists
    if (pendingMessage) {
      const messageToSend = pendingMessage;
      setPendingMessage(null);
      // Add user message first
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: messageToSend,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      // Then send
      setTimeout(() => {
        sendMessageWithInput(messageToSend);
      }, 300);
    }
  };

  const sendMessageWithInput = async (messageInput: string) => {
    if (executing) return;
    setExecuting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      
      // Get payment header from sessionStorage
      const paymentHeader = sessionStorage.getItem(`payment_chat`) || sessionStorage.getItem(`payment_1`) || "";
      
      // Get payment hash - try state first, then sessionStorage, then compute from header
      let hashToSend: string | null = paymentHash;
      if (!hashToSend && typeof window !== "undefined") {
        // Try to get from sessionStorage (stored when payment completed)
        hashToSend = sessionStorage.getItem(`payment_chat_hash`) || sessionStorage.getItem(`payment_1_hash`);
      }
      
      // If still null, compute from payment header (same method as backend)
      if (!hashToSend && paymentHeader) {
        try {
          hashToSend = keccak256(toBytes(paymentHeader));
          console.log("[Chat] ✅ Computed payment hash from header:", hashToSend);
        } catch (error) {
          console.warn("[Chat] ⚠️ Failed to compute payment hash from header:", error);
        }
      }
      
      console.log("[Chat] Payment details:", {
        hasHeader: !!paymentHeader,
        hasHash: !!hashToSend,
        hashSource: paymentHash ? "state" : (sessionStorage.getItem(`payment_chat_hash`) ? "sessionStorage" : "computed"),
      });
      
      // Use unified chat endpoint
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(paymentHeader && { "X-PAYMENT": paymentHeader }),
        },
        body: JSON.stringify({
          input: messageInput,
          paymentHash: hashToSend,
        }),
      });

      if (response.status === 402) {
        const errorData = await response.json();
        setPaymentError(errorData.error || "Payment required");
        setShowPayment(true);
        setPaymentHash(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`payment_chat`);
        }
        return;
      }

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.status}`);
      }

      const data = await response.json();

      // Add assistant response with swap transaction data if available
      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: data.output || "No response received",
        timestamp: Date.now(),
        swapTransaction: data.swapTransaction || undefined,
        swapQuote: data.swapQuote || undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Clear payment after successful execution
      setPaymentHash(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`payment_chat`);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to send message"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setPaymentHash(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`payment_chat`);
      }
      setPaymentError("Execution failed. Please create a new payment to try again.");
      setShowPayment(true);
    } finally {
      setExecuting(false);
    }
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    setShowPayment(true);
  };

  const sendMessage = async () => {
    if (!input.trim() || executing) return;

    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    const currentInput = input;
    setInput("");

    // Check if we need a new payment
    if (!paymentHash) {
      setPendingMessage(currentInput);
      setShowPayment(true);
      return;
    }

    // Add user message to chat (only after payment confirmed)
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: currentInput,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Use the shared send function
    sendMessageWithInput(currentInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const executeSwap = async (swapTx: { to: string; data: string; value?: string }) => {
    if (!isConnected || !address) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      const contractParams: any = {
        to: swapTx.to as `0x${string}`,
        data: swapTx.data as `0x${string}`,
      };
      if (swapTx.value) {
        contractParams.value = BigInt(swapTx.value);
      }
      await writeContract(contractParams);
    } catch (error) {
      console.error("Error executing swap:", error);
      alert(error instanceof Error ? error.message : "Failed to execute swap");
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-neutral-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center text-neutral-400 hover:text-neutral-300 font-medium transition-colors"
              >
                ← Back
              </Link>
              <div className="h-6 w-px bg-neutral-700"></div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
                  AgentMarket Chat
                </h1>
                <p className="text-sm text-neutral-400 mt-1">
                  Ask anything - I'll use the right tools
                </p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto container mx-auto px-4 py-6 max-w-4xl">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <Bot className="h-16 w-16 text-neutral-600 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Start a Conversation</h2>
            <p className="text-neutral-400 text-center max-w-md mb-6">
              I can help you with:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
              <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <h3 className="font-bold mb-2">📊 Market Data</h3>
                <p className="text-sm text-neutral-400">"What's the price of Bitcoin?"</p>
              </div>
              <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <h3 className="font-bold mb-2">🔍 Smart Contracts</h3>
                <p className="text-sm text-neutral-400">"Analyze this contract for bugs"</p>
              </div>
              <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <h3 className="font-bold mb-2">⛓️ Blockchain</h3>
                <p className="text-sm text-neutral-400">"Check balance of 0x..."</p>
              </div>
              <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <h3 className="font-bold mb-2">✍️ Content</h3>
                <p className="text-sm text-neutral-400">"Create a tweet about DeFi"</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg max-w-2xl">
              <p className="text-sm text-blue-300">
                💡 <strong>Note:</strong> I automatically use the right tools based on your question. 
                Market data, blockchain queries, contract analysis - all handled automatically!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] md:max-w-[70%] rounded-lg p-4 ${
                    message.role === "user"
                      ? "bg-neutral-800 text-neutral-50"
                      : "bg-neutral-900 border border-neutral-800 text-neutral-100"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-blue-400" />
                      <span className="text-xs text-neutral-400">AgentMarket</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>
                  {message.swapTransaction && message.swapQuote && (
                    <div className="mt-4 p-4 bg-green-900/20 border border-green-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowRightLeft className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-semibold text-green-300">Swap Ready</span>
                      </div>
                      <div className="text-xs text-neutral-300 space-y-1 mb-3">
                        <p>
                          <span className="text-neutral-400">Swap:</span> {message.swapQuote.amountIn} {message.swapQuote.tokenIn} → ~{message.swapQuote.expectedAmountOut} {message.swapQuote.tokenOut}
                        </p>
                        <p>
                          <span className="text-neutral-400">Network:</span> Cronos {message.swapQuote.network}
                        </p>
                        {message.swapQuote.network === "Mainnet" && (
                          <p className="text-yellow-400 text-xs mt-2">
                            ⚠️ Make sure your wallet is on Cronos Mainnet (Chain ID: 25)
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => executeSwap(message.swapTransaction!)}
                        disabled={isSwapPending || isSwapConfirming}
                        className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-neutral-800 disabled:to-neutral-800 disabled:opacity-50 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSwapPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Signing...</span>
                          </>
                        ) : isSwapConfirming ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Confirming...</span>
                          </>
                        ) : isSwapConfirmed ? (
                          <>
                            <span>✅ Swap Executed</span>
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="h-4 w-4" />
                            <span>Sign & Execute Swap</span>
                          </>
                        )}
                      </button>
                      {swapTxHash && (
                        <p className="text-xs text-neutral-400 mt-2 text-center">
                          TX: {swapTxHash.slice(0, 10)}...{swapTxHash.slice(-8)}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-neutral-500 mt-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {executing && (
              <div className="flex justify-start">
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    <span className="text-sm text-neutral-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-neutral-800 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          {showPayment ? (
            <div className="mb-4">
              <X402Payment
                priceUsd={CHAT_PRICE}
                agentId={1} // Use agent #1 for payment tracking
                onPaymentComplete={handlePaymentComplete}
                onError={handlePaymentError}
              />
              {pendingMessage && (
                <p className="text-sm text-neutral-400 mt-2 text-center">
                  Message will be sent after payment: "{pendingMessage.substring(0, 50)}..."
                </p>
              )}
            </div>
          ) : (
            <>
              {paymentError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-300">
                  {paymentError}
                </div>
              )}
              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything... (e.g., 'What's the price of Bitcoin?', 'Analyze this contract...')"
                  className="flex-1 p-4 bg-neutral-900 border border-neutral-800 rounded-lg focus:ring-2 focus:ring-neutral-600 focus:border-neutral-600 text-neutral-50 placeholder-neutral-500 resize-none"
                  rows={3}
                  disabled={executing || !isConnected}
                />
                <button
                  onClick={sendMessage}
                  disabled={executing || !input.trim() || !isConnected}
                  className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-neutral-800 disabled:to-neutral-800 disabled:opacity-50 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {executing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
              {!isConnected && (
                <p className="text-sm text-neutral-500 mt-2 text-center">
                  Connect your wallet to start chatting
                </p>
              )}
              <p className="text-xs text-neutral-500 mt-2 text-center">
                ${CHAT_PRICE} per message • x402 micropayment
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
