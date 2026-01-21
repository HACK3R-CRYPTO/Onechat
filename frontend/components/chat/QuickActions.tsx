"use client";

import { 
  Wallet, 
  History, 
  TrendingUp, 
  ArrowRightLeft, 
  Send,
  Bot,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
  color: string;
  category: "portfolio" | "transaction" | "swap" | "transfer" | "query" | "wallet";
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: TrendingUp,
    label: "Show Portfolio",
    prompt: "show my portfolio",
    color: "text-green-400 hover:text-green-300",
    category: "portfolio",
  },
  {
    icon: History,
    label: "Transaction History",
    prompt: "my transactions",
    color: "text-blue-400 hover:text-blue-300",
    category: "transaction",
  },
  {
    icon: ArrowRightLeft,
    label: "Swap Tokens",
    prompt: "swap 100 CRO for USDC",
    color: "text-purple-400 hover:text-purple-300",
    category: "swap",
  },
  {
    icon: Send,
    label: "Transfer Funds",
    prompt: "transfer 10 USDC to",
    color: "text-orange-400 hover:text-orange-300",
    category: "transfer",
  },
  {
    icon: Wallet,
    label: "Check Balance",
    prompt: "what's my balance",
    color: "text-amber-400 hover:text-amber-300",
    category: "query",
  },
  {
    icon: Bot,
    label: "Create Wallet",
    prompt: "create a new wallet",
    color: "text-cyan-400 hover:text-cyan-300",
    category: "wallet",
  },
];

interface QuickActionsProps {
  onActionClick: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onActionClick, disabled = false }: QuickActionsProps) {
  return (
    <div className="w-full mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-neutral-400" />
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
          Quick Actions
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => onActionClick(action.prompt)}
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-lg",
                "bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800",
                "text-sm font-medium transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:border-neutral-700 hover:scale-105",
                action.color
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
