/**
 * Handles one inbound WhatsApp message end to end:
 *   link code → link the phone; unknown phone → how-to-link; known phone → agent turn.
 * Write actions never execute here: the agent only PROPOSES (same prepare* path as the web chat),
 * and the owner approves with a button. Only a verified, linked phone can approve its owner's actions.
 */
import { sendChatMessage } from "@/lib/ai-client";
import { executeToolFunction, isWriteTool } from "@/lib/tool-executor";
import { approveAction } from "@/lib/action-runner";
import { rejectAction, toActionView, type ActionView } from "@/lib/pending-actions";
import { adminService } from "@/lib/admin-service";
import { consumeLinkCode, markMessageSeen, getHistory, getLinkedUser, saveHistory } from "@/lib/whatsapp-store";
import { outcomeText, proposalText, sendApprovalButtons, sendText, toWhatsAppText } from "@/lib/whatsapp";

const MAX_TOOL_ROUNDS = 5;
const LINK_RE = /^\s*(?:link\s*)?(\d{6})\s*$/i;

export interface InboundMessage {
  from: string; // E.164 digits, e.g. 919876543210 (trusted: webhook signature verified)
  text?: string;
  buttonId?: string;
}

async function currencyFor(userId: string): Promise<string> {
  try {
    return ((await adminService.getUserSettings(userId)) as any)?.currency || "INR";
  } catch {
    return "INR";
  }
}

async function runTurn(userId: string, history: { role: string; content: string }[], text: string) {
  let messages: any[] = [...history, { role: "user", content: text }];
  const proposals: ActionView[] = [];
  let writeProposed = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await sendChatMessage({ userId, messages, enableTools: true, maxTokens: 2000 });
    if (response.type === "text") return { reply: response.content, proposals };

    const toolMsgs: any[] = [];
    for (const tc of response.toolCalls) {
      let result: Awaited<ReturnType<typeof executeToolFunction>>;
      if (isWriteTool(tc.name) && writeProposed) {
        result = { success: false, error: "Only one write action can be proposed at a time. Ask the user to approve the pending one first." };
      } else {
        result = await executeToolFunction(tc.name, tc.input, userId);
      }
      if (result.proposal) {
        writeProposed = true;
        proposals.push(result.proposal);
      }
      const { proposal: _ui, ...forModel } = result;
      toolMsgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(forModel) });
    }
    messages = [
      ...messages,
      {
        role: "assistant",
        content: null,
        tool_calls: response.toolCalls.map((tc) => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.input) } })),
      },
      ...toolMsgs,
    ];
  }
  return { reply: "I did several steps. Tell me what you'd like next.", proposals };
}

export async function handleInbound(msg: InboundMessage): Promise<void> {
  const { from } = msg;

  // 1. Linking
  const codeMatch = msg.text ? LINK_RE.exec(msg.text) : null;
  if (codeMatch) {
    const userId = await consumeLinkCode(codeMatch[1], from);
    await sendText(
      from,
      userId
        ? "✅ WhatsApp linked. Ask me anything about your business, e.g. “who owes me money?” or “stock of rice”. Changes always need your approval here."
        : "That code is invalid or expired. Generate a new one in Invento → Settings → WhatsApp."
    );
    return;
  }

  const userId = await getLinkedUser(from);
  if (!userId) {
    await sendText(from, "Hi! This number isn't linked to an Invento account yet. Open Invento → Settings → WhatsApp, tap “Connect”, and send me the 6-digit code.");
    return;
  }

  // 2. Approve / Reject buttons
  if (msg.buttonId) {
    const [verb, id] = msg.buttonId.split(":");
    if (!id || (verb !== "approve" && verb !== "reject")) return;
    const currency = await currencyFor(userId);
    if (verb === "approve") {
      const r = await approveAction(id, userId);
      await sendText(from, r.code === 200 ? outcomeText(r.action, r.success, r.error, currency) : `⚠️ ${r.error}`);
    } else {
      const r = await rejectAction(id, userId);
      await sendText(from, r.ok ? "Okay, discarded. Nothing was changed." : `⚠️ ${r.error}`);
    }
    return;
  }

  // 3. Agent turn
  if (!msg.text) {
    await sendText(from, "I can only read text messages for now.");
    return;
  }
  const history = await getHistory(from);
  let out: Awaited<ReturnType<typeof runTurn>>;
  try {
    out = await runTurn(userId, history, msg.text);
  } catch (err: any) {
    console.error("[WhatsApp] agent error:", err?.message);
    await sendText(from, "Sorry, I hit a problem. Please try again in a moment.");
    return;
  }

  const reply = toWhatsAppText(out.reply || "");
  if (reply) await sendText(from, reply);
  if (out.proposals.length) {
    const currency = await currencyFor(userId);
    for (const p of out.proposals) await sendApprovalButtons(from, proposalText(p, currency), p.id);
  }
  await saveHistory(from, [...history, { role: "user", content: msg.text }, { role: "assistant", content: reply || "(sent approval request)" }] as any);
}

/** Dedupe (Meta retries) then handle each message; one failure never blocks the rest. */
export async function processInbound(inbound: (InboundMessage & { id: string })[]) {
  for (const { id, ...msg } of inbound) {
    try {
      if (!(await markMessageSeen(id))) continue;
      await handleInbound(msg);
    } catch (err: any) {
      console.error("[WhatsApp] handler failed:", err?.message);
    }
  }
}
