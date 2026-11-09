"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, CheckCircle2, Clock, Loader2, ShieldQuestion, X, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils";
import { InvoiceCreatedCard, ProductCreatedCard } from "@/components/ai/tool-result-cards";
import type { ActionView } from "@/lib/pending-actions";

/**
 * Approval card for an AI-proposed write action.
 *
 * The card never sends data to be executed: Approve/Reject send only the action
 * id, and the server runs what it stored when the action was proposed. This
 * component only displays the server's view of the action.
 */

const TOOL_LABEL: Record<string, string> = {
  create_invoice: "Invoice",
  adjust_stock: "Stock change",
  add_product: "New product",
};

/** A short line for the chat history, so the model knows what happened. */
export function describeOutcome(action: ActionView): string {
  const what = action.preview.title.toLowerCase();
  switch (action.status) {
    case "done": {
      const r = action.result || {};
      if (action.tool === "create_invoice")
        return `✅ Approved — invoice ${r.invoiceNumber} was created for ${r.customerName} (total ${formatCurrency(r.totalAmount)}).`;
      if (action.tool === "add_product")
        return `✅ Approved — product "${r.name}" (${r.sku}) was added at ${formatCurrency(r.price)}.`;
      if (action.tool === "adjust_stock")
        return `✅ Approved — stock for ${r.productName} changed by ${r.quantityAdjusted > 0 ? "+" : ""}${r.quantityAdjusted}; it is now ${r.newStockLevel}.`;
      return `✅ Approved — ${what} done.`;
    }
    case "rejected":
      return `❌ Rejected — "${action.preview.title}" was cancelled. Nothing was changed.`;
    case "failed":
      return `⚠️ The approved action "${action.preview.title}" could not be completed: ${action.error || "unknown error"}. Nothing was changed.`;
    case "expired":
      return `⌛ The proposal "${action.preview.title}" expired. Nothing was changed.`;
    default:
      return "";
  }
}

function hoursLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `expires in ${h}h` : `expires in ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

interface Props {
  action: ActionView;
  /** Called when the server reports a new state (approved, rejected, failed, expired…). */
  onResolved: (action: ActionView) => void;
}

export default function ProposalCard({ action, onResolved }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const inFlight = useRef(false); // blocks double clicks before React re-renders

  const call = async (path: string, init?: RequestInit) => {
    const token = await user?.getIdToken();
    return fetch(`/api/ai/actions/${action.id}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
  };

  // A card restored from chat history may be stale (decided on another device/tab).
  // The server is the authority, so refresh any card that still looks open.
  useEffect(() => {
    if (!user || (action.status !== "pending" && action.status !== "executing")) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await call("");
        if (cancelled) return;
        if (res.status === 404) return setGone(true);
        const json = await res.json();
        if (json.action && json.action.status !== action.status) onResolved(json.action);
      } catch {
        /* offline: keep what we have */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, action.id]);

  const decide = async (kind: "approve" | "reject") => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(kind);
    setError(null);
    try {
      const res = await call(`/${kind}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (json.action) {
        onResolved(json.action); // success, business failure, 409 already handled, or 410 expired
        if (!json.success && json.error && json.action.status !== "failed") setError(json.error);
      } else {
        setError(json.error || `Request failed (${res.status})`);
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const { preview, status } = action;
  const label = TOOL_LABEL[action.tool] || "Action";

  // ── Finished states ────────────────────────────────────────────────────────
  if (status === "done") {
    const r = action.result;
    if (action.tool === "create_invoice" && r) return <InvoiceCreatedCard data={r} />;
    if (action.tool === "add_product" && r) return <ProductCreatedCard data={r} />;
    return (
      <div className="my-3 flex items-start gap-2 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 bg-white p-4 text-sm shadow-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div>
          <div className="font-semibold text-neutral-900">{preview.title} — done</div>
          <div className="text-xs text-neutral-600">
            {r?.productName}: {r?.quantityAdjusted > 0 ? "+" : ""}
            {r?.quantityAdjusted} → stock is now <b>{r?.newStockLevel}</b>
          </div>
        </div>
      </div>
    );
  }

  if (status === "rejected" || status === "expired" || gone) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500">
        {status === "expired" ? <Clock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        <span>
          <b className="text-neutral-700">{preview.title}</b>
          {gone ? " — no longer available." : status === "expired" ? " — expired. Nothing was changed." : " — rejected. Nothing was changed."}
        </span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="my-3 flex items-start gap-2 rounded-xl border border-red-200 border-l-4 border-l-red-500 bg-red-50/50 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <div>
          <div className="font-semibold text-neutral-900">{preview.title} — could not be completed</div>
          <div className="text-xs text-red-700">{action.error}</div>
          <div className="mt-1 text-xs text-neutral-500">Nothing was changed. Ask the assistant to prepare it again.</div>
        </div>
      </div>
    );
  }

  // ── Open: pending / executing ──────────────────────────────────────────────
  const executing = status === "executing" || busy === "approve";

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 bg-white shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              <ShieldQuestion className="h-3 w-3" /> Needs your approval
            </span>
            <h4 className="mt-1 text-sm font-semibold text-neutral-900">{preview.title}</h4>
            {preview.subtitle && <p className="text-xs text-neutral-500">{preview.subtitle}</p>}
          </div>
          <Badge variant="outline" className="shrink-0 bg-neutral-50 text-[10px] text-neutral-600">
            {label}
          </Badge>
        </div>

        {preview.lines && preview.lines.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-neutral-100 text-xs">
            {preview.lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-800">{l.label}</div>
                  <div className="text-neutral-400">
                    {l.quantity} × {formatCurrency(l.unitPrice)}
                  </div>
                </div>
                <div className="shrink-0 font-medium text-neutral-800">{formatCurrency(l.amount)}</div>
              </div>
            ))}
          </div>
        )}

        {preview.details && preview.details.length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {preview.details.map((d, i) => (
              <div key={i} className="contents">
                <dt className="text-neutral-400">{d.label}</dt>
                <dd className="break-words text-right font-medium text-neutral-800">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {preview.totals && preview.totals.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs">
            {preview.totals.map((t, i) => (
              <div key={i} className={`flex justify-between ${t.bold ? "text-sm font-bold text-neutral-900" : "text-neutral-600"}`}>
                <span>{t.label}</span>
                <span>{formatCurrency(t.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {preview.warnings && preview.warnings.length > 0 && (
          <div className="mt-3 space-y-1 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
            {preview.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={!!busy || executing} onClick={() => decide("approve")}>
            {executing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            {executing ? "Working…" : "Approve"}
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy || executing} onClick={() => decide("reject")}>
            {busy === "reject" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
            Reject
          </Button>
          <span className="ml-auto text-[10px] text-neutral-400">{hoursLeft(action.expiresAt)}</span>
        </div>
        <p className="mt-2 text-[10px] text-neutral-400">Nothing has been changed yet. Want a different quantity or price? Reject and tell me.</p>
      </div>
    </div>
  );
}
