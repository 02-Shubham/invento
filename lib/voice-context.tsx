"use client";

// (kt) VoiceContext — Core voice engine for Invento.ai
// Wraps the Web Speech API (SpeechRecognition) for STT.
// Calls /api/ai/voice for LLM intent extraction (uses the user's
// existing OpenAI/Gemini key from their settings — no new API key needed).
// Exposes: startRecording, stopRecording, isRecording, isProcessing,
//          partialText, lastResponse, clearResponse via useVoice() hook.
// Consumed by: VoiceFAB (UI), inventory/page.tsx, invoices/page.tsx

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoiceIntent =
  | "NAVIGATE"
  | "SEARCH_PRODUCT"
  | "CREATE_INVOICE"
  | "VIEW_REPORT"
  | "QUERY"
  | "UNKNOWN";

export interface VoiceActionPayload {
  // Core control
  intent: VoiceIntent;
  is_complete: boolean;
  missing_fields: string[];
  reply_prompt?: string;

  // Navigation
  target_screen?: string; // 'dashboard' | 'inventory' | 'invoices' | 'customers' | 'payments' | 'purchase' | 'settings'

  // Search / Product
  search_query?: string;
  product_name?: string;

  // Invoice
  customer_name?: string;
  invoice_items?: string;

  // Report
  report_type?: string; // 'revenue' | 'inventory' | 'customers'
  report_period?: string;

  // General query answer (shown in FAB bubble)
  answer?: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface VoiceContextType {
  isRecording: boolean;
  isProcessing: boolean;
  partialText: string;
  lastResponse: VoiceActionPayload | null;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  clearResponse: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Words that indicate the user is still thinking — extend the silence timer
const CRUTCH_WORDS = [
  "um", "uh", "hmm", "ah", "wait", "so", "like", "you know",
];

const SILENCE_DELAY_MS = 3000;       // Normal silence → stop
const CRUTCH_SILENCE_DELAY_MS = 5000; // Hesitation → wait longer

// Route map: LLM target_screen value → Next.js URL path
const SCREEN_ROUTE_MAP: Record<string, string> = {
  dashboard:  "/dashboard",
  inventory:  "/inventory",
  invoices:   "/invoices",
  customers:  "/customers",
  payments:   "/payments",
  purchase:   "/purchase",
  settings:   "/settings",
};

// ── Context ───────────────────────────────────────────────────────────────────

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  // Web Speech API ref — initialised lazily on first use
  // Typed as `any` because SpeechRecognition is not in the default TS lib;
  // runtime safety is guaranteed by the isSupported check in startRecording().
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Multi-turn conversation history (cleared after a complete action)
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);

  // State exposed to consumers
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [partialText, setPartialText] = useState("");
  const [lastResponse, setLastResponse] = useState<VoiceActionPayload | null>(null);

  // Browser support check
  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // ── Silence timer helpers ──────────────────────────────────────────────────

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(
    (text: string, stopFn: () => void) => {
      clearSilenceTimer();
      const lastWord = text.trim().split(" ").pop()?.toLowerCase() ?? "";
      const isCrutch = CRUTCH_WORDS.some((c) => lastWord.includes(c));
      const delay = isCrutch ? CRUTCH_SILENCE_DELAY_MS : SILENCE_DELAY_MS;
      silenceTimerRef.current = setTimeout(stopFn, delay);
    },
    [clearSilenceTimer]
  );

  // ── Stop recording ─────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
    // onend handler will call handleProcessCommand
  }, [clearSilenceTimer]);

  // ── Action execution ───────────────────────────────────────────────────────
  // Defined BEFORE handleProcessCommand so it can be referenced in its deps array.

  const executeAction = useCallback(
    (action: VoiceActionPayload) => {
      switch (action.intent) {
        case "NAVIGATE": {
          const screen = action.target_screen?.toLowerCase() ?? "";
          const route = SCREEN_ROUTE_MAP[screen];
          if (route) {
            router.push(route);
          } else {
            toast.info(`Not sure where "${action.target_screen}" is. Try saying a screen name.`);
          }
          break;
        }

        case "SEARCH_PRODUCT": {
          // Navigate to inventory; the page reads lastResponse to prefill search
          router.push("/inventory");
          break;
        }

        case "CREATE_INVOICE": {
          // Navigate to new invoice; page reads lastResponse to prefill customer
          router.push("/invoices/new");
          break;
        }

        case "VIEW_REPORT": {
          router.push("/dashboard");
          toast.info(`Showing ${action.report_type ?? "your"} report for ${action.report_period ?? "recent period"}.`);
          break;
        }

        case "QUERY":
          // Answer shown in FAB bubble via lastResponse.answer — no nav needed
          break;

        default:
          toast.info("I didn't understand that. Try again or rephrase your command.");
          break;
      }
    },
    [router]
  );

  // ── LLM call ──────────────────────────────────────────────────────────────

  const handleProcessCommand = useCallback(
    async (text: string) => {
      if (!text.trim() || !user) return;

      setIsProcessing(true);
      setPartialText("");

      try {
        const response = await fetch("/api/ai/voice", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.uid,
          },
          body: JSON.stringify({
            text,
            conversationHistory: conversationHistoryRef.current,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Voice command failed");
        }

        const action: VoiceActionPayload = data.action;
        setLastResponse(action);

        if (!action.is_complete || action.missing_fields?.length > 0) {
          // Multi-turn: save history and wait for next turn
          conversationHistoryRef.current = [
            ...conversationHistoryRef.current,
            { role: "user", content: text },
            { role: "assistant", content: JSON.stringify(action) },
          ];
        } else {
          // Complete: execute action, clear history
          conversationHistoryRef.current = [];
          executeAction(action);
        }
      } catch (err: any) {
        console.error("[VoiceContext] Error:", err);
        if (err.message?.includes("API key") || err.message?.includes("SETTINGS_NOT_FOUND")) {
          toast.error("Configure your AI API key in Settings to use voice commands.", {
            action: { label: "Settings", onClick: () => router.push("/settings") },
          });
        } else {
          toast.error("Voice command failed. Please try again.");
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [user, router, executeAction]
  );

  // ── Start recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    if (!isSupported) {
      toast.error("Your browser doesn't support voice commands. Please use Chrome or Edge.");
      return;
    }
    if (isRecording) return;

    // Reset state
    setPartialText("");
    setLastResponse(null);

    // Initialise SpeechRecognition
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition: any = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;

    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      const current = (finalText || interim).trim();
      if (current) {
        setPartialText(current);
        armSilenceTimer(current, stopRecording);
      }
    };

    recognition.onerror = (event: any) => {
      // 'no-speech' is benign — user just didn't say anything
      if (event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please allow microphone in your browser settings.");
      } else {
        console.warn("[VoiceContext] SpeechRecognition error:", event.error);
      }
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsRecording(false);
      // Capture final text from state via a ref trick
      // We read partialText from the DOM ref pattern instead
      setPartialText((prev) => {
        if (prev.trim()) {
          handleProcessCommand(prev.trim());
        }
        return prev;
      });
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("[VoiceContext] Failed to start recognition:", err);
      toast.error("Could not start voice recognition. Please try again.");
    }
  }, [isSupported, isRecording, armSilenceTimer, stopRecording, clearSilenceTimer, handleProcessCommand]);

  // ── clearResponse ──────────────────────────────────────────────────────────

  const clearResponse = useCallback(() => {
    setLastResponse(null);
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        isRecording,
        isProcessing,
        partialText,
        lastResponse,
        isSupported,
        startRecording,
        stopRecording,
        clearResponse,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextType {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within a VoiceProvider");
  return ctx;
}
