// (kt) Voice API Route — /api/ai/voice
// Accepts: { text, conversationHistory, userId (from header) }
// Builds an Invento-specific system prompt and calls the existing
// sendChatMessage() for structured JSON intent extraction.
// Returns: { success: true, action: VoiceActionPayload }

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { sendChatMessage } from "@/lib/ai-client";

// ── Voice system prompt ───────────────────────────────────────────────────────

const buildVoiceSystemPrompt = () => `
You are the Invento Voice Agent — an autonomous AI assistant for the Invento.ai inventory and invoicing platform.

## Your Job
Extract the user's intent from voice commands and return a STRICT JSON object matching the VoiceActionPayload schema below. Never return plain text — only valid JSON.

## Supported Intents
- NAVIGATE       → User wants to go to a page
- SEARCH_PRODUCT → User wants to find a product in inventory
- CREATE_INVOICE → User wants to create a new invoice 
- VIEW_REPORT    → User wants to see analytics/reports
- QUERY          → User is asking a general question (answer in the "answer" field)
- UNKNOWN        → Cannot determine intent

## Response Schema (always return this exact structure)
{
  "intent": "NAVIGATE" | "SEARCH_PRODUCT" | "CREATE_INVOICE" | "VIEW_REPORT" | "QUERY" | "UNKNOWN",
  "is_complete": boolean,
  "missing_fields": string[],
  "reply_prompt": "Question to ask user if info is missing (conversational, friendly)",
  
  "target_screen": "dashboard" | "inventory" | "invoices" | "customers" | "payments" | "purchase" | "settings",
  
  "search_query": "exact search string to prefill in the inventory search box",
  "product_name": "specific product name if mentioned",
  
  "customer_name": "customer name for invoice",
  "invoice_items": "items mentioned for invoice",
  
  "report_type": "revenue" | "inventory" | "customers",
  "report_period": "human readable period like 'this month', 'last 7 days'",
  
  "answer": "2-3 sentence answer for QUERY intent questions"
}

## Inference Rules (apply these strictly)
- "go to" / "open" / "show" / "take me to" → NAVIGATE
- "search" / "find" / "look for" / "do you have" → SEARCH_PRODUCT
- "create invoice" / "make a bill" / "bill for" / "invoice for" → CREATE_INVOICE
- "revenue" / "sales" / "how much" / "earnings" / "performance" → VIEW_REPORT with report_type: "revenue"
- "stock report" / "inventory report" / "what's in stock" → VIEW_REPORT with report_type: "inventory"
- Target screens: "home"/"main" → "dashboard", "stock"/"products" → "inventory", "bills" → "invoices", "buy"/"purchase orders" → "purchase"

## Multi-turn Rules
- If intent is CREATE_INVOICE and customer_name is missing → is_complete: false, missing_fields: ["customer_name"], ask for it
- For SEARCH_PRODUCT you almost always have enough from the first utterance
- For NAVIGATE you always have enough
- Keep missing_fields array empty [] when is_complete is true

## Current Context
- Platform: Invento.ai — inventory management and invoicing for small businesses
- Time: ${new Date().toLocaleString()}
`;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { text, conversationHistory } = body;

    if (!text?.trim()) {
      return errorResponse("text is required");
    }

    const history = Array.isArray(conversationHistory) ? conversationHistory : [];

    // Build messages — system prompt + conversation history + new user turn
    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: text },
    ];

    // Call the existing AI client (uses user's configured OpenAI / Gemini key)
    const aiResponse = await sendChatMessage({
      userId,
      messages,
      systemPrompt: buildVoiceSystemPrompt(),
      maxTokens: 500,
      enableTools: false, // Voice uses structured JSON mode, not function calling
    });

    if (aiResponse.type !== "text") {
      // Should not happen with enableTools: false, but handle gracefully
      return errorResponse("Unexpected AI response type for voice command");
    }

    // Parse the JSON payload from the LLM response
    let action: Record<string, unknown>;
    try {
      action = JSON.parse(aiResponse.content);
    } catch {
      // Fallback: extract JSON block if LLM leaks text around it
      const match = aiResponse.content.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("[VoiceAPI] LLM returned non-JSON:", aiResponse.content);
        return errorResponse("Could not parse voice command response");
      }
      action = JSON.parse(match[0]);
    }

    // Ensure required fields have sensible defaults
    if (!action.intent) action.intent = "UNKNOWN";
    if (typeof action.is_complete !== "boolean") action.is_complete = true;
    if (!Array.isArray(action.missing_fields)) action.missing_fields = [];

    return successResponse({ action });
  } catch (error: any) {
    console.error("[VoiceAPI] Error:", error);

    if (error.message === "API_KEY_MISSING" || error.message === "SETTINGS_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          error: "API key not configured",
          message: "Please configure your AI API key in Settings to use voice commands.",
          settingsUrl: "/settings",
        },
        { status: 400 }
      );
    }

    return errorResponse(error.message || "Voice command processing failed", 500);
  }
}
