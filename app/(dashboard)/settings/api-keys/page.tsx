"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { firestoreService } from "@/lib/firestore-service";
import { UserSettings } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Key, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ApiKeysPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "google">("openai");
  const [isKeySet, setIsKeySet] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        setLoading(true);
        const settings = await firestoreService.getUserSettings(user.uid) as UserSettings;
        if (settings) {
          if (settings.aiProvider) setProvider(settings.aiProvider);
          if (settings.aiApiKeySet) setIsKeySet(true);
          if (settings.aiKeyLastUpdated) {
            // Handle Timestamp conversion if coming from firestore raw
            const date = settings.aiKeyLastUpdated instanceof Date 
                ? settings.aiKeyLastUpdated 
                : (settings.aiKeyLastUpdated as any).toDate();
            setLastUpdated(date);
          }
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    
    // Trim input
    const cleanApiKey = apiKey.trim();

    if (provider === 'openai') {
        // If key is set (masked) and user didn't change it (apiKey is empty), nothing to save unless provider changed?
        // Actually if they switch provider they might need to re-enter key if not saved.
        // Simplified: If switching to OpenAI and no key is set, require valid key.
        if (!isKeySet && !cleanApiKey) {
             toast.error("Please enter an OpenAI API key");
             return;
        }
        
        if (cleanApiKey && !cleanApiKey.startsWith('sk-')) {
             toast.error("Invalid OpenAI API key format (should start with sk-)");
             return;
        }
    }

    setSaving(true);
    try {
      const updateData: any = {
        aiProvider: provider,
        aiKeyLastUpdated: new Date(),
        // Default models
        aiModel: provider === 'openai' ? 'gpt-4-turbo' : 'gemini-2.5-flash'
      };

      // Only update API key if provided (or if switching to OpenAI and providing one)
      if (provider === 'openai' && cleanApiKey) {
          updateData.aiApiKey = cleanApiKey;
          updateData.aiApiKeySet = true;
      } else if (provider === 'google') {
          // For Google, we are relying on ENV vars, so we don't save a user API key?
          // Or does the user WANT to provide one? The prompt says "keep the gemini api in env".
          // So we don't save a key for the user here. We just set the provider.
          // However, existing implementations check 'aiApiKey' in settings.
          // We need custom logic in backend to check env if provider is Google.
          // For consistency, we'll just save the Provider selection.
      }

      await firestoreService.updateUserSettings(user.uid, updateData);
      
      if (cleanApiKey) {
          setIsKeySet(true);
          setApiKey(""); // Clear input
      }
      setLastUpdated(new Date());
      toast.success("AI Configuration saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
      return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium">AI Integration</h3>
        <p className="text-sm text-neutral-500">
          Choose your AI provider and configure access.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>
            Select which AI service to use for the assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            
            <RadioGroup value={provider} onValueChange={(v: "openai" | "google") => setProvider(v)} className="grid grid-cols-2 gap-4">
                <div>
                    <RadioGroupItem value="openai" id="openai" className="peer sr-only" />
                    <Label
                        htmlFor="openai"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                        <span className="mb-2 text-lg font-semibold">OpenAI</span>
                        <span className="text-xs text-center text-neutral-500">GPT-4 Turbo</span>
                    </Label>
                </div>
                <div>
                    <RadioGroupItem value="google" id="google" className="peer sr-only" />
                    <Label
                        htmlFor="google"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                        <span className="mb-2 text-lg font-semibold">Google Gemini</span>
                        <span className="text-xs text-center text-neutral-500">Gemini 2.5 Flash</span>
                    </Label>
                </div>
            </RadioGroup>

            <div className="pt-4 border-t">
                {provider === 'openai' ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="apiKey">OpenAI API Key</Label>
                            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center">
                                Get OpenAI Key <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </div>
                        
                        <div className="relative">
                            <Input 
                                id="apiKey" 
                                type="password" 
                                placeholder={isKeySet ? "••••••••••••••••••••••••" : "sk-..."}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="pr-10"
                            />
                            {isKeySet && !apiKey && (
                                <div className="absolute right-3 top-2.5 text-green-500 pointer-events-none">
                                    <Check className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                        
                        {isKeySet && (
                            <p className="text-xs text-neutral-500 flex items-center">
                                <Key className="h-3 w-3 mr-1" />
                                Key configured. Enter a new key to update it.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="bg-neutral-50 p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                        <div className="mt-0.5 bg-blue-100 p-1 rounded text-blue-600">
                             <Key className="h-4 w-4" />
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-neutral-900">Managed API Key</h4>
                            <p className="text-xs text-neutral-500 mt-1">
                                The Gemini API key is configured safely using environment variables (<code>GEMINI_API_KEY</code>). 
                                You do not need to enter it here.
                            </p>
                        </div>
                    </div>
                )}
            </div>

        </CardContent>
        <CardFooter className="flex justify-between border-t p-6 bg-neutral-50/50">
            <Button variant="ghost" type="button" onClick={() => setApiKey("")}>Reset Form</Button>
            <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
            </Button>
        </CardFooter>
      </Card>
      
      <Alert>
          <div className="h-4 w-4" />
          <AlertTitle className="ml-2">Note</AlertTitle>
          <AlertDescription className="ml-2 text-xs text-neutral-500">
              {provider === 'openai' 
                ? "You are responsible for API usage costs directly with OpenAI." 
                : "Google Gemini usage depends on the configured environment key quota."}
          </AlertDescription>
      </Alert>
    </div>
  );
}
