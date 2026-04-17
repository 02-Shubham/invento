"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopNavbar } from "@/components/layout/TopNavbar";
import AIChatOverview from "@/components/ai/ai-chat-overview";
import { VoiceProvider } from "@/lib/voice-context";
import VoiceFAB from "@/components/ai/voice-fab";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

          {/* AI Chat FAB (text) — sits at bottom-right */}
          <AIChatOverview />

          {/* Voice FAB (mic) — stacked above the chat FAB */}
          <VoiceFAB />
        </div>
      </VoiceProvider>
    </ProtectedRoute>
  );
}
