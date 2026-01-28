"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { firestoreService } from "@/lib/firestore-service";
import { UserSettings } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Check, Key, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

export default function ApiKeysPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("anthropic");
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
    
    // If key is set (masked) and user didn't change it (apiKey is empty), just save provider change
    if (isKeySet && !apiKey) {
         setSaving(true);
         try {
            await firestoreService.updateUserSettings(user.uid, {
                aiProvider: provider,
                aiModel: provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'gpt-4-turbo'
            });
            toast.success("Provider updated successfully");
         } catch(error) {
             toast.error("Failed to update provider");
         } finally {
             setSaving(false);
         }
         return;
    }

    if (!apiKey) {
      toast.error("Please enter an API key");
      return;
    }

    // Basic validation
    if (provider === 'anthropic' && !apiKey.startsWith('sk-ant')) {
         toast.error("Invalid Anthropic API key format (should start with sk-ant)");
         return;
    }
    if (provider === 'openai' && !apiKey.startsWith('sk-')) {
         toast.error("Invalid OpenAI API key format (should start with sk-)");
         return;
    }

    setSaving(true);
    try {
      await firestoreService.updateUserSettings(user.uid, {
        aiProvider: provider,
        aiApiKey: apiKey,
        aiApiKeySet: true,
        aiKeyLastUpdated: new Date(),
        aiModel: provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'gpt-4-turbo'
      });
      setIsKeySet(true);
      setApiKey(""); // Clear input for security
      setLastUpdated(new Date());
      toast.success("API Key saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save API key");
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
          Configure your AI provider to enable smart assistants.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Choose your preferred AI provider and enter your API key. Keys are stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            
          <div className="space-y-3">
            <Label>AI Provider</Label>
            <RadioGroup 
                value={provider} 
                onValueChange={(val: any) => setProvider(val)}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div>
                <RadioGroupItem value="anthropic" id="anthropic" className="peer sr-only" />
                <Label
                  htmlFor="anthropic"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-neutral-100 bg-transparent p-4 hover:bg-neutral-50 hover:text-neutral-900 peer-data-[state=checked]:border-neutral-900 [&:has([data-state=checked])]:border-neutral-900 cursor-pointer transition-all"
                >
                  <span className="text-xl mb-2">🧠</span>
                  <span className="font-semibold">Anthropic</span>
                  <span className="text-xs text-neutral-500">Claude 3.5 Sonnet</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="openai" id="openai" className="peer sr-only" />
                <Label
                  htmlFor="openai"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-neutral-100 bg-transparent p-4 hover:bg-neutral-50 hover:text-neutral-900 peer-data-[state=checked]:border-neutral-900 [&:has([data-state=checked])]:border-neutral-900 cursor-pointer transition-all"
                >
                  <span className="text-xl mb-2">🤖</span>
                  <span className="font-semibold">OpenAI</span>
                  <span className="text-xs text-neutral-500">GPT-4 Turbo</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="google" id="google" className="peer sr-only" disabled />
                <Label
                  htmlFor="google"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-neutral-100 bg-neutral-50 p-4 opacity-50 cursor-not-allowed"
                >
                  <span className="text-xl mb-2">⚡</span>
                  <span className="font-semibold">Google</span>
                  <span className="text-xs text-neutral-500">Gemini (Coming Soon)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
                <Label htmlFor="apiKey">API Key</Label>
                {provider === 'anthropic' && (
                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center">
                        Get Anthropic Key <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                )}
                {provider === 'openai' && (
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center">
                        Get OpenAI Key <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                )}
            </div>
            
            <div className="relative">
                <Input 
                    id="apiKey" 
                    type="password" 
                    placeholder={isKeySet ? "••••••••••••••••••••••••" : (provider === 'anthropic' ? 'sk-ant-...' : 'sk-...')}
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
                    Key set {lastUpdated ? `(Updated ${lastUpdated.toLocaleDateString()})` : ''}. 
                    Enter a new key above to change it.
                </p>
            )}
            
            {!isKeySet && (
                <p className="text-xs text-neutral-500">
                    Your key is stored securely and never shared.
                </p>
            )}
          </div>

        </CardContent>
        <CardFooter className="flex justify-between border-t p-6 bg-neutral-50/50">
            <Button variant="outline" type="button" onClick={() => setApiKey("")}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (!apiKey && !isKeySet)}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isKeySet && !apiKey ? "Update Provider" : "Save Configuration"}
            </Button>
        </CardFooter>
      </Card>
      
      <Alert>
          <div className="h-4 w-4" />
          <AlertTitle className="ml-2">About Billing</AlertTitle>
          <AlertDescription className="ml-2 text-xs text-neutral-500">
              You are responsible for API usage costs directly with {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}. 
              Invento AI does not charge extra for using your own keys. 
              Typical costs are minimal ($0.01 - $0.05 per conversation).
          </AlertDescription>
      </Alert>
    </div>
  );
}
