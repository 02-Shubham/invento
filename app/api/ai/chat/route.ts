// AGENTIC FUNCTION CALLING FLOW:
// 1. User sends message
// 2. AI (OpenAI/Groq) analyzes and decides if tools needed
// 3. If yes, returns tool_use blocks (doesn't execute them)
// 4. We execute tools by calling our service functions
// 5. Send tool results back to AI
// 6. AI processes results — may call more tools (up to MAX_TOOL_ROUNDS)
// 7. When AI returns text, we return the final response + tools used list

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { sendChatMessage } from "@/lib/ai-client";
import { executeToolFunction } from "@/lib/tool-executor";

// Bug #2 fix: allow the AI to chain multiple tool calls instead of stopping
// after a single round with a hardcoded fallback message.
const MAX_TOOL_ROUNDS = 5;

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    if (!userId) {
      console.warn("[ChatAPI] No user ID found in headers");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, conversationHistory } = body;
    console.log(`[ChatAPI] Received request from user: ${userId} | Message: "${message?.substring(0, 50)}..."`);

    if (!message) {
      return errorResponse("Message is required");
    }

    // Build messages array
    const history = Array.isArray(conversationHistory) ? conversationHistory : [];
    
    let messages = [
        ...history,
        { role: "user", content: message }
    ] as any[];

    // Track all tools used across the entire agentic loop
    const allToolsUsed: string[] = [];

    try {
        // ── Agentic Loop ──────────────────────────────────────────────────────
        // The AI can call tools multiple times (e.g. search_customer → search_product → create_invoice)
        // We iterate until the AI returns a plain text response or we hit the safety cap.
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            console.log(`[ChatAPI] Agentic round ${round + 1}/${MAX_TOOL_ROUNDS}`);

            const response = await sendChatMessage({
                userId,
                messages,
                enableTools: true,
                // Bug #4 fix: pass 4000 explicitly so older callers that relied on the
                // 1000-token default also get the higher limit here
                maxTokens: 4000,
            });

            console.log(`[ChatAPI] Round ${round + 1} response type: ${response.type}`);

            // ── Plain text response → done ─────────────────────────────────
            if (response.type === "text") {
                return successResponse({
                    response: response.content,
                    toolsUsed: allToolsUsed,
                    timestamp: new Date()
                });
            }

            // ── Tool use → execute all requested tools, feed results back ──
            if (response.type === "tool_use") {
                const toolResults: any[] = [];

                console.log(`[ChatAPI] Executing ${response.toolCalls.length} tool call(s) in round ${round + 1}`);

                for (const toolCall of response.toolCalls) {
                    const toolName = toolCall.name;
                    const toolInput = toolCall.input;

                    if (!allToolsUsed.includes(toolName)) {
                        allToolsUsed.push(toolName);
                    }

                    const result = await executeToolFunction(toolName, toolInput, userId);

                    toolResults.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(result)
                    });
                }

                // Append the assistant's tool-call turn + all results to history
                // so the next round has full context.
                messages = [
                    ...messages,
                    {
                        role: "assistant",
                        content: null,
                        tool_calls: response.toolCalls.map(tc => ({
                            id: tc.id,
                            type: "function",
                            function: {
                                name: tc.name,
                                arguments: JSON.stringify(tc.input)
                            }
                        }))
                    },
                    ...toolResults
                ];

                // Continue to next round
                continue;
            }
        }

        // Safety: we hit MAX_TOOL_ROUNDS and the AI is still requesting tools.
        // Ask the AI to summarise what it has done so far with the results it got.
        console.warn(`[ChatAPI] Hit MAX_TOOL_ROUNDS (${MAX_TOOL_ROUNDS}) — requesting summary`);
        const summaryResponse = await sendChatMessage({
            userId,
            messages: [
                ...messages,
                { role: "user", content: "Please summarise the information you found and what actions you've taken so far." }
            ],
            enableTools: false, // Don't allow more tools — force text answer
            maxTokens: 4000,
        });

        return successResponse({
            response: summaryResponse.type === "text"
                ? summaryResponse.content
                : "I've completed several steps. Please ask a follow-up question to continue.",
            toolsUsed: allToolsUsed,
            timestamp: new Date()
        });

    } catch (error: any) {
        console.error("[ChatAPI] Logic error:", error);
        if (error.message === "API_KEY_MISSING") {
             return NextResponse.json({
                 success: false,
                 error: "API key not configured",
                 message: "Please configure your AI API key in Settings.",
                 settingsUrl: "/settings/api-keys"
             }, { status: 400 });
        }
        if (error.message === "INVALID_API_KEY") {
             return NextResponse.json({
                 success: false,
                 error: "Invalid API key",
                 message: "Your authentication failed with the AI provider. Please check your API key."
             }, { status: 400 });
        }
        if (error.message === "GROQ_KEY_MISSING") {
            return NextResponse.json({
                success: false,
                error: "Server configuration error",
                message: "The AI service is not configured on the server. Please contact support."
            }, { status: 500 });
        }
        
        return errorResponse(error.message || "AI Service Unavailable", 500);
    }

  } catch (error: any) {
    console.error("Error in chat endpoint:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
