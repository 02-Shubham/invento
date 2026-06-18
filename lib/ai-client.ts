import { firestoreService } from "@/lib/firestore-service";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { UserSettings } from "@/types";
import { AI_TOOLS } from './ai-tools-schema';

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | any[]; 
  tool_call_id?: string;
  name?: string;
}

interface ChatOptions {
  userId: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  enableTools?: boolean;
}

const AGENTIC_SYSTEM_PROMPT = `You are an intelligent business assistant for Invento AI, an inventory management and invoicing system.

**Your Role:**
Help small business owners manage their inventory, customers, invoices, and business operations through natural conversation.

**Available Tools:**
You have access to real business functions you can execute.
- search_products: Search products by name/SKU
- search_customers: Search customers by name/email/phone
- get_customers_with_pending_payments: List customers with outstanding balances
- create_invoice: Create a new invoice for a customer (requires customerId and items)
- adjust_stock: Adjust the stock of a product (positive to add, negative to subtract)
- get_revenue_report: Get sales and revenue summaries for any period
- get_low_stock_products: Get low-stock items below a threshold (default 10)

**How to Use Tools:**
- When users ask about products, stock, or inventory, use search_products or get_low_stock_products
- When users ask to create an invoice or bill, use search_customers to find the customerId and search_products to find the productIds first. Once you have both, call create_invoice.
- Always call tools when you can provide real data or perform transactions rather than generic answers.
- After getting tool results, present information clearly to the user.
- If a tool fails, explain the error and suggest alternatives.

**Important Guidelines:**
1. Be proactive - if you can use a tool to help or perform a task, do it.
2. Be conversational - don't just dump raw JSON data, summarize and explain what you did.
3. Be accurate - only state facts from tool results, don't make assumptions.
4. If you need IDs (customerId or productId) to create invoices or adjust stock, ALWAYS search for them first using search_customers/search_products unless the user explicitly gave you the ID.
5. Format responses clearly using markdown — use **bold** for key numbers, bullet lists for multiple items, and tables for comparisons.

**Important Protocol:**
- Do NOT wrap tool calls in text tags like <function>...</function> or write function calls in your conversational response.
- Let the API handle the structured tool calls.

**Current Context:**
- Date: ${new Date().toLocaleDateString()}

Remember: You're not just answering questions - you're taking actions to help run their business.`;

export type AIResponse = 
  | { type: "text"; content: string }
  | { type: "tool_use"; toolCalls: any[]; messageId: string };

// ── Helper: build provider-agnostic client & settings ────────────────────────

async function resolveProvider(userId: string) {
  const settings = await firestoreService.getUserSettings(userId) as UserSettings;
  if (!settings) throw new Error("SETTINGS_NOT_FOUND");
  const rawProvider = settings.aiProvider || 'groq';
  const provider = rawProvider === 'google' ? 'groq' : rawProvider;
  return { settings, provider };
}

function buildOpenAIMessages(messages: ChatMessage[], systemPrompt: string) {
  return [
    { role: "system", content: systemPrompt },
    ...messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.tool_call_id!, content: m.content as string };
      }
      return { role: m.role, content: m.content, tool_calls: (m as any).tool_calls };
    })
  ] as any[];
}

// ── Non-streaming chat (used by agentic tool loop) ───────────────────────────

