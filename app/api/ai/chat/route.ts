// AGENTIC STREAMING FLOW:
//
// Phase 1 — Tool loop (non-streaming)
//   User message → AI decides if tools needed
//   If tools: execute → feed results back → repeat (max MAX_TOOL_ROUNDS)
//   If direct text on round 1: no tools used, fake-stream the response
//
// Phase 2 — Streaming synthesis
//   After tool loop finishes (messages[] has all tool results):
//   → Call sendChatMessageStream() with enableTools: false
//   → Pipe tokens as SSE: data: {"token":"…"}\n\n
//   → Final event:        data: {"done":true,"toolsUsed":[…]}\n\n
//
// All responses (success) return Content-Type: text/event-stream.
// Pre-stream errors (auth, missing key) return JSON with non-200 status.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, errorResponse } from "@/lib/api-helpers";
import { sendChatMessage, sendChatMessageStream } from "@/lib/ai-client";
import { executeToolFunction, isWriteTool } from "@/lib/tool-executor";

const MAX_TOOL_ROUNDS = 5;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no", // Disable Nginx buffering so tokens flush immediately
} as const;

/** Encode a JSON object as a single SSE data line */
function sseEvent(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Fake-stream a pre-generated text string word-by-word with a small delay.
 *  Used when AI responds with no tool calls (simple queries) — we already
 *  have the full text but still want the streaming visual effect. */
async function fakeStream(
  text: string,
  toolsUsed: string[],
  toolResults: Record<string, any>,
  controller: ReadableStreamDefaultController
) {
  // Split on whitespace boundaries, keeping the separators so spacing is preserved
  const tokens = text.split(/(\s+)/);
  for (const token of tokens) {
    if (!token) continue;
    controller.enqueue(sseEvent({ token }));
    // ~20 ms between tokens ≈ smooth 50-word/sec reading pace
    await new Promise(r => setTimeout(r, 20));
  }
  controller.enqueue(sseEvent({ done: true, toolsUsed, toolResults }));
  controller.close();
}

/** True-stream the final LLM synthesis after all tool results are in. */
async function trueStream(
  userId: string,
  messages: any[],
  toolsUsed: string[],
  toolResults: Record<string, any>,
  controller: ReadableStreamDefaultController
) {
  try {
    for await (const token of sendChatMessageStream({ userId, messages, enableTools: false, maxTokens: 4000 })) {
      controller.enqueue(sseEvent({ token }));
    }
    controller.enqueue(sseEvent({ done: true, toolsUsed, toolResults }));
  } catch (err: any) {
    controller.enqueue(sseEvent({ error: err.message || "Streaming failed" }));
  } finally {
    controller.close();
  }
}

function getToolSummary(toolName: string, result: any): string {
  if (!result || !result.success) return "Failed";
  const data = result.data;
  if (!data) return "Done";
  if (data.status === "pending_approval") return "Prepared — waiting for your approval";

  switch (toolName) {
    case "search_products":
      return `Found ${data.count || data.products?.length || 0} products`;
    case "search_customers":
      return `Found ${data.count || data.customers?.length || 0} customers`;
    case "get_customers_with_pending_payments":
      return `Found ${data.count || data.customers?.length || 0} outstanding accounts`;
    case "create_invoice":
      return `Created ${data.invoiceNumber} (${data.itemsCount} items, Total: $${data.totalAmount})`;
    case "adjust_stock":
      return `Adjusted stock by ${data.quantityAdjusted} (New stock: ${data.newStockLevel})`;
    case "get_revenue_report":
      return `Loaded report: ${data.period}`;
    case "get_low_stock_products":
      return `Found ${data.count || data.products?.length || 0} low stock items`;
    case "add_product":
      return `Added product ${data.name} (${data.sku})`;
    default:
      return "Completed";
  }
}

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const userId = await getCurrentUser(req);
  if (!userId) {
    console.warn("[ChatAPI] Unauthorized request");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, conversationHistory } = body;
  if (!message) {
    return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
  }

  console.log(`[ChatAPI] user:${userId} | msg:"${String(message).substring(0, 60)}…"`);

  // ── Build initial messages array ──────────────────────────────────────────
  // The browser supplies the history, so accept only plain user/assistant text.
  // Anything else (system/tool roles, forged tool_calls) is dropped.
  const history = (Array.isArray(conversationHistory) ? conversationHistory : [])
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content }));
  let messages: any[] = [...history, { role: "user", content: String(message) }];

  const allToolsUsed: string[] = [];
  const allToolResults: Record<string, any> = {};

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...messages];
        let loopDirectText: string | null = null;
        let loopToolCallsHappened = false;
        // At most one write proposal per turn: a second write would often depend on
        // the first having happened (e.g. invoice a product that isn't created yet).
        let writeProposedThisTurn = false;

        // ── Agentic tool loop (non-streaming internally, streamed to client) ────
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          console.log(`[ChatAPI] Round ${round + 1}/${MAX_TOOL_ROUNDS}`);

          const response = await sendChatMessage({ userId, messages: currentMessages, enableTools: true, maxTokens: 4000 });

          console.log(`[ChatAPI] Round ${round + 1} type: ${response.type}`);

          if (response.type === "text") {
            if (!loopToolCallsHappened) {
              loopDirectText = response.content;
            }
            break;
          }

          if (response.type === "tool_use") {
            loopToolCallsHappened = true;
            const toolResults: any[] = [];

            console.log(`[ChatAPI] Executing ${response.toolCalls.length} tool(s)`);

            for (const toolCall of response.toolCalls) {
              if (!allToolsUsed.includes(toolCall.name)) allToolsUsed.push(toolCall.name);
              
              // Enqueue "running" status update
              controller.enqueue(sseEvent({ step: { tool: toolCall.name, status: "running" } }));

              let result: Awaited<ReturnType<typeof executeToolFunction>>;
              if (isWriteTool(toolCall.name) && writeProposedThisTurn) {
                result = {
                  success: false,
                  error:
                    "Only one write action can be proposed at a time. Tell the user to review and approve the pending action first, then ask for the next step.",
                };
              } else {
                result = await executeToolFunction(toolCall.name, toolCall.input, userId);
              }

              if (result.proposal) {
                writeProposedThisTurn = true;
                // Send the approval card to the UI right away
                controller.enqueue(sseEvent({ proposal: result.proposal }));
              } else if (result.success && result.data && !isWriteTool(toolCall.name)) {
                allToolResults[toolCall.name] = result.data;
              }

              // Enqueue "done" status update with brief summary
              const summary = getToolSummary(toolCall.name, result);
              controller.enqueue(sseEvent({ step: { tool: toolCall.name, status: "done", summary } }));

              // The model gets the outcome only; the UI-only proposal view stays out of its context
              const { proposal: _uiOnly, ...forModel } = result;
              toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(forModel) });
            }

            currentMessages = [
              ...currentMessages,
              {
                role: "assistant",
                content: null,
                tool_calls: response.toolCalls.map(tc => ({
                  id: tc.id, type: "function",
                  function: { name: tc.name, arguments: JSON.stringify(tc.input) }
                }))
              },
              ...toolResults
            ];

            continue;
          }
        }

        // ── Streaming final response ──────────────────────────────────────────
        if (loopDirectText !== null) {
          await fakeStream(loopDirectText!, [], {}, controller);
          return;
        }

        if (loopToolCallsHappened) {
          await trueStream(userId, currentMessages, allToolsUsed, allToolResults, controller);
          return;
        }

        // Case C — hit MAX_TOOL_ROUNDS
        console.warn(`[ChatAPI] Hit MAX_TOOL_ROUNDS — requesting summary`);
        const summaryResponse = await sendChatMessage({
          userId,
          messages: [...currentMessages, { role: "user", content: "Please summarise the information you found and what actions you've taken so far." }],
          enableTools: false,
          maxTokens: 4000,
        });
        const summaryText = summaryResponse.type === "text"
          ? summaryResponse.content
          : "I've completed several steps. Please ask a follow-up question to continue.";

        await fakeStream(summaryText, allToolsUsed, allToolResults, controller);

      } catch (err: any) {
        controller.enqueue(sseEvent({ error: err.message || "Streaming failed" }));
        controller.close();
      }
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
