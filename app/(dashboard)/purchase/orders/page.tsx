"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { firestoreService } from "@/lib/firestore-service";
import { PurchaseOrder } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, Eye } from "lucide-react";

export default function PurchaseOrdersListPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const data = await firestoreService.getPurchaseOrders();
                setOrders(data);
            } catch (error) {
                console.error("Failed to fetch purchase orders:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const getStatusVariant = (status: PurchaseOrder['status']) => {
        switch (status) {
            case 'received': return 'success';
            case 'cancelled': return 'destructive';
            case 'draft': return 'secondary';
            default: return 'default';
        }
    };

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
                <Button asChild>
                    <Link href="/purchase/orders/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Order
                    </Link>
                </Button>
            </div>

            {isLoading ? (
                <div>Loading orders...</div>
            ) : orders.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/10">
                    <h3 className="text-lg font-medium text-muted-foreground">No purchase orders found</h3>
                    <Button asChild className="mt-4" variant="outline">
                        <Link href="/purchase/orders/new">Create your first Purchase Order</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {orders.map((po) => (
                         <Card key={po.id} className="hover:bg-muted/50 transition-colors">
                            <CardContent className="p-6 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-lg">PO #{po.id.slice(0, 8).toUpperCase()}</h3>
                                        <Badge variant={getStatusVariant(po.status) as any}>
                                            {po.status.replace("_", " ")}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Expected: {po.expectedDate && !isNaN(new Date(po.expectedDate).getTime()) ? format(new Date(po.expectedDate), "PPP") : "N/A"}
                                    </p>
                                    <p className="text-sm font-medium">
                                        {po.vendorName || `Supplier ID: ${po.supplierId}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Total Amount</p>
                                        <p className="font-bold">{formatCurrency(po.totalAmount)}</p>
                                    </div>
                                    <Button asChild variant="ghost" size="icon">
                                        <Link href={`/purchase/orders/${po.id}`}>
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
