"use client";

import { useStore } from "@/lib/store";
import { useForm, useFieldArray, SubmitHandler, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
    Form, 
    FormControl, 
    FormField, 
    FormItem, 
    FormLabel, 
    FormMessage,
    FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Plus, CalendarIcon, Loader2, Check, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { firestoreService } from "@/lib/firestore-service";
import { Product, Customer } from "@/types";
import { 
    Command, 
    CommandEmpty, 
    CommandGroup, 
    CommandInput, 
    CommandItem,
    CommandList 
} from "@/components/ui/command";

import { useAuth } from "@/lib/auth-context";

// Schema (Added customerId)
const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"), // Linked Customer ID
  customerName: z.string().min(1, "Customer Name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  invoiceDate: z.date(),
  dueDate: z.date(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, "Product is required"),
      quantity: z.number().min(1, "Quantity must be at least 1"),
    })
  ).min(1, "Add at least one item"),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export function CreateInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedCustomerId = searchParams.get('customerId');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [nextInvoiceNum, setNextInvoiceNum] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Settings from store
  const { user } = useAuth(); // Get authenticated user
  const settings = useStore((state) => state.settings);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      invoiceDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Default 30 days
      notes: "",
      items: [{ productId: "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      if (!user) return; // Wait for user
      setIsLoading(true);
      try {
         // 1. Fetch Products
         const productsData = await firestoreService.getProducts(user.uid);
         setProducts(productsData);

         // 2. Fetch Customers
         const customersData = await firestoreService.getCustomers(user.uid);
         setCustomers(customersData);

         // 3. Pre-select customer if ID in URL
         if (preSelectedCustomerId && customersData.length > 0) {
             const customer = customersData.find(c => c.id === preSelectedCustomerId);
             if (customer) {
                 handleCustomerSelect(customer);
             }
         }

         // 4. Determine Next Invoice Num
         const invoices = await firestoreService.getInvoices(user.uid);
         setNextInvoiceNum(invoices.length + 1);

      } catch (error) {
        console.error("Failed to load data", error);
        toast.error("Failed to load products/customers");
      } finally {
        setIsLoading(false);
      }
    };
    if (user) {
        loadData();
    }
  }, [preSelectedCustomerId, user]);

  const watchedItems = form.watch("items");

  const calculateTotals = () => {
    const subtotal = watchedItems.reduce((acc, item) => {
      const product = products.find((p) => p.id === item.productId);
      return acc + (product ? product.price * item.quantity : 0);
    }, 0);
    
    // Tax system removed as per user request
    const taxRate = 0;
    const taxAmount = 0;
    const total = subtotal; 
    return { subtotal, taxAmount, total };
  };

  const { subtotal, total } = calculateTotals();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { 
        style: "currency", 
        currency: settings?.currency || "USD" 
    }).format(amount);
  }

  const handleCustomerSelect = (customer: Customer) => {
      form.setValue("customerId", customer.id);
      form.setValue("customerName", customer.name);
      form.setValue("customerEmail", customer.email);
      form.setValue("customerPhone", customer.phone);
      form.setValue("customerAddress", customer.address);
  }

  const onSubmit: SubmitHandler<InvoiceFormValues> = async (data) => {
    if (!user) return; // Guard
    // 1. Validate Stock
    for (const item of data.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        toast.error(`Product not found for one of the items`);
        return;
      }
      if (product.stockQuantity < item.quantity) {
        toast.error(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`);
        return;
      }
    }

    try {
        // 2. Prepare Invoice Object
        const newInvoice: any = {
          invoiceNumber: `${settings?.invoicePrefix || 'INV-'}${String(nextInvoiceNum).padStart(3, '0')}`,
          
          customerId: data.customerId, // Link!
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone || "",
          customerAddress: data.customerAddress || "",
          
          items: data.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return {
              productId: item.productId,
              productName: product.name,
              quantity: item.quantity,
              unitPrice: product.price,
              total: product.price * item.quantity,
            };
          }),
          subtotal,
          taxRate: 0,
          taxAmount: 0,
          total,
          status: 'pending',
          invoiceDate: data.invoiceDate,
          dueDate: data.dueDate,
          notes: data.notes || "",
        };

        // 3. Execute Transaction
        const docId = await firestoreService.createInvoiceWithStockUpdate(newInvoice, user.uid);

        // 4. Update Customer Stats
        if (data.customerId) {
            await firestoreService.updateCustomerStats(data.customerId, total, user.uid);
        }

        toast.success("Invoice created successfully!");
        router.push(`/invoices/${docId}`); // Redirect to detail page
    } catch (error: any) {
        console.error("Submission error", error);
        toast.error(`Failed to create invoice: ${error.message}`);
    }
  };

  if (isLoading) {
      return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Customer Details Section */}
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Customer Details</CardTitle>
                    <CardDescription>Select an existing customer or enter details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {/* Customer Select */}
                    <FormField
                        control={form.control}
                        name="customerId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Select Customer</FormLabel>
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
                                            >
                                                {field.value
                                                    ? customers.find(
                                                        (customer) => customer.id === field.value
                                                    )?.name
                                                    : "Select customer..."}
                                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search customer..." />
                                            <CommandList>
                                                <CommandEmpty>No customer found.</CommandEmpty>
                                                <CommandGroup>
                                                    {customers.map((customer) => (
                                                        <CommandItem
                                                            value={customer.name}
                                                            key={customer.id}
                                                            onSelect={() => {
                                                                handleCustomerSelect(customer);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    customer.id === field.value
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                )}
                                                            />
                                                            {customer.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                <FormDescription>
                                    <span 
                                        className="text-primary hover:underline cursor-pointer" 
                                        onClick={() => router.push('/customers')}
                                    >
                                        Manage customers
                                    </span>
                                </FormDescription>
                            </FormItem>
                        )}
                    />
                    
                    {/* Read-only/Editable fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="customerEmail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl><Input {...field} readOnly={!!form.getValues("customerId")} className={!!form.getValues("customerId") ? "bg-muted" : ""} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="customerPhone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone</FormLabel>
                                    <FormControl><Input {...field} readOnly={!!form.getValues("customerId")} className={!!form.getValues("customerId") ? "bg-muted" : ""} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="customerAddress"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Address</FormLabel>
                                <FormControl><Textarea {...field} readOnly={!!form.getValues("customerId")} className={!!form.getValues("customerId") ? "bg-muted" : ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {/* Hidden Name Field */}
                     <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                            <FormItem className="hidden">
                                <FormControl><Input {...field} /></FormControl>
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="invoiceDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Invoice Date</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value ? (
                                        format(field.value, "PPP")
                                        ) : (
                                        <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                        date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                    />
                                </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Due Date</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value ? (
                                        format(field.value, "PPP")
                                        ) : (
                                        <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                        date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                    />
                                </PopoverContent>
                                </Popover>
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
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Payment terms, bank details..." {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>
        </div>

        {/* Product Items Section */}
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Invoice Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     {fields.map((field, index) => {
                         const currentItem = form.watch(`items.${index}`);
                         const selectedProduct = products.find(p => p.id === currentItem.productId);
                         const lineTotal = selectedProduct ? selectedProduct.price * currentItem.quantity : 0;

                         return (
                        <div key={field.id} className="flex items-end gap-4 border-b pb-4 last:border-0 last:pb-0">
                             <FormField
                                control={form.control}
                                name={`items.${index}.productId`}
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel className={index !== 0 ? "sr-only" : ""}>Product</FormLabel>
                                    <Select 
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                        }} 
                                        defaultValue={field.value}
                                    >
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Select Product" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {products.map((product) => (
                                        <SelectItem 
                                            key={product.id} 
                                            value={product.id}
                                            disabled={product.stockQuantity === 0}
                                        >
                                            {product.name} ({formatCurrency(product.price)}) - {product.stockQuantity} in stock
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
                                name={`items.${index}.quantity`}
                                render={({ field }) => (
                                <FormItem className="w-24">
                                    <FormLabel className={index !== 0 ? "sr-only" : ""}>Qty</FormLabel>
                                    <FormControl>
                                    <Input 
                                        type="number" 
                                        {...field} 
                                        min="1"
                                        max={selectedProduct ? selectedProduct.stockQuantity : undefined}
                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <div className="w-32 pb-2 text-right text-sm">
                                 <span className="text-muted-foreground block text-xs mb-1">{index === 0 ? "Total" : ""}</span>
                                 {formatCurrency(lineTotal)}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => remove(index)}
                                disabled={fields.length === 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )})}
                   
                   <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => append({ productId: "", quantity: 1 })}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>

                     {/* Summary & Actions */}
                    <div className="flex justify-end">
                        <div className="w-full md:w-1/3 space-y-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                    <span>Total</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                            </div>
                             <div className="flex justify-end space-x-4 pt-4">
                                <Button variant="outline" type="button" onClick={() => router.back()}>
                                    Cancel
                                </Button>
                                <Button type="submit" size="lg">
                                    Create Invoice
                                </Button>
                            </div>
                        </div>
                    </div>

                </CardContent>
            </Card>
        </div>

      </form>
    </Form>
  );
}
