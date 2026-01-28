import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { sendChatMessage } from "@/lib/ai-client";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { message, conversationHistory } = body;

    if (!message) {
      return errorResponse("Message is required");
    }

    // Build messages array
    const history = Array.isArray(conversationHistory) ? conversationHistory : [];
    
    // Validate history format
    const validHistory = history.every((m: any) => 
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    );
    
    if (!validHistory) {
         // Silently recover if possible or just use empty
         // but strictly for API best practice:
         // return errorResponse("Invalid conversation history format");
    }

    const messages = [
        ...history,
        { role: "user", content: message }
    ];

    try {
        const responseText = await sendChatMessage({
            userId: user,
            messages
        });

        return successResponse({
            response: responseText,
            timestamp: new Date()
        });

    } catch (error: any) {
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
