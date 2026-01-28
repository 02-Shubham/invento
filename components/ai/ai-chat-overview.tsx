"use client";

import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { useState } from "react";
import AIChatWidget from "./ai-chat-widget";

export default function AIChatOverview() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
        <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg bg-black hover:bg-neutral-800 text-white relative group"
        >
          <Bot className="h-6 w-6" />
          
          {/* Badge */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
          </span>
          
          {/* Tooltip on hover (simple) */}
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-white text-black text-xs font-medium rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border pointer-events-none">
              Ask AI Assistant
          </span>
        </Button>
      </div>

      <AIChatWidget isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
