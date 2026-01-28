"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  Settings,
  Archive,
  ShoppingCart,
  List,
  RotateCcw,
  CreditCard
} from "lucide-react";

// INVO-like route structure based on reference image
const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Purchase",
    icon: ShoppingCart, 
    href: "/purchase", 
  },
  {
    label: "Inventory",
    icon: Package,
    href: "/inventory",
  },
  {
    label: "Sales",
    icon: FileText, // Using FileText for Sales/Invoices concept
    href: "/invoices", // Mapping 'Sales' to our Invoices page
  },
  {
    label: "Payments",
    icon: CreditCard,
    href: "/payments",
  },
  {
    label: "Customers",
    icon: Users,
    href: "/customers",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-white border-r border-gray-100 text-gray-900">
      <div className="px-6 py-4 flex-1">
        <Link href="/dashboard" className="flex items-center pl-2 mb-10">
          <div className="relative w-8 h-8 mr-3">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Archive className="w-5 h-5 text-white" />
             </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">INVO</h1>
            <p className="text-xs text-gray-500 font-medium">Purchasing & Inventory</p>
          </div>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => {
             const isActive = pathname === route.href;
             return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <route.icon className={cn("h-5 w-5 mr-3 transition-colors", isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600")} />
              {route.label}
            </Link>
          )})}
        </div>
        
        {/* Placeholder for specific sidebar items from image just to show we saw them */}
        <div className="mt-8">
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Operations
            </h3>
            <div className="space-y-1">
                 <button className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-500 rounded-xl hover:text-gray-900 hover:bg-gray-50 transition-all">
                    <List className="h-5 w-5 mr-3 text-gray-400" />
                    eBay Listing
                 </button>
                  <button className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-500 rounded-xl hover:text-gray-900 hover:bg-gray-50 transition-all">
                    <RotateCcw className="h-5 w-5 mr-3 text-gray-400" />
                    Return Items
                 </button>
            </div>
        </div>
      </div>
    </div>
  );
}
