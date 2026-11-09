"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { DEFAULT_CURRENCY, getActiveCurrency, setActiveCurrency } from "./utils";
import type { BusinessProfile } from "@/types";

const EMPTY_PROFILE: BusinessProfile = {
  businessName: "",
  businessAddress: "",
  businessEmail: "",
  businessPhone: "",
  taxId: "",
};

/** Pick only the business-identity fields from a user_settings document (never the AI key). */
function toBusinessProfile(data: Record<string, any> | undefined): BusinessProfile {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    businessName: s(data?.businessName),
    businessAddress: s(data?.businessAddress),
    businessEmail: s(data?.businessEmail),
    businessPhone: s(data?.businessPhone),
    taxId: s(data?.taxId),
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** The user's saved currency code (e.g. "INR"). Consumers re-render when it changes. */
  currency: string;
  /** The user's own business details (Settings → Profile), live. Empty strings until set. */
  businessProfile: BusinessProfile;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_PROFILE);

  // Keep the formatter's currency and the business profile in sync with the user's
  // saved settings, live. The last known currency is cached per user so a page
  // reload doesn't flash the default.
  useEffect(() => {
    if (!user) {
      setActiveCurrency(DEFAULT_CURRENCY);
      setCurrency(DEFAULT_CURRENCY);
      setBusinessProfile(EMPTY_PROFILE); // never keep the previous user's details
      return;
    }

    const cacheKey = `invento:currency:${user.uid}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setActiveCurrency(cached);
        setCurrency(getActiveCurrency());
      }
    } catch {
      /* storage unavailable (private mode etc.) — fine */
    }

    const unsubscribe = onSnapshot(
      doc(db, "user_settings", user.uid),
      (snap) => {
        // Set the formatter first so consumers re-rendering from setCurrency see the new value
        setActiveCurrency(snap.data()?.currency);
        const active = getActiveCurrency();
        setCurrency(active);
        setBusinessProfile(toBusinessProfile(snap.data()));
        try {
          localStorage.setItem(cacheKey, active);
        } catch {
          /* ignore */
        }
      },
      (error) => console.error("Error watching user settings:", error)
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      // Update last login time
      if (user) {
        try {
          const userSettingsRef = doc(db, "user_settings", user.uid);
          await setDoc(
            userSettingsRef,
            { lastLoginAt: serverTimestamp() },
            { merge: true }
          );
        } catch (error) {
          console.error("Error updating last login:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back!");
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      toast.error(errorMessage);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user_settings document
      const userSettingsRef = doc(db, "user_settings", user.uid);
      await setDoc(userSettingsRef, {
        businessName: "",
        businessAddress: "",
        businessPhone: "",
        businessEmail: email,
        taxId: "",
        currency: "INR",
        industry: "",
        plan: "free",
        subscriptionStatus: "trial",
        aiProvider: null,
        aiApiKey: "",
        aiApiKeySet: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      toast.success("Account created successfully!");
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      toast.error(errorMessage);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if user_settings exists, create if not
      const userSettingsRef = doc(db, "user_settings", user.uid);
      const userSettingsSnap = await getDoc(userSettingsRef);

      if (!userSettingsSnap.exists()) {
        await setDoc(userSettingsRef, {
          businessName: "",
          businessAddress: "",
          businessPhone: "",
          businessEmail: user.email || "",
          taxId: "",
          currency: "INR",
          industry: "",
          plan: "free",
          subscriptionStatus: "trial",
          aiProvider: null,
          aiApiKey: "",
          aiApiKeySet: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
      }

      toast.success("Signed in with Google!");
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error: any) {
      toast.error("Failed to log out");
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, currency, businessProfile, signIn, signUp, logout, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function getAuthErrorMessage(errorCode: string): string {
  const errorMessages: { [key: string]: string } = {
    "auth/user-not-found": "No account found with this email",
    "auth/wrong-password": "Incorrect password",
    "auth/email-already-in-use": "Email already registered",
    "auth/weak-password": "Password should be at least 8 characters",
    "auth/invalid-email": "Invalid email address",
    "auth/too-many-requests": "Too many attempts. Please try again later",
    "auth/network-request-failed": "Network error. Please check your connection",
    "auth/popup-closed-by-user": "Sign-in popup was closed",
    "auth/cancelled-popup-request": "Sign-in was cancelled",
  };

  return errorMessages[errorCode] || "An error occurred. Please try again.";
}
