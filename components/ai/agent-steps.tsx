"use client";

import { Loader2, Check } from "lucide-react";

export interface AgentStep {
  tool: string;
  status: "running" | "done";
  summary?: string;
}

const TOOL_MAP: Record<string, { emoji: string; label: string }> = {
  search_products: { emoji: "🔍", label: "Searching products" },
  search_customers: { emoji: "👤", label: "Searching customers" },
  create_invoice: { emoji: "📄", label: "Creating invoice" },
  adjust_stock: { emoji: "📦", label: "Updating stock" },
  get_revenue_report: { emoji: "📊", label: "Loading revenue report" },
  get_low_stock_products: { emoji: "⚠️", label: "Checking low stock" },
  get_customers_with_pending_payments: { emoji: "💳", label: "Checking pending payments" },
  add_product: { emoji: "➕", label: "Adding product" },
};

interface AgentStepsProps {
  steps: AgentStep[];
}

export default function AgentSteps({ steps }: AgentStepsProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 bg-neutral-50 border border-neutral-100 rounded-2xl p-4 my-2 max-w-[90%] md:max-w-[80%] shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h5 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
        Invento Agent Actions
      </h5>
      <div className="flex flex-col gap-3">
        {steps.map((step, idx) => {
          const config = TOOL_MAP[step.tool] || { emoji: "⚙️", label: step.tool.replace(/_/g, " ") };
          const isRunning = step.status === "running";

          return (
            <div
              key={idx}
              className="flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0" role="img" aria-label={config.label}>
                  {config.emoji}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-neutral-800 leading-none">
                    {config.label}
                    {isRunning && <span className="text-neutral-400">...</span>}
                  </p>
                  {step.summary && (
                    <p className="text-[10px] text-neutral-500 mt-1 font-mono truncate">
                      {step.summary}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-emerald-600 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
