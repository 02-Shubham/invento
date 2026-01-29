"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Send, Loader2, Bot, AlertTriangle, Sparkles, X, Wrench } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  toolResults?: any;
}

interface AIChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIChatWidget({ isOpen, onClose }: AIChatWidgetProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{message: string, type?: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (user) {
          console.log("🐛 DEBUG - YOUR USER ID IS:", user.uid);
      }
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
         setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-user-id": user?.uid || "" // Pass user ID for API helper
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to get response");
      }

      const aiMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: data.response || data.data?.response, // Handle standardized wrapper or direct
        timestamp: new Date(),
        toolsUsed: data.toolsUsed || []
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error("Chat error:", err);
      let errorMsg = err.message || "Something went wrong. Please try again.";
      let type = "general";
      
      if (err.message.includes("API key")) {
          // Keep specific message but set type for UI action
          type = "api_key";
      } else if (err.message.includes("RATE_LIMIT") || err.message.includes("quota")) {
          errorMsg = "OpenAI Rate Limit Exceeded. Please check your usage/billing.";
          type = "rate_limit";
      }
      
      setError({ message: errorMsg, type });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedPrompts = [
    "What products are low on stock?",
    "Show me this month's revenue",
    "Who are my top customers?"
  ];

  const handlePromptClick = (prompt: string) => {
      setInput(prompt);
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 w-[400px] h-[600px] shadow-2xl rounded-xl border border-neutral-200 bg-white flex-col transition-all duration-300 transform ${isOpen ? 'translate-y-0 opacity-100 flex' : 'translate-y-10 opacity-0 pointer-events-none hidden'}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-neutral-50 rounded-t-xl">
        <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-black rounded-lg flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
                <h3 className="font-semibold text-sm">Invento Assistant</h3>
                <p className="text-xs text-green-600 flex items-center">
                    <span className="block h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5"></span>
                    Online
                </p>
            </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-black" onClick={onClose}>
            <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 bg-white/50 overflow-y-auto">
        <div className="space-y-4">
            {messages.length === 0 && (
                <div className="text-center py-8 space-y-4">
                     <div className="h-16 w-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
                        <Sparkles className="h-8 w-8 text-neutral-400" />
                     </div>
                     <div className="space-y-1">
                        <h4 className="font-medium">How can I help you today?</h4>
                        <p className="text-sm text-neutral-500 max-w-[250px] mx-auto">
                            I can check your inventory, summarize invoices, or analyze your business performance.
                        </p>
                     </div>
                     <div className="flex flex-col gap-2 pt-2">
                         {suggestedPrompts.map((prompt, i) => (
                             <Button 
                                key={i} 
                                variant="outline" 
                                size="sm" 
                                className="text-xs w-full justify-start h-auto py-2 px-3 text-neutral-600 hover:text-black hover:border-black/50"
                                onClick={() => handlePromptClick(prompt)}
                             >
                                 {prompt}
                             </Button>
                         ))}
                     </div>
                </div>
            )}

            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}>
                        {msg.role === 'assistant' && (
                            <Avatar className="h-8 w-8 mt-0.5 border">
                                <AvatarImage src="/bot-avatar.png" />
                                <AvatarFallback className="bg-neutral-100 text-neutral-500"><Bot className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                        )}
                        
                        <div>
                            <div className={`p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                                msg.role === 'user' 
                                    ? 'bg-black text-white rounded-tr-sm' 
                                    : 'bg-neutral-100 text-neutral-800 rounded-tl-sm'
                            }`}>
                                {msg.content}
                            </div>
                            
                            {/* Tool Usage Display */}
                            {msg.role === 'assistant' && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {msg.toolsUsed.map((tool, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-100 px-2 py-0.5 h-5 font-normal flex items-center gap-1">
                                            <Wrench className="h-3 w-3" />
                                            Used: {tool.replace('_', ' ')}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {loading && (
                <div className="flex justify-start">
                    <div className="flex max-w-[85%] items-start gap-2">
                         <Avatar className="h-8 w-8 mt-0.5 border">
                            <AvatarFallback className="bg-neutral-100 text-neutral-500"><Bot className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="bg-neutral-50 p-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                            {/* Assuming we might know if tools are being used via streaming later, but for now just showing activity */}
                             <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                             <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                             <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <Alert variant="destructive" className="my-2 border-red-200 bg-red-50 text-red-800">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="ml-2 text-sm font-semibold">Error</AlertTitle>
                    <AlertDescription className="ml-2 text-xs mt-1">
                        {error.message}
                        {error.type === 'api_key' && (
                            <div className="mt-2">
                                <Link href="/settings/api-keys" className="underline font-medium hover:text-red-950" onClick={onClose}>
                                    Go to Settings
                                </Link>
                            </div>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-white rounded-b-xl">
        <div className="flex items-end gap-2">
            <Input 
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                className="min-h-[44px] max-h-[120px]"
                disabled={loading}
            />
            <Button 
                onClick={sendMessage} 
                className="h-11 w-11 shrink-0 rounded-lg" // Square-ish button looks modern
                disabled={!input.trim() || loading}
            >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
        </div>
      </div>
    </div>
  );
}
