import { firestoreService } from "@/lib/firestore-service";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { UserSettings } from "@/types";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatOptions {
  userId: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  maxTokens?: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are an intelligent business assistant for an inventory management and invoicing system called Invento AI.

Your role is to help small business owners with:
- Understanding their inventory and stock levels
- Creating and managing invoices
- Tracking customer payments
- Getting business insights and analytics
- Managing vendors and purchases

Currently, you can answer questions and provide guidance, but you cannot execute actions yet (like creating invoices or updating stock). That feature is coming soon.

Be conversational, helpful, and concise. If asked to perform an action you can't do yet, politely explain that the feature is in development and offer to explain how they can do it manually instead.

Current date: ${new Date().toLocaleDateString()}`;

export async function sendChatMessage(options: ChatOptions): Promise<string> {
    const { userId, messages, systemPrompt = DEFAULT_SYSTEM_PROMPT, maxTokens = 1000 } = options;

    // 1. Get Settings
    const settings = await firestoreService.getUserSettings(userId) as UserSettings;
    
    if (!settings || !settings.aiApiKey) {
        throw new Error("API_KEY_MISSING");
    }

    const apiKey = settings.aiApiKey;
    const provider = settings.aiProvider || 'anthropic';
    const model = settings.aiModel || (provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'gpt-4-turbo');

    try {
        if (provider === 'anthropic') {
            const client = new Anthropic({ apiKey });
            
            // Anthropic doesn't support 'system' role in messages array, takes separate param
            const anthroMessages = messages.filter(m => m.role !== 'system') as any;

            const response = await client.messages.create({
                model: model,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: anthroMessages
            });

            // Anthropic response content is array
            if (response.content[0].type === 'text') {
                return response.content[0].text;
            }
            return "Received non-text response from AI.";

        } else if (provider === 'openai') {
            const client = new OpenAI({ apiKey });
            
            const openAIMessages = [
                { role: "system", content: systemPrompt },
                ...messages.filter(m => m.role !== 'system')
            ] as any;

            const response = await client.chat.completions.create({
                model: model,
                messages: openAIMessages,
                max_tokens: maxTokens
            });

            return response.choices[0].message.content || "";
        } else {
             throw new Error("Unsupported AI Provider selected.");
        }

    } catch (error: any) {
        console.error("AI API Error:", error);
        
        if (error.status === 401) {
            throw new Error("INVALID_API_KEY");
        }
        if (error.status === 429) {
            throw new Error("RATE_LIMIT");
        }
        if (error.status === 404) {
             throw new Error(`Model ${model} not found or not available for this key.`);
        }
        // Pass through the actual error message for debugging
        throw new Error(error.message || "Failed to communicate with AI service");
    }
}
