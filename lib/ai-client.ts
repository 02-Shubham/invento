import { firestoreService } from "@/lib/firestore-service";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserSettings } from "@/types";
import { AI_TOOLS } from './ai-tools-schema';

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool"; // Added 'tool' role for OpenAI
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

**How to Use Tools:**
- When users ask about products, stock, or inventory, use search_products
- Always call tools when you can provide real data rather than generic answers
- After getting tool results, present information clearly to the user
- If a tool fails, explain the error and suggest alternatives

**Important Guidelines:**
1. Be proactive - if you can use a tool to help, do it
2. Be conversational - don't just dump data, explain what you found
3. Be accurate - only state facts from tool results, don't make assumptions
4. Be helpful - if you can't do something yet, explain how they can do it manually

**Example Interactions:**

User: "Do you have any bags?"
You: [Call search_products with query: "bags"]
Then respond: "I found 3 bag products: Leather Bag (₹800, 50 in stock), Fabric Bag (₹400, 30 in stock), Travel Bag (₹1500, 10 in stock). Which one interests you?"

User: "What's in stock?"
You: [Call search_products with query: "" to get all products]
Then respond: "You currently have 47 products in stock. Here are some highlights: [list top 5]. Would you like to see a specific category?"

**Key Behaviors:**
- Always use search_products when asked about products, inventory, or stock
- Present results conversationally, not just as a data dump
- If multiple products found, summarize and ask for clarification
- If no products found, say so clearly and suggest checking spelling
- Include price and stock info when relevant

**Current Context:**
- Date: ${new Date().toLocaleDateString()}

**Limitations:**
You can search for products, but you cannot yet:
- Create invoices (coming soon)
- Update stock (coming soon)
- Modify customer data (coming soon)

When asked to perform these actions, guide the user on how to do it manually in the app.

Remember: You're not just answering questions - you're taking actions to help run their business.`;

export type AIResponse = 
  | { type: "text"; content: string }
  | { type: "tool_use"; toolCalls: any[]; messageId: string };

export async function sendChatMessage(options: ChatOptions): Promise<AIResponse> {
    const { userId, messages, systemPrompt = AGENTIC_SYSTEM_PROMPT, maxTokens = 1000, enableTools = false } = options;

    console.log(`[AI-Client] Starting chat for user: ${userId} | Tools enabled: ${enableTools}`);

    // 1. Get Settings
    const settings = await firestoreService.getUserSettings(userId) as UserSettings;
    
    if (!settings) {
        console.error("[AI-Client] User settings not found");
        throw new Error("SETTINGS_NOT_FOUND");
    }

    const provider = settings.aiProvider || 'openai';
    
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
    
    // --- GOOGLE GEMINI LOGIC ---
    else if (provider === 'google') {
        // Use key from ENV variable as requested
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("[AI-Client] GEMINI_API_KEY missing in environment variables");
            throw new Error("GEMINI_KEY_MISSING");
        }

        const modelName = 'gemini-2.5-flash'; // Good balance for tools

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            // Convert tools to Gemini format
            // Define tool definition structure for Google Generative AI
            interface FunctionDeclaration {
                name: string;
                description: string;
                parameters?: {
                    type: string;
                    properties: Record<string, any>;
                    required?: string[];
                };
            }

            const tools = enableTools ? [{
                functionDeclarations: AI_TOOLS.map(t => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters ? {
                        type: "OBJECT", 
                        properties: t.function.parameters.properties,
                        required: t.function.parameters.required
                    } : undefined
                }))
            } as any] : undefined;

            const model = genAI.getGenerativeModel({ 
                model: modelName,
                systemInstruction: systemPrompt,
                tools: tools
            });

            // Convert history to Gemini format
            // Gemini uses "user" and "model" roles
            const history = messages
                .filter(m => m.role !== 'system')
                .map(m => {
                    if (m.role === 'tool') {
                         // Tool response handling in Gemini history is complex (FunctionResponse part)
                         // For single-turn implementation or simple re-feeding, we need proper parts structure
                         // Assuming 'content' is the JSON result
                         return {
                             role: 'function',
                             parts: [{
                                 functionResponse: {
                                    name: m.name || 'unknown_tool', // We need tool name here!!
                                    response: { name: m.name, content: m.content } // wrap content
                                 }
                             }]
                         };
                    }
                    if (m.role === 'assistant') {
                        // Check if it was a tool call
                         if ((m as any).tool_calls) {
                             return {
                                 role: 'model',
                                 parts: (m as any).tool_calls.map((tc: any) => ({
                                     functionCall: {
                                         name: tc.function.name,
                                         args: JSON.parse(tc.function.arguments)
                                     }
                                 }))
                             };
                         }
                         return { role: 'model', parts: [{ text: m.content as string }] };
                    }
                    return { role: 'user', parts: [{ text: m.content as string }] };
                });

            // Filter out 'function' roles if they don't have matching 'model' calls in history? 
            // Gemini requires strict User -> Model -> Function -> Model sequence.
            // Simplified: Just use the generateContent for the LAST user message, passing rest as history?
            // Actually, chatSession is better for multi-turn.
            
            // Let's assume standard chat session usage:
            const chat = model.startChat({
                history: history.slice(0, -1) as any // Everything except last message
            });

            const lastMsg = messages[messages.length - 1]; // Should be user message
            console.log(`[AI-Client] Sending to Gemini (${modelName})...`);
            
            const result = await chat.sendMessage(lastMsg.content as string);
            const response = result.response;
            const text = response.text();
            
            // Check for function calls
             const toolCalls = response.functionCalls();
             if (toolCalls && toolCalls.length > 0) {
                 return {
                     type: "tool_use",
                     toolCalls: toolCalls.map((tc) => ({
                         id: 'call_' + Math.random().toString(36).substr(2, 9), // Gemini doesn't always provide ID, generic one
                         name: tc.name,
                         input: tc.args,
                         type: 'function'
                     })),
                     messageId: 'gemini_' + Date.now()
                 };
             }

             return {
                 type: "text",
                 content: text
             };

        } catch (error: any) {
             console.error("[AI-Client] Gemini Error:", error);
             throw new Error(error.message || "Gemini Service Failed");
        }
    }

    throw new Error("INVALID_PROVIDER");
}
