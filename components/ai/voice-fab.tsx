"use client";

// (kt) VoiceFAB — Floating microphone button for voice commands
// Visual states: idle | recording | processing | replied (incomplete) | replied (complete)
// Shows a speech bubble above the FAB with:
//   - Live partial transcript while recording
//   - Follow-up question (reply_prompt) when AI needs more info
//   - Success/answer message when action completes
// Auto-hides the success bubble after 5 seconds.

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Check, MicOff } from "lucide-react";
import { useVoice } from "@/lib/voice-context";
import { Button } from "@/components/ui/button";

type FABState = "idle" | "recording" | "processing" | "replied_incomplete" | "replied_complete";

interface VoiceFABProps {
  onTranscriptReady?: (text: string) => void;
}

export default function VoiceFAB({ onTranscriptReady }: VoiceFABProps) {
  const {
    isRecording,
    isProcessing,
    partialText,
    lastResponse,
    isSupported,
    startRecording,
    stopRecording,
    clearResponse,
  } = useVoice();

  const [fabState, setFabState] = useState<FABState>("idle");
  const [bubbleText, setBubbleText] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef("");

  useEffect(() => {
    if (isRecording && partialText) {
      lastTranscriptRef.current = partialText;
    }
  }, [isRecording, partialText]);

  // ── Sync FAB state with context ──────────────────────────────────────────

  useEffect(() => {
    if (isRecording) {
      setFabState("recording");
      setShowBubble(true);
      setBubbleText(partialText || "Listening…");
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    }
  }, [isRecording, partialText]);

  useEffect(() => {
    if (isProcessing) {
      setFabState("processing");
      setShowBubble(false);
    }
  }, [isProcessing]);

  useEffect(() => {
    if (!lastResponse) return;

    // Conversational queries route to the unified chat widget
    if (lastResponse.intent === "QUERY" || lastResponse.intent === "UNKNOWN") {
      if (onTranscriptReady && lastTranscriptRef.current) {
        onTranscriptReady(lastTranscriptRef.current);
        clearResponse();
        setShowBubble(false);
        setFabState("idle");
        return;
      }
    }

    if (!lastResponse.is_complete || (lastResponse.missing_fields?.length ?? 0) > 0) {
      // Multi-turn: show the follow-up question
      setFabState("replied_incomplete");
      setBubbleText(lastResponse.reply_prompt ?? "Could you give me more details?");
      setShowBubble(true);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      // Auto-dismiss after 10 s if user doesn't respond
      autoDismissRef.current = setTimeout(() => {
        setShowBubble(false);
        clearResponse();
        setFabState("idle");
      }, 10000);
    } else {
      // Complete — show success or answer
      setFabState("replied_complete");
      const text =
        lastResponse.answer ??
        (lastResponse.intent === "NAVIGATE"
          ? `Navigating to ${lastResponse.target_screen ?? "page"}…`
          : lastResponse.intent === "SEARCH_PRODUCT"
          ? `Searching for "${lastResponse.search_query}"…`
          : lastResponse.intent === "CREATE_INVOICE"
          ? `Opening invoice for ${lastResponse.customer_name ?? "customer"}…`
          : lastResponse.intent === "VIEW_REPORT"
          ? `Opening ${lastResponse.report_type ?? ""} report…`
          : "Done!");
      setBubbleText(text);
      setShowBubble(true);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      autoDismissRef.current = setTimeout(() => {
        setShowBubble(false);
        clearResponse();
        setFabState("idle");
      }, 5000);
    }
  }, [lastResponse, clearResponse]);

  // ── Animate in on mount ──────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 300);
    return () => {
      clearTimeout(t);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePress = () => {
    if (!isSupported) return;
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  };

  // ── Derived visual properties ─────────────────────────────────────────────

  const fabColors: Record<FABState, string> = {
    idle:               "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-200",
    recording:          "bg-rose-500 hover:bg-rose-400 shadow-rose-200",
    processing:         "bg-indigo-600 shadow-indigo-200",
    replied_incomplete: "bg-amber-500 hover:bg-amber-400 shadow-amber-200",
    replied_complete:   "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-200",
  };

  const FabIcon = () => {
    if (fabState === "recording") return <Square className="h-5 w-5 fill-white text-white" />;
    if (fabState === "processing") return <Loader2 className="h-5 w-5 animate-spin" />;
    if (fabState === "replied_complete") return <Check className="h-5 w-5" />;
    if (!isSupported) return <MicOff className="h-5 w-5" />;
    return <Mic className="h-5 w-5" />;
  };

  return (
    <div
      className={`fixed bottom-[5.5rem] right-6 z-50 flex flex-col items-end gap-2 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {/* ── Speech Bubble ─────────────────────────────────────────────────── */}
      <div
        className={`relative max-w-[220px] transition-all duration-300 ${
          showBubble && bubbleText
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-1 pointer-events-none"
        }`}
      >
        <div
          className={`px-3.5 py-2.5 rounded-2xl rounded-br-sm text-xs font-medium leading-snug shadow-lg text-white ${
            fabState === "recording"
              ? "bg-rose-500"
              : fabState === "replied_incomplete"
              ? "bg-amber-500"
              : fabState === "replied_complete"
              ? "bg-emerald-500"
              : "bg-indigo-600"
          }`}
        >
          {bubbleText}
        </div>
        {/* Caret */}
        <div
          className={`absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 ${
            fabState === "recording"
              ? "bg-rose-500"
              : fabState === "replied_incomplete"
              ? "bg-amber-500"
              : fabState === "replied_complete"
              ? "bg-emerald-500"
              : "bg-indigo-600"
          }`}
        />
      </div>

      {/* ── Pulse Ring (recording state) ──────────────────────────────────── */}
      <div className="relative">
        {fabState === "recording" && (
          <>
            <span className="absolute inset-0 rounded-full bg-rose-400 opacity-30 animate-ping" />
            <span className="absolute -inset-2 rounded-full bg-rose-300 opacity-20 animate-ping [animation-delay:0.3s]" />
          </>
        )}

        {/* ── Main FAB button ────────────────────────────────────────────── */}
        <Button
          id="voice-fab-button"
          onClick={handlePress}
          disabled={isProcessing || !isSupported}
          title={
            !isSupported
              ? "Voice commands require Chrome or Edge"
              : isRecording
              ? "Tap to stop recording"
              : "Tap to speak a command"
          }
          className={`relative h-12 w-12 rounded-full shadow-lg text-white border-0 transition-all duration-200 ${
            fabState === "recording" ? "scale-110" : "scale-100"
          } ${fabColors[fabState]} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <FabIcon />
        </Button>
      </div>

      {/* ── Tooltip label (idle state only) ───────────────────────────────── */}
      {fabState === "idle" && (
        <span className="text-[10px] text-center text-indigo-600 font-medium tracking-wide select-none">
          Voice
        </span>
      )}
    </div>
  );
}
