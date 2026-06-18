"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { firestoreService } from "@/lib/firestore-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Send, Loader2, Bot, AlertTriangle, Sparkles, X, Wrench, Mic, Square, MicOff, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useVoice } from "@/lib/voice-context";

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

const generateId = () => Math.random().toString(36).substring(2, 9);

// Debounce helper: save conversation max once per N ms to avoid Firestore hammering
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AIChatWidget({ isOpen, onClose }: AIChatWidgetProps) {
  const { user } = useAuth();
  const {
    isRecording,
    isProcessing: isVoiceProcessing,
    partialText,
    lastResponse,
    isSupported: isVoiceSupported,
    startRecording,
    stopRecording,
    clearResponse,
  } = useVoice();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{message: string, type?: string} | null>(null);

  // Bug #6: conversation persistence state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>("New Chat");
  const [isSaving, setIsSaving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Bug #6: Persist messages to Firestore (debounced, 2 s) ──────────────────
  const debouncedMessages = useDebounce(messages, 2000);

  const persistConversation = useCallback(
    async (msgs: Message[], cId: string, title: string) => {
      if (!user || msgs.length === 0) return;
      try {
        setIsSaving(true);
        await firestoreService.saveConversation(user.uid, cId, {
          title,
          messages: msgs.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
            toolsUsed: m.toolsUsed ?? [],
          })),
        });
      } catch (err) {
        console.error("[ChatWidget] Failed to persist conversation:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (debouncedMessages.length > 0 && conversationId) {
      persistConversation(debouncedMessages, conversationId, conversationTitle);
    }
  }, [debouncedMessages, conversationId, conversationTitle, persistConversation]);

  // ── Start a new conversation ────────────────────────────────────────────────
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setInput("");
    const newId = generateId() + generateId(); // 14-char random ID
    setConversationId(newId);
    setConversationTitle("New Chat");
  }, []);

  // Initialise a conversation ID on first open
  useEffect(() => {
    if (isOpen && !conversationId) {
      startNewConversation();
    }
  }, [isOpen, conversationId, startNewConversation]);

  // ── Derive conversation title from first user message ──────────────────────
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === "user" && conversationTitle === "New Chat") {
      const firstMsg = messages[0].content;
      const title = firstMsg.length > 50 ? firstMsg.slice(0, 47) + "…" : firstMsg;
      setConversationTitle(title);
    }
  }, [messages, conversationTitle]);

  // ── Sync input text with partial voice transcript ───────────────────────────
  useEffect(() => {
    if (isRecording) {
      setInput(partialText || "Listening...");
    }
  }, [isRecording, partialText]);

  // ── Handle voice response ───────────────────────────────────────────────────
  useEffect(() => {
    if (!lastResponse) return;

    const userMsgId = generateId();
    const aiMsgId = generateId();

    if (lastResponse.intent === "QUERY" && lastResponse.answer) {
      setMessages(prev => [
        ...prev,
        { id: userMsgId, role: "user", content: input || "Voice query", timestamp: new Date() },
        { id: aiMsgId, role: "assistant", content: lastResponse.answer!, timestamp: new Date() }
      ]);
      setInput("");
      clearResponse();
    } else if (
      lastResponse.intent === "NAVIGATE" ||
      lastResponse.intent === "SEARCH_PRODUCT" ||
      lastResponse.intent === "CREATE_INVOICE" ||
      lastResponse.intent === "VIEW_REPORT"
    ) {
      const actionText = lastResponse.intent === "NAVIGATE"
        ? `Navigating to ${lastResponse.target_screen ?? "page"}...`
        : lastResponse.intent === "SEARCH_PRODUCT"
        ? `Searching for "${lastResponse.search_query}"...`
        : lastResponse.intent === "CREATE_INVOICE"
        ? `Creating invoice for ${lastResponse.customer_name ?? "customer"}...`
        : `Opening report...`;

      setMessages(prev => [
        ...prev,
        { id: userMsgId, role: "user", content: input || "Voice command", timestamp: new Date() },
        { id: aiMsgId, role: "assistant", content: actionText, timestamp: new Date() }
      ]);
      setInput("");
      clearResponse();
    }
  }, [lastResponse, clearResponse]); // intentionally omits `input` to avoid stale closure re-runs

  // ── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Focus input on open ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ── Send message ────────────────────────────────────────────────────────────
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
            "x-user-id": user?.uid || ""
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
        content: data.response || data.data?.response,
        timestamp: new Date(),
        toolsUsed: data.toolsUsed || []
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error("Chat error:", err);
      let errorMsg = err.message || "Something went wrong. Please try again.";
      let type = "general";
      
      if (err.message.includes("API key")) {
          type = "api_key";
      } else if (err.message.includes("RATE_LIMIT") || err.message.includes("quota")) {
          errorMsg = "Rate limit exceeded. Please wait a moment and try again.";
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
    <>
      {/* Backdrop Overlay */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] md:w-[650px] h-[700px] max-h-[85vh] shadow-2xl rounded-xl border border-neutral-200 bg-white flex flex-col transition-all duration-300 transform ${
        isOpen 
          ? '-translate-y-1/2 scale-100 opacity-100' 
          : '-translate-y-[45%] scale-95 opacity-0 pointer-events-none'
      }`}>
      
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
                    {isSaving ? "Saving…" : "Online"}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-1">
            {/* New chat button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-neutral-500 hover:text-black"
              title="Start new conversation"
              onClick={startNewConversation}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-black" onClick={onClose}>
                <X className="h-4 w-4" />
            </Button>
        </div>
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
                                            Used: {tool.replace(/_/g, ' ')}
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
            <div className="relative flex-1">
              <Input 
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? "Listening..." : "Ask anything..."}
                  className="min-h-[44px] max-h-[120px] pr-10"
                  disabled={loading || isRecording}
              />
              <Button
                  variant="ghost"
                  size="icon"
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full ${isRecording ? 'text-red-500 bg-red-50 animate-pulse' : 'text-neutral-500 hover:text-black hover:bg-neutral-100'}`}
                  onClick={() => {
                    if (!isVoiceSupported) return;
                    if (isRecording) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                  disabled={isVoiceProcessing || !isVoiceSupported}
                  title={!isVoiceSupported ? "Voice is not supported in this browser" : isRecording ? "Stop listening" : "Talk to Invento"}
              >
                  {isRecording ? <Square className="h-4 w-4 fill-current" /> : !isVoiceSupported ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
            <Button 
                onClick={sendMessage} 
                className="h-11 w-11 shrink-0 rounded-lg"
                disabled={!input.trim() || loading || isRecording}
            >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
        </div>
      </div>
    </div>
    </>
  );
}
