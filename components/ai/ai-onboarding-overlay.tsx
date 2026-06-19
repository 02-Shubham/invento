"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { firestoreService } from "@/lib/firestore-service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bot, Sparkles, Upload, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";

export default function AIOnboardingOverlay() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const userId = user.uid;

    async function checkOnboarding() {
      try {
        const settings = await firestoreService.getUserSettings(userId) as any;
        if (settings?.onboardingDismissed) {
          setOpen(false);
          return;
        }

        const [products, customers] = await Promise.all([
          firestoreService.getProducts(userId),
          firestoreService.getCustomers(userId),
        ]);

        if (products.length === 0 && customers.length === 0) {
          setOpen(true);
        }
      } catch (err) {
        console.error("[AIOnboardingOverlay] Check failed:", err);
      } finally {
        setLoading(false);
      }
    }

    checkOnboarding();
  }, [user]);

  const handleDismiss = async () => {
    if (!user) return;
    try {
      await firestoreService.updateUserSettings(user.uid, { onboardingDismissed: true });
      setOpen(false);
      toast.success("Onboarding skipped. You can always access AI help anytime.");
    } catch (err) {
      console.error("[AIOnboardingOverlay] Failed to dismiss:", err);
    }
  };

  const handleAddProduct = () => {
    setOpen(false);
    router.push("/inventory");
  };

  const handleImportCSV = () => {
    toast.info("CSV Import is coming soon! You can add products manually in the Inventory section.");
  };

  if (loading || !open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleDismiss(); }}>
      <DialogContent className="sm:max-w-[480px] p-6 rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 bg-neutral-900 rounded-2xl flex items-center justify-center shadow-md animate-bounce">
            <Bot className="h-9 w-9 text-white" />
          </div>
          
          <div className="space-y-1.5">
            <DialogTitle className="text-xl font-bold text-neutral-900 flex items-center justify-center gap-1.5">
              Welcome to Invento AI <Sparkles className="h-5 w-5 text-indigo-500 fill-indigo-200" />
            </DialogTitle>
            <DialogDescription className="text-neutral-500 text-sm max-w-[400px]">
              Hi there! I am your AI Business Assistant. Let's get your store set up so we can start managing inventory, invoices, and analytics together.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            onClick={handleAddProduct}
            className="w-full h-12 bg-black text-white hover:bg-neutral-800 rounded-xl font-semibold flex items-center justify-between px-5 transition-all group"
          >
            <span className="flex items-center gap-2">
              Add Your First Product
            </span>
            <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Button
            onClick={handleImportCSV}
            variant="outline"
            className="w-full h-12 border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 rounded-xl font-semibold flex items-center justify-between px-5 transition-all text-neutral-700"
          >
            <span className="flex items-center gap-2">
              Import CSV
            </span>
            <Upload className="h-4.5 w-4.5 text-neutral-400" />
          </Button>
        </div>

        <div className="mt-5 flex justify-center">
          <button
            onClick={handleDismiss}
            className="text-xs text-neutral-400 hover:text-black font-medium transition-colors underline"
          >
            Skip for now, show dashboard
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
