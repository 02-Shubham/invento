"use client";

import Link from "next/link";
import { 
  Building2, 
  History, 
  PlusCircle, 
  ShoppingCart 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PurchasePage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Purchase & Inventory</h1>
        <p className="text-muted-foreground mt-2">
          Manage procurement, production, and stock levels.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Purchase Orders Card */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Purchase Orders
            </CardTitle>
            <CardDescription>
              Manage vendor orders and incoming shipments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/purchase/orders">View Active Orders</Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link href="/purchase/orders/new">Create Purchase Order</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Stock Card */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-green-600" />
              Add Stock
            </CardTitle>
            <CardDescription>
              Record in-house production, returns, or adjustments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full justify-start bg-green-600 hover:bg-green-700">
              <Link href="/purchase/add-stock">Add Stock Manually</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Stock History Card */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-orange-600" />
              Stock History
            </CardTitle>
            <CardDescription>
              View full audit log of all inventory movements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/purchase/history">View History</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
