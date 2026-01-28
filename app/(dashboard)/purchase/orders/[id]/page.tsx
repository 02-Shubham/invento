"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { firestoreService } from "@/lib/firestore-service";
import { useAuth } from "@/lib/auth-context";
import { PurchaseOrder, Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function PurchaseOrderDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [productNames, setProductNames] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchPO = async () => {
            if (!id || !user) return;
            try {
                const data = await firestoreService.getPurchaseOrderById(id as string, user.uid);
                setPo(data);
                
                if (data) {
                    // Fetch product names for better display
                    const pIds = data.items.map(i => i.productId);
                    if (pIds.length > 0) {
                        try {
                             // Assuming firestoreService doesn't have getProductsByIds, doing manual fetch
                             // Ideally we batch this or use a service method
                             const prods: Record<string, string> = {};
                             // Basic loop for now, optimize later
                             for (const pid of pIds) {
                                 // We don't have getProductById exposed efficiently for batch?
                                 // Let's use getInventoryTransactions logic? No.
                                 // Let's just fetch one by one or assuming we can cache.
                                 // Or better, just show ID if fail.
                                 // Actually let's fetch all products to be safe or filtered?
                                 // fetching individual docs is okay for a detail page.
                                 // But I can't import `doc` from firestore client here easily without mixing service patterns?
                                 // I'll stick to displaying ID if name not found, or fetch all products.
                                 // Actually firestoreService has getProducts (all). which might be heavy.
                                 // I'll just fetch all products once, or implement getAllProducts.
                                 // Let's try fetching all for now, assuming small catalog.
                            }
                            // Let's assume we can fetch all products for mapping
                            const q = query(collection(db, "products"), where("userId", "==", user.uid));
                            const snap = await getDocs(q);
                            snap.forEach(d => {
                                const p = d.data() as Product;
                                prods[d.id] = p.name;
                            });
                            setProductNames(prods);

                        } catch (e) {
                            console.error("Failed to fetch product names", e);
                        }
                    }
                }

            } catch (error) {
                console.error("Failed to fetch purchase order:", error);
                toast.error("Could not load Purchase Order");
            } finally {
                setIsLoading(false);
            }
        };
        fetchPO();
    }, [id, user]);

    const handleReceive = async () => {
        if (!po || !user) return;
        setIsProcessing(true);
        try {
            // Process transactions
            for (const item of po.items) {
                await firestoreService.addInventoryTransaction({
                    productId: item.productId,
                    productName: productNames[item.productId] || "Unknown Product",
                    sku: "", // Optional or fetch if needed
                    quantity: item.quantity,
                    transactionType: 'purchase',
                    referenceId: po.id,
                    notes: `Received from PO #${po.id.slice(0, 8)}`,
                    unitCost: item.unitCost,
                    referenceType: 'PurchaseOrder'
                }, user.uid);
            }
            
            // Update PO status
            await firestoreService.updatePurchaseOrder(po.id, { status: 'received' }, user.uid);
            
            toast.success("Items received and stock updated.");
            setPo({ ...po, status: 'received' }); // Optimistic update
        } catch (error) {
            console.error("Error receiving items:", error);
            toast.error("Failed to receive items");
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) return <div className="p-8">Loading...</div>;
    if (!po) return <div className="p-8">Purchase Order not found</div>;

    return (
        <div className="container mx-auto py-8">
            <div className="mb-6">
                <Button variant="ghost" className="pl-0" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Orders
                </Button>
            </div>

            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-4">
                        PO #{po.id.slice(0, 8).toUpperCase()}
                        <Badge variant={po.status === 'received' ? 'success' as any : 'secondary'} className="text-lg px-3 py-1">
                            {(po.status || 'ordered').toUpperCase()}
                        </Badge>
                    </h1>
                     <p className="text-muted-foreground mt-2">
                        Created on {po.createdAt ? format(new Date(po.createdAt), "PPP") : "N/A"}
                    </p>
                </div>
                {po.status !== 'received' && (
                    <Button onClick={handleReceive} disabled={isProcessing} size="lg" className="bg-green-600 hover:bg-green-700">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Receive Items
                    </Button>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Supplier Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-medium text-lg">
                            {po.vendorName || po.supplierId}
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Expected Date</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-medium text-lg">{po.expectedDate && !isNaN(new Date(po.expectedDate).getTime()) ? format(new Date(po.expectedDate), "PPP") : "N/A"}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-bold text-2xl">{formatCurrency(po.totalAmount)}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Product</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Quantity</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Unit Cost</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Total</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {po.items.map((item, index) => (
                                    <tr key={index} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle font-medium">
                                            {productNames[item.productId] || item.productId}
                                        </td>
                                        <td className="p-4 align-middle text-right">{item.quantity}</td>
                                        <td className="p-4 align-middle text-right">{formatCurrency(item.unitCost)}</td>
                                        <td className="p-4 align-middle text-right font-bold">{formatCurrency(item.quantity * item.unitCost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

             {po.notes && (
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">{po.notes}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
