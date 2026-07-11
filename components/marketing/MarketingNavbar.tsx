"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Archive, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
            Invento.ai
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="#features" className="hover:text-blue-600 transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
          <Link href="#testimonials" className="hover:text-blue-600 transition-colors">Testimonials</Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <Link href="/dashboard">
              <Button size="sm" className="sm:size-default">Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline-block">
                <Button variant="ghost" className="text-gray-600 hover:text-blue-600 hover:bg-blue-50">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="sm:size-default bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                  Get Started
                </Button>
              </Link>
            </>
          )}

          {/* Mobile Navigation Menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-600">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-6 bg-white w-72 border-l border-gray-100 flex flex-col justify-between">
                <div className="space-y-6 mt-8">
                  <Link href="/" className="flex items-center gap-2 mb-8">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                      <Archive className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-xl bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
                      Invento.ai
                    </span>
                  </Link>
                  <nav className="flex flex-col gap-4 text-base font-medium text-gray-600">
                    <Link href="#features" className="hover:text-blue-600 transition-colors">Features</Link>
                    <Link href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
                    <Link href="#testimonials" className="hover:text-blue-600 transition-colors">Testimonials</Link>
                  </nav>
                </div>
                <div className="space-y-3">
                  {!user && (
                    <Link href="/login" className="w-full block">
                      <Button variant="outline" className="w-full">
                        Log in
                      </Button>
                    </Link>
                  )}
                  <Link href={user ? "/dashboard" : "/signup"} className="w-full block">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      {user ? "Go to Dashboard" : "Get Started"}
                    </Button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
