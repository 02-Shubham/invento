"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { firestoreService } from "@/lib/firestore-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Send, Loader2, Bot, AlertTriangle, Sparkles, X, Wrench,
  Mic, Square, MicOff, Plus, History, Clock, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useVoice } from "@/lib/voice-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  isStreaming?: boolean; // true while tokens are arriving
}

interface SavedConversation {
  id: string;
  title: string;
  updatedAt: any;
}

interface AIChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateId = () => Math.random().toString(36).substring(2, 9);

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatRelativeTime(ts: any): string {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Markdown components ───────────────────────────────────────────────────────
// Styled to match the neutral/black design system of the chat widget.

const mdComponents = {
  p: ({ children }: any) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-neutral-900">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
      {children}
    </a>
  ),
  ul: ({ children }: any) => <ul className="list-disc list-inside space-y-0.5 mb-1.5 pl-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-0.5 mb-1.5 pl-1">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }: any) => <h1 className="text-base font-bold mb-1.5 mt-2 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-semibold mb-1 mt-1.5 first:mt-0">{children}</h3>,
  code: ({ inline, children }: any) =>
    inline
      ? <code className="bg-neutral-200 text-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>
      : <code className="block bg-neutral-800 text-neutral-100 p-2 rounded-lg text-[11px] font-mono overflow-x-auto mb-1.5">{children}</code>,
  pre: ({ children }: any) => <pre className="mb-1.5 overflow-x-auto">{children}</pre>,
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-neutral-200">{children}</thead>,
  tr: ({ children }: any) => <tr className="border-b border-neutral-200">{children}</tr>,
  th: ({ children }: any) => <th className="text-left px-2 py-1 font-semibold text-neutral-700">{children}</th>,
  td: ({ children }: any) => <td className="px-2 py-1 text-neutral-700">{children}</td>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-neutral-300 pl-3 italic text-neutral-600 mb-1.5">{children}</blockquote>
  ),
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AIChatWidget({ isOpen, onClose }: AIChatWidgetProps) {
  const { user } = useAuth();
  const {
    isRecording, isProcessing: isVoiceProcessing,
    partialText, lastResponse, isSupported: isVoiceSupported,
    startRecording, stopRecording, clearResponse,
  } = useVoice();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; type?: string } | null>(null);

  // ── Conversation persistence ──────────────────────────────────────────────
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("New Chat");
  const [isSaving, setIsSaving] = useState(false);

  // ── History dropdown ──────────────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [recentChats, setRecentChats] = useState<SavedConversation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // ── Debounced persistence ─────────────────────────────────────────────────
  const debouncedMessages = useDebounce(messages, 2000);

  const persistConversation = useCallback(
    async (msgs: Message[], cId: string, title: string) => {
      // Don't persist while a message is still streaming
      if (!user || msgs.length === 0 || msgs.some(m => m.isStreaming)) return;
      try {
        setIsSaving(true);
        await firestoreService.saveConversation(user.uid, cId, {
          title,
          messages: msgs.map(m => ({
            id: m.id, role: m.role, content: m.content,
            timestamp: m.timestamp.toISOString(),
            toolsUsed: m.toolsUsed ?? [],
          })),
        });
      } catch (err) {
        console.error("[ChatWidget] Failed to persist:", err);
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

  // ── New conversation ──────────────────────────────────────────────────────
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setInput("");
    setConversationId(generateId() + generateId());
    setConversationTitle("New Chat");
    setShowHistory(false);
  }, []);

  useEffect(() => {
    if (isOpen && !conversationId) startNewConversation();
  }, [isOpen, conversationId, startNewConversation]);

  // Auto-title from first message
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === "user" && conversationTitle === "New Chat") {
      const t = messages[0].content;
      setConversationTitle(t.length > 50 ? t.slice(0, 47) + "…" : t);
    }
  }, [messages, conversationTitle]);

  // ── History dropdown ──────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const chats = await firestoreService.getConversations(user.uid, 10);
      setRecentChats(chats.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })));
    } catch (err) {
      console.error("[ChatWidget] Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  const handleToggleHistory = useCallback(() => {
    if (!showHistory) loadHistory();
    setShowHistory(v => !v);
  }, [showHistory, loadHistory]);

  // Load a past conversation into the widget
  const loadConversation = useCallback(async (chatId: string) => {
    if (!user) return;
    try {
      const conv = await firestoreService.getConversationById(chatId, user.uid);
      if (!conv) return;
      setMessages(
        (conv.messages as any[]).map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
          isStreaming: false,
        }))
      );
      setConversationId(conv.id);
      setConversationTitle(conv.title);
      setShowHistory(false);
    } catch (err) {
      console.error("[ChatWidget] Failed to load conversation:", err);
    }
  }, [user]);

  // Close history on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHistory]);

  // ── Voice ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) setInput(partialText || "Listening...");
  }, [isRecording, partialText]);

  useEffect(() => {
    if (!lastResponse) return;
    const userMsgId = generateId();
    const aiMsgId = generateId();

    if (lastResponse.intent === "QUERY" && lastResponse.answer) {
      setMessages(prev => [
        ...prev,
        { id: userMsgId, role: "user", content: input || "Voice query", timestamp: new Date() },
        { id: aiMsgId, role: "assistant", content: lastResponse.answer!, timestamp: new Date() },
      ]);
      setInput("");
      clearResponse();
    } else if (["NAVIGATE", "SEARCH_PRODUCT", "CREATE_INVOICE", "VIEW_REPORT"].includes(lastResponse.intent)) {
      const text =
        lastResponse.intent === "NAVIGATE" ? `Navigating to ${lastResponse.target_screen ?? "page"}...` :
        lastResponse.intent === "SEARCH_PRODUCT" ? `Searching for "${lastResponse.search_query}"...` :
        lastResponse.intent === "CREATE_INVOICE" ? `Creating invoice for ${lastResponse.customer_name ?? "customer"}...` :
        `Opening report...`;
      setMessages(prev => [
        ...prev,
        { id: userMsgId, role: "user", content: input || "Voice command", timestamp: new Date() },
        { id: aiMsgId, role: "assistant", content: text, timestamp: new Date() },
      ]);
      setInput("");
      clearResponse();
    }
  }, [lastResponse, clearResponse]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // ── Send message (SSE streaming) ──────────────────────────────────────────
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMessage: Message = { id: generateId(), role: "user", content: text, timestamp: new Date() };
    const streamingMsgId = generateId();

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    // Add an empty streaming placeholder for the AI reply
    setMessages(prev => [
      ...prev,
      { id: streamingMsgId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.uid || "" },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      // Non-200 → the server returned a JSON error before streaming started
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `Request failed (${response.status})`);
      }

      // ── Read SSE stream ─────────────────────────────────────────────────
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let finalToolsUsed: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newline
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? ""; // Keep incomplete chunk in buffer

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;

          let event: any;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue; // Malformed chunk — skip
          }

          if (event.token) {
            fullContent += event.token;
            // Update the streaming message in place
            setMessages(prev =>
              prev.map(m => m.id === streamingMsgId ? { ...m, content: fullContent } : m)
            );
          }

          if (event.done) {
            finalToolsUsed = event.toolsUsed ?? [];
            // Finalise: mark as no longer streaming
            setMessages(prev =>
              prev.map(m =>
                m.id === streamingMsgId
                  ? { ...m, content: fullContent, isStreaming: false, toolsUsed: finalToolsUsed }
                  : m
              )
            );
          }

          if (event.error) {
            throw new Error(event.error);
          }
        }
      }
    } catch (err: any) {
      console.error("[ChatWidget] sendMessage error:", err);

      // Remove the empty streaming placeholder on error
      setMessages(prev => prev.filter(m => m.id !== streamingMsgId));

      let errorMsg = err.message || "Something went wrong. Please try again.";
      let type = "general";
      if (errorMsg.toLowerCase().includes("api key") || errorMsg.includes("API_KEY")) type = "api_key";
      else if (errorMsg.includes("RATE_LIMIT") || errorMsg.includes("quota") || errorMsg.includes("429")) {
        errorMsg = "Rate limit exceeded. Please wait a moment and try again.";
        type = "rate_limit";
      }
      setError({ message: errorMsg, type });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, user]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const suggestedPrompts = [
    "What products are low on stock?",
    "Show me this month's revenue",
    "Who owes me money?",
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] md:w-[660px] h-[720px] max-h-[88vh] shadow-2xl rounded-2xl border border-neutral-200 bg-white flex flex-col transition-all duration-300 transform ${
        isOpen ? "-translate-y-1/2 scale-100 opacity-100" : "-translate-y-[45%] scale-95 opacity-0 pointer-events-none"
      }`}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-neutral-50 rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 bg-black rounded-lg flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">Invento Assistant</h3>
              <p className="text-[11px] text-green-600 flex items-center gap-1">
                <span className="block h-1.5 w-1.5 rounded-full bg-green-500" />
                {isSaving ? "Saving…" : "Online"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 relative" ref={historyRef}>
            {/* History dropdown trigger */}
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-neutral-500 hover:text-black"
              title="Recent conversations"
              onClick={handleToggleHistory}
            >
              <History className="h-4 w-4" />
            </Button>

            {/* History dropdown panel */}
            {showHistory && (
              <div className="absolute top-9 right-8 w-64 bg-white border border-neutral-200 rounded-xl shadow-lg z-10 overflow-hidden">
                <div className="px-3 py-2 border-b bg-neutral-50">
                  <p className="text-xs font-medium text-neutral-600">Recent Conversations</p>
                </div>
                {loadingHistory ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                  </div>
                ) : recentChats.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4 px-3">No saved conversations yet.</p>
                ) : (
                  <ul className="max-h-52 overflow-y-auto">
                    {recentChats.map(chat => (
                      <li key={chat.id}>
                        <button
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 text-left transition-colors group"
                          onClick={() => loadConversation(chat.id)}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <Clock className="h-3 w-3 text-neutral-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-neutral-800 truncate">{chat.title}</p>
                              <p className="text-[10px] text-neutral-400">{formatRelativeTime(chat.updatedAt)}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-3 w-3 text-neutral-300 group-hover:text-neutral-500 shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-neutral-500 hover:text-black"
              title="New conversation"
              onClick={startNewConversation}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-neutral-500 hover:text-black"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Messages ───────────────────────────────────────────────────── */}
        <div className="flex-1 px-4 py-4 overflow-y-auto bg-white/50">
          <div className="space-y-4">
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-4">
                <div className="h-16 w-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="h-8 w-8 text-neutral-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">How can I help you today?</h4>
                  <p className="text-xs text-neutral-500 max-w-[240px] mx-auto">
                    I can check your inventory, create invoices, and analyse your business performance.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  {suggestedPrompts.map((p, i) => (
                    <Button
                      key={i} variant="outline" size="sm"
                      className="text-xs w-full justify-start h-auto py-2 px-3 text-neutral-600 hover:text-black hover:border-black/40"
                      onClick={() => sendMessage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[88%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} items-start gap-2`}>
                  {msg.role === "assistant" && (
                    <Avatar className="h-8 w-8 mt-0.5 border shrink-0">
                      <AvatarImage src="/bot-avatar.png" />
                      <AvatarFallback className="bg-neutral-100 text-neutral-500">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className="min-w-0">
                    {msg.role === "user" ? (
                      // User messages: plain text, no markdown
                      <div className="p-3 rounded-2xl rounded-tr-sm text-sm bg-black text-white">
                        {msg.content}
                      </div>
                    ) : (
                      // AI messages: full markdown rendering
                      <div className="p-3 rounded-2xl rounded-tl-sm text-sm bg-neutral-100 text-neutral-800">
                        {msg.content ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={mdComponents as any}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : null}

                      </div>
                    )}

                    {/* Tool usage badges */}
                    {msg.role === "assistant" && !msg.isStreaming && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {msg.toolsUsed.map((tool, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-[10px] bg-blue-50 text-blue-700 border-blue-100 px-2 py-0.5 h-5 font-normal flex items-center gap-1"
                          >
                            <Wrench className="h-2.5 w-2.5" />
                            {tool.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator — only shown before first streaming token arrives */}
            {loading && messages[messages.length - 1]?.isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="flex items-start gap-2">
                  <Avatar className="h-8 w-8 mt-0.5 border shrink-0">
                    <AvatarFallback className="bg-neutral-100 text-neutral-500">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-neutral-100 p-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <Alert variant="destructive" className="my-2 border-red-200 bg-red-50 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="ml-2 text-sm font-semibold">Error</AlertTitle>
                <AlertDescription className="ml-2 text-xs mt-1">
                  {error.message}
                  {error.type === "api_key" && (
                    <div className="mt-1.5">
                      <Link href="/settings/api-keys" className="underline font-medium hover:text-red-950" onClick={onClose}>
                        Go to Settings →
                      </Link>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input ──────────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t bg-white rounded-b-2xl">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Listening..." : "Ask anything…"}
                className="min-h-[44px] pr-10 rounded-xl bg-neutral-50 border-neutral-200 focus:bg-white"
                disabled={loading || isRecording}
              />
              <Button
                variant="ghost" size="icon"
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full ${
                  isRecording
                    ? "text-red-500 bg-red-50 animate-pulse"
                    : "text-neutral-400 hover:text-black hover:bg-neutral-100"
                }`}
                onClick={() => {
                  if (!isVoiceSupported) return;
                  isRecording ? stopRecording() : startRecording();
                }}
                disabled={isVoiceProcessing || !isVoiceSupported}
                title={
                  !isVoiceSupported ? "Voice requires Chrome or Edge"
                  : isRecording ? "Stop listening"
                  : "Speak a command"
                }
              >
                {isRecording ? <Square className="h-4 w-4 fill-current" /> : !isVoiceSupported ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              onClick={() => sendMessage()}
              className="h-11 w-11 shrink-0 rounded-xl"
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
