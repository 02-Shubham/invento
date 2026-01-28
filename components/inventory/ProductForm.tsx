"use client";

import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Product } from "@/types";
import { useEffect } from "react";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be positive"),
  stockQuantity: z.number().min(0, "Stock cannot be negative"),
  reorderLevel: z.number().min(0, "Reorder level cannot be negative"),
  unit: z.string().min(1, "Unit is required"),
  // Stock Source Configuration
  canBePurchased: z.boolean().optional().default(true),
  canBeProduced: z.boolean().optional().default(false),
  productionNotes: z.string().optional(),
  estimatedProductionCost: z.number().min(0).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: ProductFormValues) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: ProductFormProps) {
  const form = useForm({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: "",
      sku: "",
      category: "",
      description: "",
      price: 0,
      stockQuantity: 0,
      reorderLevel: 5,
      unit: "pcs",
      canBePurchased: true,
      canBeProduced: false,
      productionNotes: "",
      estimatedProductionCost: 0,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        sku: initialData.sku,
        category: initialData.category,
        description: initialData.description,
        price: initialData.price,
        stockQuantity: initialData.stockQuantity,
        reorderLevel: initialData.reorderLevel,
        unit: initialData.unit,
        canBePurchased: initialData.canBePurchased ?? true,
        canBeProduced: initialData.canBeProduced ?? false,
        productionNotes: initialData.productionNotes || "",
        estimatedProductionCost: initialData.estimatedProductionCost || 0,
      });
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Product name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder="SKU-123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
            <h3 className="font-medium text-sm">Stock Source Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="canBePurchased"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                            <div className="space-y-0.5">
                                <FormLabel>Purchasable</FormLabel>
                                <div className="text-[0.8rem] text-muted-foreground">
                                    Can be bought from vendors
                                </div>
                            </div>
                            <FormControl>
                                <Input 
                                    type="checkbox" 
                                    checked={field.value} 
                                    onChange={field.onChange} 
                                    className="h-4 w-4"
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="canBeProduced"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                            <div className="space-y-0.5">
                                <FormLabel>Producible</FormLabel>
                                <div className="text-[0.8rem] text-muted-foreground">
                                    Produced in-house
                                </div>
                            </div>
                            <FormControl>
                                <Input 
                                    type="checkbox" 
                                    checked={field.value} 
                                    onChange={field.onChange} 
                                    className="h-4 w-4"
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
            
            {form.watch("canBeProduced") && (
                <div className="grid gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                     <FormField
                        control={form.control}
                        name="estimatedProductionCost"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Est. Production Cost</FormLabel>
                            <FormControl>
                            <Input 
                                type="number" 
                                step="0.01" 
                                {...field} 
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="productionNotes"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Production Notes / Recipe</FormLabel>
                            <FormControl>
                            <Textarea
                                placeholder="Materials needed, process steps..."
                                className="resize-none"
                                {...field}
                            />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            )}
        </div>

        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Electronics">Electronics</SelectItem>
                        <SelectItem value="School Bags">School Bags</SelectItem>
                        <SelectItem value="Collage Bags">Collage Bags</SelectItem>
                        <SelectItem value="Travel Bags">Travel Bags</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                    </Select>
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
                        <Input placeholder="pcs, kg, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Product description"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    {...field} 
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="stockQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reorderLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reorder Level</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" type="button" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {initialData ? "Save Changes" : "Create Product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
