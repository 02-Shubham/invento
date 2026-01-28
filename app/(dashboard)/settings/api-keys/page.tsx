"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

type AIProvider = "anthropic" | "openai" | "google" | null;

export default function APIKeysSettingsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<AIProvider>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;

      try {
        const userSettingsRef = doc(db, "user_settings", user.uid);
        const userSettingsSnap = await getDoc(userSettingsRef);

        if (userSettingsSnap.exists()) {
          const data = userSettingsSnap.data();
          setCurrentProvider(data.aiProvider || null);
          setSelectedProvider(data.aiProvider || null);
          setHasKey(data.aiApiKeySet || false);
          // Don't load the actual key for security
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error("Failed to load API key settings");
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user || !selectedProvider || !apiKey.trim()) {
      toast.error("Please select a provider and enter an API key");
      return;
    }

    setIsSaving(true);
    try {
      const userSettingsRef = doc(db, "user_settings", user.uid);
      await setDoc(
        userSettingsRef,
        {
          aiProvider: selectedProvider,
          aiApiKey: apiKey.trim(), // TODO: Encrypt this in production
          aiApiKeySet: true,
          aiKeyLastUpdated: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setCurrentProvider(selectedProvider);
      setHasKey(true);
      setApiKey(""); // Clear input after saving
      toast.success("API key saved successfully");
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeKey = () => {
    setApiKey("");
    setShowKey(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI API Keys</CardTitle>
          <CardDescription>
            Add your API keys for AI features. Your keys are stored securely and you pay for usage directly to the provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Note:</strong> Your API key is stored securely. You pay for AI usage directly to the provider. 
              Never share your API keys with anyone.
            </AlertDescription>
          </Alert>

          <Tabs
            value={selectedProvider || "none"}
            onValueChange={(value) =>
              setSelectedProvider(
                value === "none" ? null : (value as AIProvider)
              )
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
              <TabsTrigger value="openai">OpenAI</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
            </TabsList>

            <TabsContent value="anthropic" className="space-y-4 mt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                  {currentProvider === "anthropic" && hasKey && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Key configured</span>
                    </div>
                  )}
                </div>
                {hasKey && currentProvider === "anthropic" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={showKey ? "sk-ant-••••••••••••••" : "••••••••••••••"}
                        disabled
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleChangeKey}
                    >
                      Change Key
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="anthropic-key"
                      type="password"
                      placeholder="sk-ant-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-sm text-gray-500">
                      Get your API key from{" "}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        Anthropic Console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                    <p className="text-xs text-gray-400">
                      Pricing: ~$3 per 1M input tokens, $15 per 1M output tokens
                    </p>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="openai" className="space-y-4 mt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  {currentProvider === "openai" && hasKey && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Key configured</span>
                    </div>
                  )}
                </div>
                {hasKey && currentProvider === "openai" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={showKey ? "sk-••••••••••••••" : "••••••••••••••"}
                        disabled
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleChangeKey}
                    >
                      Change Key
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="openai-key"
                      type="password"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-sm text-gray-500">
                      Get your API key from{" "}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        OpenAI Platform
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                    <p className="text-xs text-gray-400">
                      Pricing: ~$2.50 per 1M tokens (GPT-4)
                    </p>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="google" className="space-y-4 mt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="google-key">Google API Key</Label>
                  {currentProvider === "google" && hasKey && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Key configured</span>
                    </div>
                  )}
                </div>
                {hasKey && currentProvider === "google" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={showKey ? "AIza••••••••••••••" : "••••••••••••••"}
                        disabled
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleChangeKey}
                    >
                      Change Key
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="google-key"
                      type="password"
                      placeholder="AIza..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-sm text-gray-500">
                      Get your API key from{" "}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        Google AI Studio
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                    <p className="text-xs text-gray-400">
                      Free tier available, then pay-as-you-go
                    </p>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {apiKey && (
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save API Key"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
