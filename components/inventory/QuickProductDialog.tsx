"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { firestoreService } from "@/lib/firestore-service";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const quickProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  price: z.number().min(0, "Price must be positive"),
  unit: z.string().min(1, "Unit is required"),
});

type QuickProductFormValues = z.infer<typeof quickProductSchema>;

interface QuickProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (productId: string) => void;
  defaultName?: string;
}

export function QuickProductDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  defaultName = ""
}: QuickProductDialogProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<QuickProductFormValues>({
    resolver: zodResolver(quickProductSchema),
    defaultValues: {
      name: defaultName,
      sku: "",
      price: 0,
      unit: "pcs",
    },
  });

  // Update default name when it changes/dialog opens
  // (Optional: can use useEffect if strictly needed, but form reset usually better on open)

  const handleSubmit = async (data: QuickProductFormValues) => {
    if (!user) {
      toast.error("You must be logged in to create a product");
      return;
    }
    setIsLoading(true);
    try {
      // Auto-generate SKU if empty
      const finalSku = data.sku || `SKU-${Date.now().toString().slice(-6)}`;
      
      const productId = await firestoreService.addProduct({
        name: data.name,
        sku: finalSku,
        price: data.price,
        stockQuantity: 0,
        unit: data.unit,
        description: "Quick added from PO",
        category: "Uncategorized", // Default
        canBePurchased: true,
        canBeProduced: false,
        reorderLevel: 0,
        averageCost: data.price, // Initial cost assumption
        lastCost: data.price,
        totalValue: 0
      }, user.uid);

      toast.success("Product created successfully");
      onSuccess(productId);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Failed to create product:", error);
      toast.error("Failed to create product");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Quick Create Product</DialogTitle>
          <DialogDescription>
            Add a new product quickly. You can edit full details later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Product Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Auto-generated if empty" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="pcs, kg..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost / Price</FormLabel>
                  <FormControl>
                    <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
               <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Product
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
