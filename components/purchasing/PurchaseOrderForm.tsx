"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Product } from "@/types";
import { Plus, Trash, Check, ChevronsUpDown, Loader2, PlusCircle } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { QuickProductDialog } from "@/components/inventory/QuickProductDialog";

const purchaseOrderSchema = z.object({
  vendorName: z.string().min(1, "Vendor Name is required"),
  expectedDate: z.string().min(1, "Expected date is required"),
  notes: z.string().optional(),
  items: z.array(z.object({
      productId: z.string().min(1, "Product is required"),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      unitCost: z.number().min(0, "Cost must be positive"),
  })).min(1, "Add at least one item"),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

export function PurchaseOrderForm({
    onSubmit,
    isLoading
}: {
    onSubmit: (data: PurchaseOrderFormValues) => void;
    isLoading?: boolean;
}) {
    const [products, setProducts] = useState<Product[]>([]);
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const form = useForm<PurchaseOrderFormValues>({
        resolver: zodResolver(purchaseOrderSchema),
        defaultValues: {
            vendorName: "",
            expectedDate: "",
            notes: "",
            items: [{ productId: "", quantity: 1, unitCost: 0 }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });

    // Fetch Products (Purchasable only)
    useEffect(() => {
        const q = query(collection(db, "products"), where("canBePurchased", "==", true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(prods);
        });
        return () => unsubscribe();
    }, []);

    const calculateTotal = () => {
        const items = form.watch("items");
        return items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);
    };

    const handleProductCreated = (newProductId: string) => {
        if (activeItemIndex !== null) {
            form.setValue(`items.${activeItemIndex}.productId`, newProductId);
            // Optionally fetch immediately to set cost, but simpler if user sets it or on next snapshot update
            // We can assume snapshot updates quickly. 
            // Better yet, set unitCost if we knew it, but for now just selecting the product is good.
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Order Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                         <FormField
                            control={form.control}
                            name="vendorName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Supplier / Vendor Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter supplier name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="expectedDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expected Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <span>Items</span>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => append({ productId: "", quantity: 1, unitCost: 0 })}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Item
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex gap-4 items-end border p-4 rounded-lg">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.productId`}
                                    render={({ field }) => (
                                        <FormItem className="flex-1 flex flex-col">
                                            <FormLabel className={index !== 0 ? "sr-only" : ""}>Product</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(
                                                                "w-full justify-between",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                            onClick={() => setActiveItemIndex(index)}
                                                        >
                                                            {field.value
                                                                ? products.find(
                                                                    (product) => product.id === field.value
                                                                )?.name
                                                                : "Select product"}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0">
                                                    <Command>
                                                        <CommandInput 
                                                            placeholder="Search product..." 
                                                            onValueChange={setSearchTerm}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                <div className="p-2">
                                                                     <p className="text-sm text-muted-foreground mb-2">No product found.</p>
                                                                     <Button 
                                                                        variant="outline" 
                                                                        className="w-full justify-start text-blue-600"
                                                                        onClick={() => {
                                                                            setIsProductDialogOpen(true);
                                                                            // Popover closes automatically on click outside usually, 
                                                                            // but we might need to force close if we want smoother UX.
                                                                            // For now standard behavior is fine.
                                                                        }}
                                                                     >
                                                                        <PlusCircle className="mr-2 h-4 w-4" />
                                                                        Create "{searchTerm}"
                                                                     </Button>
                                                                </div>
                                                            </CommandEmpty>
                                                            <CommandGroup heading="Products">
                                                                {products.map((product) => (
                                                                    <CommandItem
                                                                        value={product.name}
                                                                        key={product.id}
                                                                        onSelect={() => {
                                                                            form.setValue(`items.${index}.productId`, product.id);
                                                                            form.setValue(`items.${index}.unitCost`, product.lastCost || product.price || 0);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                product.id === field.value
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {product.name}
                                                                        <span className="ml-2 text-muted-foreground text-xs">Stock: {product.stockQuantity}</span>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                            <CommandSeparator />
                                                            <CommandGroup>
                                                                <CommandItem 
                                                                    value="create_new_product_action"
                                                                    onSelect={() => setIsProductDialogOpen(true)}
                                                                    className="text-blue-600 cursor-pointer"
                                                                >
                                                                    <PlusCircle className="mr-2 h-4 w-4" />
                                                                    Create new product...
                                                                </CommandItem>
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.quantity`}
                                    render={({ field }) => (
                                        <FormItem className="w-24">
                                            <FormLabel className={index !== 0 ? "sr-only" : ""}>Qty</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="number" 
                                                    {...field} 
                                                    onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.unitCost`}
                                    render={({ field }) => (
                                        <FormItem className="w-32">
                                            <FormLabel className={index !== 0 ? "sr-only" : ""}>Cost</FormLabel>
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
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => remove(index)}
                                    className="mb-0.5"
                                >
                                    <Trash className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        ))}

                        <div className="flex justify-end pt-4 border-t">
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Total Estimated Cost</p>
                                <p className="text-2xl font-bold">{formatCurrency(calculateTotal())}</p>
                            </div>
                        </div>

                         <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Delivery instructions, etc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Purchase Order
                    </Button>
                </div>
            </form>

            <QuickProductDialog 
                open={isProductDialogOpen} 
                onOpenChange={setIsProductDialogOpen}
                onSuccess={handleProductCreated}
                defaultName={searchTerm}
            />
        </Form>
    );
}
