"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Status {
  configured: boolean;
  linked: boolean;
  phone: string | null;
  businessNumber: string | null;
}

export default function WhatsAppSettingsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(
    async (method: "GET" | "POST" | "DELETE") => {
      const token = await user?.getIdToken();
      const res = await fetch("/api/whatsapp/link", { method, headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    [user]
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    const data = await call("GET");
    if (data.success) setStatus(data);
  }, [user, call]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // While a code is showing, poll so the page flips to "connected" once the user sends it
  useEffect(() => {
    if (!code || status?.linked) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [code, status?.linked, refresh]);

  const connect = async () => {
    setBusy(true);
    try {
      const data = await call("POST");
      if (!data.success) throw new Error(data.error);
      setCode(data.code);
    } catch (e: any) {
      toast.error(e.message || "Could not create a code");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await call("DELETE");
      setCode(null);
      await refresh();
      toast.success("WhatsApp disconnected");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> WhatsApp assistant
        </CardTitle>
        <CardDescription>
          Chat with your business assistant on WhatsApp. Anything that changes data still needs your Approve tap.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !status.configured ? (
          <p className="text-sm text-muted-foreground">WhatsApp isn't set up on this server yet.</p>
        ) : status.linked ? (
          <div className="space-y-3">
            <p className="text-sm">
              Connected to <span className="font-medium">{status.phone}</span>.
            </p>
            <Button variant="outline" onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
          </div>
        ) : code ? (
          <div className="space-y-3">
            <p className="text-sm">
              From the phone you want to link, send this code{status.businessNumber ? <> to <span className="font-medium">{status.businessNumber}</span></> : " to the business WhatsApp number"}. It expires in 10 minutes.
            </p>
            <div className="text-3xl font-mono font-bold tracking-widest">{code}</div>
          </div>
        ) : (
          <Button onClick={connect} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Connect WhatsApp
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