export async function sendChatMessage(options: ChatOptions): Promise<AIResponse> {
  const { userId, messages, systemPrompt = AGENTIC_SYSTEM_PROMPT, maxTokens = 4000, enableTools = false } = options;

  console.log(`[AI-Client] sendChatMessage | user: ${userId} | tools: ${enableTools}`);

  const { settings, provider } = await resolveProvider(userId);

  if (provider === 'openai') {
    if (!settings.aiApiKey) throw new Error("API_KEY_MISSING");
    const client = new OpenAI({ apiKey: settings.aiApiKey.trim(), dangerouslyAllowBrowser: false });
    const model = settings.aiModel || 'gpt-4-turbo';

    try {
      const response = await client.chat.completions.create({
        model,
        messages: buildOpenAIMessages(messages, systemPrompt),
        max_tokens: maxTokens,
        tools: enableTools ? AI_TOOLS : undefined,
        tool_choice: enableTools ? "auto" : "none",
      });

      const msg = response.choices[0].message;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        return {
          type: "tool_use",
          toolCalls: msg.tool_calls.map((tc: any) => ({
            id: tc.id, name: tc.function.name,
            input: JSON.parse(tc.function.arguments), type: 'function'
          })),
          messageId: response.id
        };
      }
      return { type: "text", content: msg.content || "" };
    } catch (error: any) {
      if (error.status === 401) throw new Error("INVALID_API_KEY");
      if (error.status === 429) throw new Error("RATE_LIMIT");
      throw new Error(error.message || "OpenAI Service Failed");
    }
  }

  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_KEY_MISSING");
    const client = new Groq({ apiKey });
    const model = 'llama-3.3-70b-versatile';

    try {
      const response = await client.chat.completions.create({
        model,
        messages: buildOpenAIMessages(messages, systemPrompt) as any,
        max_tokens: maxTokens,
        tools: enableTools ? AI_TOOLS as any : undefined,
        tool_choice: enableTools ? "auto" : "none",
      });

      const msg = response.choices[0].message;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        return {
          type: "tool_use",
          toolCalls: msg.tool_calls.map((tc: any) => ({
            id: tc.id, name: tc.function.name,
            input: JSON.parse(tc.function.arguments), type: 'function'
          })),
          messageId: response.id
        };
      }
      return { type: "text", content: msg.content || "" };
    } catch (error: any) {
      if (error.status === 401) throw new Error("INVALID_API_KEY");
      if (error.status === 429) throw new Error("RATE_LIMIT");

      // Intercept and parse Groq's failed_generation when it emits XML tool calls instead of standard tool calls
      if (error.status === 400) {
        const rawError = error.error || error;
        const failedGen = rawError?.failed_generation || rawError?.error?.failed_generation;
        if (failedGen) {
          const match = failedGen.match(/<function=(\w+)=([\s\S]*?)<\/function>/);
          if (match) {
            const toolName = match[1];
            const argsStr = match[2];
            try {
              const parsedArgs = JSON.parse(argsStr);
              console.log(`[AI-Client] Intercepted and parsed tool call from failed_generation: ${toolName}`, parsedArgs);
              return {
                type: "tool_use",
                toolCalls: [{
                  id: `call_${Math.random().toString(36).substring(2, 9)}`,
                  name: toolName,
                  input: parsedArgs,
                  type: 'function'
                }],
                messageId: `msg_${Math.random().toString(36).substring(2, 9)}`
              };
            } catch (jsonErr) {
              console.warn("[AI-Client] Failed to parse failed_generation JSON:", jsonErr);
            }
          }
        }
      }

      throw new Error(error.message || "Groq Service Failed");
    }
  }

  throw new Error("INVALID_PROVIDER");
}

// ── Streaming chat (used for final text synthesis after tool loop) ────────────
//
// Returns an AsyncGenerator that yields string tokens one at a time.
// enableTools is always false here — this is pure text synthesis.
//
export async function* sendChatMessageStream(options: ChatOptions): AsyncGenerator<string> {
  const { userId, messages, systemPrompt = AGENTIC_SYSTEM_PROMPT, maxTokens = 4000 } = options;

  console.log(`[AI-Client] sendChatMessageStream | user: ${userId}`);

  const { settings, provider } = await resolveProvider(userId);

  if (provider === 'openai') {
    if (!settings.aiApiKey) throw new Error("API_KEY_MISSING");
    const client = new OpenAI({ apiKey: settings.aiApiKey.trim(), dangerouslyAllowBrowser: false });
    const model = settings.aiModel || 'gpt-4-turbo';

    try {
      const stream = await client.chat.completions.create({
        model,
        messages: buildOpenAIMessages(messages, systemPrompt),
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) yield token;
      }
    } catch (error: any) {
      if (error.status === 401) throw new Error("INVALID_API_KEY");
      if (error.status === 429) throw new Error("RATE_LIMIT");
      throw new Error(error.message || "OpenAI Streaming Failed");
    }
    return;
  }

  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_KEY_MISSING");
    const client = new Groq({ apiKey });
    const model = 'llama-3.3-70b-versatile';

    try {
      const stream = await client.chat.completions.create({
        model,
        messages: buildOpenAIMessages(messages, systemPrompt) as any,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = (chunk as any).choices[0]?.delta?.content;
        if (token) yield token;
      }
    } catch (error: any) {
      if (error.status === 401) throw new Error("INVALID_API_KEY");
      if (error.status === 429) throw new Error("RATE_LIMIT");
      throw new Error(error.message || "Groq Streaming Failed");
    }
    return;
  }

  throw new Error("INVALID_PROVIDER");
}
