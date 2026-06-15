"use client";

import { Button } from "@/components/ui/button";
import { Bot, Mic, MicOff } from "lucide-react";
import { useState } from "react";
import AIChatWidget from "./ai-chat-widget";
import { useVoice } from "@/lib/voice-context";

export default function AIChatOverview() {
  const [isOpen, setIsOpen] = useState(false);
  const { isSupported: isVoiceSupported, startRecording } = useVoice();

  const handleMicClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
    setTimeout(() => {
      startRecording();
    }, 200);
  };

  return (
    <>
      {/* Universal Floating Input Pill (sits at bottom-right corner) */}
      <div 
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
      >
        <div 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 bg-white border border-neutral-200 hover:border-neutral-300 shadow-xl rounded-full px-4 py-2 w-80 h-13 cursor-pointer group transition-all"
        >
          <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white shrink-0">
            <Bot className="h-4.5 w-4.5" />
          </div>
          
          <span className="flex-1 text-sm text-neutral-400 select-none">
            Ask Invento AI...
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleMicClick}
            className="h-8 w-8 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 shrink-0"
            title={isVoiceSupported ? "Talk to Invento" : "Voice commands not supported"}
          >
            {isVoiceSupported ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AIChatWidget isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

