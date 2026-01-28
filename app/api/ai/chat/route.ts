import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { sendChatMessage } from "@/lib/ai-client";
import { executeToolFunction } from "@/lib/tool-executor";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    if (!userId) {
      console.warn("[ChatAPI] No user ID found in headers");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, conversationHistory } = body;
    console.log(`[ChatAPI] Received request from user: ${userId} | Message: "${message?.substring(0, 20)}..."`);

    if (!message) {
      return errorResponse("Message is required");
    }

    // Build messages array
    const history = Array.isArray(conversationHistory) ? conversationHistory : [];
    
    // Valid history check (relaxed for now to allow more complex objects later if needed, but keeping basic check)
    // The previous check was too strict for generic objects if we expand history schema
    
    const messages = [
        ...history,
        { role: "user", content: message }
    ] as any[];

    try {
        // First AI call - with tools enabled
        const response = await sendChatMessage({
            userId,
            messages,
            enableTools: true
        });
        
        console.log(`[ChatAPI] Initial AI response type: ${response.type}`);

        // Check if AI wants to use tools
        if (response.type === "tool_use") {
            // Execute each tool the AI requested
            const toolResults = [];
            const toolsUsedNames = [];

            console.log(`[ChatAPI] Processing ${response.toolCalls.length} tool calls`);

            for (const toolCall of response.toolCalls) {
                const toolName = toolCall.name;
                const toolInput = toolCall.input;
                toolsUsedNames.push(toolName);
                
                // Call the actual tool function
                const result = await executeToolFunction(toolName, toolInput, userId);
                
                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolCall.id,
                    content: JSON.stringify(result)
                });
            }

            // Send tool results back to the AI
            // We need to add the AI's tool use request AND the results to history
            const secondResponse = await sendChatMessage({
                userId,
                messages: [
                    ...messages,
                    { role: "assistant", content: null, tool_calls: response.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.input)
                        }
                    })) }, // Correctly format assistant's tool_use message for OpenAI
                    ...toolResults.map(tr => ({
                        role: "tool",
                        tool_call_id: tr.tool_use_id,
                        content: tr.content
                    }))
                ],
                enableTools: true // Keep tools enabled for potential follow-ups (though usually one turn is enough for now)
            });

            // If the second response is ALSO a tool use, we might need a loop. 
            // For this phase, we'll assume a single turn of tool usage is sufficient or handle just text response.
            // If it tries to use tools AGAIN, we'd need recursion. For simplicity, if it returns tools again,
            // we might just return the text part if available or error.
            // But typical flow: User -> AI Tool Call -> Tool Result -> AI Text Response.
            
            if (secondResponse.type === "tool_use") {
                // Edge case: AI wants to use tool again immediately. 
                // For MVP Phase 3, let's just return a generic message or handle it if we want to be fancy.
                // Let's assume it returns text 99% of time after getting results.
                // If it really returns tools, we'll just format the partial output we have or error.
                 return successResponse({
                    response: "I need to perform more actions, but I am limited to one step for now.",
                    toolsUsed: toolsUsedNames,
                    timestamp: new Date()
                });
            }

            return successResponse({
                response: secondResponse.content,
                toolsUsed: toolsUsedNames,
                timestamp: new Date()
            });
        } 
        
        // Normal text response
        return successResponse({
            response: response.content,
            toolsUsed: [],
            timestamp: new Date()
        });

    } catch (error: any) {
        console.error("[ChatAPI] Logic Panic:", error);
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
        
        return errorResponse(error.message || "AI Service Unavailable", 500);
    }

  } catch (error: any) {
    console.error("Error in chat endpoint:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
