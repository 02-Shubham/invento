"use client";

import { Menu, Search, Bell, Settings, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function TopNavbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    async function loadUserSettings() {
      if (user) {
        try {
          const userSettingsRef = doc(db, "user_settings", user.uid);
          const userSettingsSnap = await getDoc(userSettingsRef);
          if (userSettingsSnap.exists()) {
            const data = userSettingsSnap.data();
            setBusinessName(data.businessName || "");
          }
        } catch (error) {
          console.error("Error loading user settings:", error);
        }
      }
    }
    loadUserSettings();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getInitials = () => {
    if (businessName) {
      return businessName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <div className="flex items-center justify-between p-6 bg-transparent">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
            <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                <Menu />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-white w-72 border-r border-gray-100">
                <AppSidebar />
            </SheetContent>
            </Sheet>
        </div>
        <h2 className="text-xl font-bold bg-transparent">Dashboard</h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative w-96 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
                placeholder="Search" 
                className="pl-10 bg-gray-50 border-transparent focus:bg-white transition-all rounded-xl" 
            />
        </div>
        
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 rounded-full">
                <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-10 w-10 border-2 border-white shadow-sm cursor-pointer">
                  <AvatarImage src={user?.photoURL || undefined} />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {businessName || "Account"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
