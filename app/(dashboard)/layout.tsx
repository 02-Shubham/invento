"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { useState, useRef } from "react";
import AIChatOverview from "@/components/ai/ai-chat-overview";
import AIChatWidget from "@/components/ai/ai-chat-widget";
import VoiceFAB from "@/components/ai/voice-fab";
import AIOnboardingOverlay from "@/components/ai/ai-onboarding-overlay";
import { VoiceProvider } from "@/lib/voice-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const chatWidgetRef = useRef<{ sendExternalMessage: (text: string) => void }>(null);

  return (
    <ProtectedRoute>
      {/* VoiceProvider scopes voice state to the authenticated dashboard only */}
      <VoiceProvider>
        <div className="flex h-screen overflow-hidden bg-gray-50">
          {/* Sidebar for Desktop */}
          <div className="hidden md:flex w-72 flex-col fixed inset-y-0 z-50">
            <AppSidebar />
          </div>

          <div className="flex flex-col flex-1 w-full md:pl-72">
            <TopNavbar />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              {children}
            </main>
          </div>

          {/* AI Onboarding assistant overlay */}
          <AIOnboardingOverlay />

          {/* AI Chat Widget */}
          <AIChatWidget ref={chatWidgetRef} isOpen={chatOpen} onClose={() => setChatOpen(false)} />

          {/* Universal Floating Input Pill (trigger) */}
          <AIChatOverview isOpen={chatOpen} setIsOpen={setChatOpen} />

          {/* VoiceFAB overlay at bottom-right */}
          <VoiceFAB onTranscriptReady={(text) => {
            setChatOpen(true);
            setTimeout(() => {
              chatWidgetRef.current?.sendExternalMessage(text);
            }, 300);
          }} />
        </div>
      </VoiceProvider>
    </ProtectedRoute>
  );
}
