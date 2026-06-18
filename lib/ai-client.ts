import { firestoreService } from "@/lib/firestore-service";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { UserSettings } from "@/types";
import { AI_TOOLS } from './ai-tools-schema';

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | any[]; 
  tool_call_id?: string; // For tool results
  name?: string; // For tool results/calls
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

**Current Context:**
- Date: ${new Date().toLocaleDateString()}

Remember: You're not just answering questions - you're taking actions to help run their business.`;

export type AIResponse = 
  | { type: "text"; content: string }
  | { type: "tool_use"; toolCalls: any[]; messageId: string };

export async function sendChatMessage(options: ChatOptions): Promise<AIResponse> {
    // Bug #4 fix: raised default maxTokens from 1000 → 4000 to prevent
    // tool result truncation on complex queries (revenue reports, large inventories, etc.)
    const { userId, messages, systemPrompt = AGENTIC_SYSTEM_PROMPT, maxTokens = 4000, enableTools = false } = options;

    console.log(`[AI-Client] Starting chat for user: ${userId} | Tools enabled: ${enableTools}`);

    // 1. Get Settings
    const settings = await firestoreService.getUserSettings(userId) as UserSettings;
    
    if (!settings) {
        console.error("[AI-Client] User settings not found");
        throw new Error("SETTINGS_NOT_FOUND");
    }

    // Map legacy 'google' provider to 'groq' for backward compatibility
    const rawProvider = settings.aiProvider || 'groq';
    const provider = rawProvider === 'google' ? 'groq' : rawProvider;
    
    // --- OPENAI LOGIC ---
    if (provider === 'openai') {
        if (!settings.aiApiKey) {
             throw new Error("API_KEY_MISSING");
        }
        const apiKey = settings.aiApiKey.trim();
        const model = settings.aiModel || 'gpt-4-turbo';

        try {
            const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: false });
            
            const openAIMessages = [
                { role: "system", content: systemPrompt },
                ...messages.filter(m => m.role !== 'system').map(m => {
                    if (m.role === 'tool') {
                       return {
                           role: 'tool',
                           tool_call_id: m.tool_call_id!,
                           content: m.content as string
                       };
                    }
                    return {
                        role: m.role,
                        content: m.content,
                        tool_calls: (m as any).tool_calls
                    };
                })
            ] as any;

            console.log(`[AI-Client] Sending to OpenAI (${model})...`);
            const response = await client.chat.completions.create({
                model: model,
                messages: openAIMessages,
                max_tokens: maxTokens,
                tools: enableTools ? AI_TOOLS : undefined,
                tool_choice: enableTools ? "auto" : "none" 
            });

            const choice = response.choices[0];
            const message = choice.message;

            if (message.tool_calls && message.tool_calls.length > 0) {
                return {
                    type: "tool_use",
                    toolCalls: message.tool_calls.map((tc: any) => ({
                        id: tc.id,
                        name: tc.function.name,
                        input: JSON.parse(tc.function.arguments),
                        type: 'function'
                    })),
                    messageId: response.id
                };
            } else {
                return { type: "text", content: message.content || "" };
            }
        } catch (error: any) {
             console.error("[AI-Client] OpenAI Error:", error);
             if (error.status === 401) throw new Error("INVALID_API_KEY");
             if (error.status === 429) throw new Error("RATE_LIMIT");
             throw new Error(error.message || "OpenAI Service Failed");
        }
    } 
    
    // --- GROQ LOGIC ---
    else if (provider === 'groq') {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error("[AI-Client] GROQ_API_KEY missing in environment variables");
            throw new Error("GROQ_KEY_MISSING");
        }

        // llama-3.3-70b-versatile has excellent tool-calling support and is very fast
        const model = 'llama-3.3-70b-versatile';

        try {
            const client = new Groq({ apiKey });

            // Groq uses the OpenAI-compatible format — same message & tool structure
            const groqMessages = [
                { role: "system", content: systemPrompt },
                ...messages.filter(m => m.role !== 'system').map(m => {
                    if (m.role === 'tool') {
                        return {
                            role: 'tool' as const,
                            tool_call_id: m.tool_call_id!,
                            content: m.content as string
                        };
                    }
                    return {
                        role: m.role as any,
                        content: m.content,
                        tool_calls: (m as any).tool_calls
                    };
                })
            ] as any;

            console.log(`[AI-Client] Sending to Groq (${model})...`);
            const response = await client.chat.completions.create({
                model,
                messages: groqMessages,
                max_tokens: maxTokens,
                tools: enableTools ? AI_TOOLS as any : undefined,
                tool_choice: enableTools ? "auto" : "none"
            });

            const choice = response.choices[0];
            const message = choice.message;

            if (message.tool_calls && message.tool_calls.length > 0) {
                return {
                    type: "tool_use",
                    toolCalls: message.tool_calls.map((tc: any) => ({
                        id: tc.id,
                        name: tc.function.name,
                        input: JSON.parse(tc.function.arguments),
                        type: 'function'
                    })),
                    messageId: response.id
                };
            } else {
                return { type: "text", content: message.content || "" };
            }
        } catch (error: any) {
            console.error("[AI-Client] Groq Error:", error);
            if (error.status === 401) throw new Error("INVALID_API_KEY");
            if (error.status === 429) throw new Error("RATE_LIMIT");
            throw new Error(error.message || "Groq Service Failed");
        }
    }

    throw new Error("INVALID_PROVIDER");
}
