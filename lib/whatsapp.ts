/**
 * WhatsApp Cloud API (Meta) helpers: signature check, sending, formatting.
 *
 * Env:
 *   WHATSAPP_TOKEN            permanent system-user access token
 *   WHATSAPP_PHONE_NUMBER_ID  the business number's id (not the phone number)
 *   WHATSAPP_VERIFY_TOKEN     any string you choose; entered in Meta's webhook setup
 *   WHATSAPP_APP_SECRET       the Meta app secret, used to verify webhook signatures
 *   WHATSAPP_DISPLAY_NUMBER   (optional) the number users should message, e.g. +91 98765 43210
 */
import crypto from "crypto";
import type { ActionView } from "@/lib/pending-actions";
import { formatMoney } from "@/lib/utils";

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN);
}

/** Verify Meta's X-Hub-Signature-256 over the RAW request body. Fails closed. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function post(payload: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) console.error(`[WhatsApp] send failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.ok;
}

export const sendText = (to: string, body: string) =>
  post({ to, type: "text", text: { body: body.slice(0, 4000) } });

/** Approve/Reject quick-reply buttons. The ids carry only the action id; the server holds the data. */
export const sendApprovalButtons = (to: string, body: string, actionId: string) =>
  post({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1000) },
      action: {
        buttons: [
          { type: "reply", reply: { id: `approve:${actionId}`, title: "Approve" } },
          { type: "reply", reply: { id: `reject:${actionId}`, title: "Reject" } },
        ],
      },
    },
  });

/** WhatsApp uses *bold* / _italic_; models emit Markdown. Convert the common bits. */
export function toWhatsAppText(md: string): string {
  return md
    .replace(/^#{1,6}\s*(.+)$/gm, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^\s*[-•]\s+/gm, "• ")
    .replace(/\|/g, " ")
    .replace(/^\s*:?-{3,}:?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain-text version of the approval card. */
export function proposalText(view: ActionView, currency: string): string {
  const p = view.preview;
  const m = (n: number) => formatMoney(n, currency);
  const out: string[] = [`*${p.title}*`];
  if (p.subtitle) out.push(p.subtitle);
  if (p.lines?.length) {
    out.push("");
    for (const l of p.lines) out.push(`• ${l.label} — ${l.quantity} × ${m(l.unitPrice)} = ${m(l.amount)}`);
  }
  if (p.details?.length) {
    out.push("");
    for (const d of p.details) out.push(`${d.label}: ${d.value}`);
  }
  if (p.totals?.length) {
    out.push("");
    for (const t of p.totals) out.push(t.bold ? `*${t.label}: ${m(t.amount)}*` : `${t.label}: ${m(t.amount)}`);
  }
  if (p.warnings?.length) {
    out.push("");
    for (const w of p.warnings) out.push(`⚠️ ${w}`);
  }
  out.push("", "Nothing happens until you tap a button.");
  return out.join("\n");
}

/** One-line outcome after approve/reject. */
export function outcomeText(view: ActionView | undefined, success: boolean, error: string | undefined, currency: string): string {
  if (!success) return `❌ Could not complete it: ${error || "unknown error"}`;
  const r = view?.result || {};
  switch (view?.tool) {
    case "create_invoice":
      return `✅ Invoice ${r.invoiceNumber ?? ""} created for ${r.customerName ?? "the customer"} — total ${formatMoney(Number(r.totalAmount) || 0, currency)}.`;
    case "adjust_stock":
      return `✅ Stock updated. New level: ${r.newStockLevel ?? "?"}.`;
    case "add_product":
      return `✅ Product ${r.name ?? ""} added${r.sku ? ` (${r.sku})` : ""}.`;
    default:
      return "✅ Done.";
  }
}
