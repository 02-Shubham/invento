"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { firestoreService } from "@/lib/firestore-service";
import { useAuth } from "@/lib/auth-context";
import { Product, TransactionType } from "@/types";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

const stockConfigSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.string().refine((val) => parseInt(val) > 0, {
    message: "Quantity must be a positive number",
  }),
  sourceType: z.enum(["production", "adjustment", "return_customer", "other"]),
  unitCost: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().max(500, "Notes limited to 500 characters").optional(),
});

export default function AddStockPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const form = useForm<z.infer<typeof stockConfigSchema>>({
    resolver: zodResolver(stockConfigSchema),
    defaultValues: {
      sourceType: "production",
      quantity: "",
      unitCost: "",
      referenceNumber: "",
      notes: "",
    },
  });

  const selectedSource = form.watch("sourceType");
  const unitCostInput = form.watch("unitCost") || "";
  const quantityInput = form.watch("quantity") || "";

  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(prods);
    });
    return () => unsubscribe();
  }, []);

  const handleProductChange = (productId: string) => {
      const product = products.find(p => p.id === productId) || null;
      setSelectedProduct(product);
      form.setValue("productId", productId);
      
      // Auto-fill suggested cost for production if available
      if (form.getValues("sourceType") === "production" && product?.estimatedProductionCost) {
          form.setValue("unitCost", product.estimatedProductionCost.toString());
      }
  };

  const onSubmit = async (values: z.infer<typeof stockConfigSchema>) => {
    try {
      setLoading(true);

      if (!user) {
        toast.error("Please sign in to continue");
        return;
      }
      
      if (!selectedProduct) {
          toast.error("Please select a product");
          return;
      }

      const quantity = parseInt(values.quantity);
      const unitCost = values.unitCost ? parseFloat(values.unitCost) : undefined;
      
      // Determine Transaction Type based on source
      // 'production' maps to 'production'
      // 'adjustment' maps to 'adjustment'
      // 'return_customer' maps to 'return_customer'
      // 'other' maps to 'adjustment'
      
      let transactionType: TransactionType = 'adjustment';
      if (values.sourceType === 'production') transactionType = 'production';
      else if (values.sourceType === 'return_customer') transactionType = 'return_customer';
      
      await firestoreService.addInventoryTransaction({
          productId: values.productId,
          productName: selectedProduct.name,
          sku: selectedProduct.sku,
          quantity: quantity,
          transactionType: transactionType,
          unitCost: unitCost,
          referenceType: values.sourceType === 'production' ? 'ProductionBatch' : 'Manual',
          referenceNumber: values.referenceNumber,
          notes: values.notes,
          createdBy: 'user', // Placeholder
      }, user.uid);

      toast.success(`Added ${quantity} units to ${selectedProduct.name}`);
      router.push("/inventory");
    } catch (error: any) {
      console.error("Error adding stock:", error);
      toast.error(error.message || "Failed to add stock");
    } finally {
      setLoading(false);
    }
  };

  // Calculations for Preview
  const currentStock = selectedProduct?.stockQuantity || 0;
  const currentAvgCost = selectedProduct?.averageCost || 0;
  
  const addQty = parseInt(quantityInput) || 0;
  const addCost = parseFloat(unitCostInput) || 0;
  
  const newStock = currentStock + addQty;
  let estimatedNewAvgCost = currentAvgCost;
  
  if (addQty > 0 && addCost > 0) {
      const interactionsVals = (currentStock * currentAvgCost) + (addQty * addCost);
      estimatedNewAvgCost = interactionsVals / (currentStock + addQty);
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Stock to Inventory</h1>
        <p className="text-muted-foreground mt-2">
            Record stock from in-house production, manual adjustments, or returns.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Stock Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            
                            <FormField
                                control={form.control}
                                name="productId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Product</FormLabel>
                                        <Select 
                                            onValueChange={handleProductChange} 
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a product" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {products.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.name} {p.sku ? `(${p.sku})` : ""} - Stock: {p.stockQuantity}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sourceType"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Source Type</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex flex-col space-y-1"
                                            >
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="production" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        In-House Production
                                                    </FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="adjustment" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        Stock Adjustment / Correction
                                                    </FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="return_customer" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        Customer Return
                                                    </FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="Enter quantity" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Positive number to add to stock.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="unitCost"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Unit Cost (₹)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="Optional" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                For calculating average value.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <FormField
                                    control={form.control}
                                    name="referenceNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Batch/Ref #</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. BATCH-001" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Any additional details..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-4">
                                <Button type="button" variant="outline" onClick={() => router.back()}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Adding..." : "Add to Inventory"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>

        <div>
            {selectedProduct && (
                <Card>
                    <CardHeader>
                        <CardTitle>Preview Impact</CardTitle>
                        <CardDescription>
                            See how this transaction will affect inventory values.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 border-b pb-4">
                             <div>
                                <p className="text-sm font-medium text-muted-foreground">Product</p>
                                <p className="font-semibold">{selectedProduct.name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Type</p>
                                <p className="capitalize">{(selectedSource || '').replace('_', ' ')}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Current Stock</span>
                                <span>{currentStock} units</span>
                            </div>
                            <div className="flex justify-between items-center text-green-600 font-medium">
                                <span>Adding</span>
                                <span>+ {addQty || 0} units</span>
                            </div>
                            <div className="flex justify-between items-center border-t pt-2 font-bold">
                                <span>New Stock</span>
                                <span>{newStock} units</span>
                            </div>
                        </div>

                         <div className="space-y-2 pt-4">
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Current Avg Cost</span>
                                <span>₹ {currentAvgCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-blue-600">
                                <span>Addition Unit Cost</span>
                                <span>₹ {addCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center border-t pt-2 font-bold">
                                <span>New Avg Cost (Est.)</span>
                                <span>₹ {estimatedNewAvgCost.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        {selectedProduct.canBeProduced && selectedSource === 'production' && (
                             <div className="bg-muted p-3 round-md mt-4 text-sm">
                                <p className="font-medium mb-1">Production Details:</p>
                                <p>{selectedProduct.productionNotes || "No production notes available."}</p>
                            </div>
                        )}

                    </CardContent>
                </Card>
            )}
        </div>
      </div>
    </div>
  );
}
