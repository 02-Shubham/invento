"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Archive } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function MarketingNavbar() {
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Archive className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
            Invo
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="#features" className="hover:text-blue-600 transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
          <Link href="#testimonials" className="hover:text-blue-600 transition-colors">Testimonials</Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-gray-600 hover:text-blue-600 hover:bg-blue-50">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
