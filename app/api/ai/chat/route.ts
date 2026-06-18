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
import { executeToolFunction } from "@/lib/tool-executor";

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
  controller.enqueue(sseEvent({ done: true, toolsUsed }));
  controller.close();
}

/** True-stream the final LLM synthesis after all tool results are in. */
async function trueStream(
  userId: string,
  messages: any[],
  toolsUsed: string[],
  controller: ReadableStreamDefaultController
) {
  try {
    for await (const token of sendChatMessageStream({ userId, messages, enableTools: false, maxTokens: 4000 })) {
      controller.enqueue(sseEvent({ token }));
    }
    controller.enqueue(sseEvent({ done: true, toolsUsed }));
  } catch (err: any) {
    controller.enqueue(sseEvent({ error: err.message || "Streaming failed" }));
  } finally {
    controller.close();
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
  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  let messages: any[] = [...history, { role: "user", content: message }];

  const allToolsUsed: string[] = [];
  // Track whether any tool call happened across all rounds
  let toolCallsHappened = false;
  // If AI responded with direct text on round 1 (no tools), store it here
  let directText: string | null = null;

  // ── Agentic tool loop (non-streaming) ────────────────────────────────────
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      console.log(`[ChatAPI] Round ${round + 1}/${MAX_TOOL_ROUNDS}`);

      const response = await sendChatMessage({ userId, messages, enableTools: true, maxTokens: 4000 });

      console.log(`[ChatAPI] Round ${round + 1} type: ${response.type}`);

      if (response.type === "text") {
        if (!toolCallsHappened) {
          // Simple query — AI answered directly without any tools
          directText = response.content;
        }
        // Either way, loop is done — we'll stream below
        break;
      }

      if (response.type === "tool_use") {
        toolCallsHappened = true;
        const toolResults: any[] = [];

        console.log(`[ChatAPI] Executing ${response.toolCalls.length} tool(s)`);

        for (const toolCall of response.toolCalls) {
          if (!allToolsUsed.includes(toolCall.name)) allToolsUsed.push(toolCall.name);
          const result = await executeToolFunction(toolCall.name, toolCall.input, userId);
          toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
        }

        messages = [
          ...messages,
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

    // ── Streaming response ────────────────────────────────────────────────
    //
    // Case A: AI answered directly (no tools) → fake-stream the stored text
    // Case B: Tools ran and loop ended → true-stream the LLM synthesis
    // Case C: Hit MAX_TOOL_ROUNDS (still requesting tools) → summary + fake-stream

    if (directText !== null) {
      // Case A — fake-stream simple text response
      const stream = new ReadableStream({
        async start(controller) {
          await fakeStream(directText!, [], controller);
        }
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }

    if (toolCallsHappened) {
      // Case B — true streaming synthesis after tools resolved
      const stream = new ReadableStream({
        async start(controller) {
          await trueStream(userId, messages, allToolsUsed, controller);
        }
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }

    // Case C — hit MAX_TOOL_ROUNDS, ask AI to summarise what it found
    console.warn(`[ChatAPI] Hit MAX_TOOL_ROUNDS — requesting summary`);
    const summaryResponse = await sendChatMessage({
      userId,
      messages: [...messages, { role: "user", content: "Please summarise the information you found and what actions you've taken so far." }],
      enableTools: false,
      maxTokens: 4000,
    });
    const summaryText = summaryResponse.type === "text"
      ? summaryResponse.content
      : "I've completed several steps. Please ask a follow-up question to continue.";

    const stream = new ReadableStream({
      async start(controller) {
        await fakeStream(summaryText, allToolsUsed, controller);
      }
    });
    return new Response(stream, { headers: SSE_HEADERS });

  } catch (error: any) {
    // Pre-stream errors: return JSON so the client can parse them
    console.error("[ChatAPI] Error:", error.message);

    const knownErrors: Record<string, { status: number; message: string }> = {
      API_KEY_MISSING:   { status: 400, message: "Please configure your AI API key in Settings." },
      INVALID_API_KEY:   { status: 400, message: "Your authentication failed with the AI provider. Please check your API key." },
      GROQ_KEY_MISSING:  { status: 500, message: "The AI service is not configured on the server. Please contact support." },
      RATE_LIMIT:        { status: 429, message: "Rate limit exceeded. Please wait a moment and try again." },
      SETTINGS_NOT_FOUND:{ status: 400, message: "Please complete your account setup in Settings before using the AI." },
    };

    const known = knownErrors[error.message];
    if (known) {
      return NextResponse.json({ success: false, error: error.message, message: known.message }, { status: known.status });
    }

    return errorResponse(error.message || "AI Service Unavailable", 500);
  }
}
