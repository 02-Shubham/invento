"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PurchaseOrderForm } from "@/components/purchasing/PurchaseOrderForm";
import { firestoreService } from "@/lib/firestore-service";
import { toast } from "sonner";

export default function NewPurchaseOrderPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            await firestoreService.addPurchaseOrder({
                supplierId: "manual-entry", // Placeholder for now
                vendorName: data.vendorName,
                expectedDate: new Date(data.expectedDate),
                notes: data.notes || "",
                items: data.items,
                status: 'ordered',
                totalAmount: data.items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitCost), 0),
                poNumber: `PO-${Date.now()}`,
                orderDate: new Date()
            });
            toast.success("Purchase Order created successfully");
            router.push("/purchase/orders");
        } catch (error) {
            console.error("Error creating PO:", error);
            toast.error("Failed to create Purchase Order");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8 max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Create Purchase Order</h1>
            <PurchaseOrderForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
    );
}
