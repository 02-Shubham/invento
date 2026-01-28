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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Mail, Trash2, AlertCircle } from "lucide-react";

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [lastLogin, setLastLogin] = useState<Date | null>(null);

  useEffect(() => {
    async function loadAccountInfo() {
      if (!user) return;

      try {
        const userSettingsRef = doc(db, "user_settings", user.uid);
        const userSettingsSnap = await getDoc(userSettingsRef);

        if (userSettingsSnap.exists()) {
          const data = userSettingsSnap.data();
          if (data.lastLoginAt) {
            setLastLogin(data.lastLoginAt.toDate());
          }
        }
      } catch (error) {
        console.error("Error loading account info:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccountInfo();
  }, [user]);

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error("No email address found");
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      console.error("Error sending password reset:", error);
      toast.error("Failed to send password reset email");
    } finally {
      setIsSendingReset(false);
    }
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
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Manage your account settings and security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Email Address</Label>
            <div className="flex items-center gap-2">
              <Input value={user?.email || ""} disabled />
              <Mail className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">
              Your email address cannot be changed here. Contact support if you need to change it.
            </p>
          </div>

          {lastLogin && (
            <div className="space-y-2">
              <Label>Last Login</Label>
              <p className="text-sm text-gray-600">
                {format(lastLogin, "PPpp")}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Password</Label>
            <Button
              variant="outline"
              onClick={handlePasswordReset}
              disabled={isSendingReset}
            >
              {isSendingReset ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Password Reset Email"
              )}
            </Button>
            <p className="text-sm text-gray-500">
              We'll send you an email with instructions to reset your password.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Deleting your account will permanently remove all your data including products, customers, invoices, and settings. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account
                  and remove all your data from our servers. All your products, customers,
                  invoices, and settings will be lost forever.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    toast.error("Account deletion is not yet implemented. Please contact support.");
                  }}
                >
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
