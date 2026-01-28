"use client";

import { useStore } from "@/lib/store";
import { useForm, useFieldArray } from "react-hook-form";
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
import { CalendarIcon, Loader2, Check, ChevronDown, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { firestoreService } from "@/lib/firestore-service";
import { Product, Customer, Invoice, PaymentApplication } from "@/types";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { distributePayment } from "@/lib/payment-utils";
import { useAuth } from "@/lib/auth-context";

const paymentSchema = z.object({
    customerId: z.string().min(1, "Customer is required"),
    paymentDate: z.date(),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Amount must be greater than 0",
    }),
    paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other']),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
    autoApply: z.boolean().default(true),
    applications: z.array(z.object({
        invoiceId: z.string(),
        invoiceNumber: z.string(),
        amountApplied: z.number().min(0)
    })).optional()
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export function CreatePaymentForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preSelectedInvoiceId = searchParams.get('invoiceId');
    const preSelectedCustomerId = searchParams.get('customerId');


    const { user } = useAuth(); // Get authenticated user

    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
    const [openCustomer, setOpenCustomer] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            customerId: "",
            paymentDate: new Date(),
            amount: "",
            paymentMethod: "cash",
            referenceNumber: "",
            notes: "",
            autoApply: true,
            applications: []
        },
    });

    // Load Customers
    useEffect(() => {
        const loadCustomers = async () => {
            if (!user) return; // Wait for user
            try {
                const data = await firestoreService.getCustomers(user.uid);
                setCustomers(data);

                if (preSelectedCustomerId) {
                     const customer = data.find(c => c.id === preSelectedCustomerId);
                     if (customer) handleCustomerSelect(customer);
                }
            } catch (error) {
                toast.error("Failed to load customers");
            }
        };
        if (user) {
            loadCustomers();
        }
    }, [preSelectedCustomerId, user]);

    const handleCustomerSelect = async (customer: Customer) => {
        if (!user) return;
        setSelectedCustomer(customer);
        form.setValue("customerId", customer.id);
        setOpenCustomer(false);
        
        // Fetch Unpaid Invoices
        try {
            const allInvoices = await firestoreService.getInvoices(user.uid);
            // Filter locally for simplicity (better: query by status & customer)
            const unpaid = allInvoices.filter(inv => 
                inv.customerId === customer.id && 
                (inv.status === 'unpaid' || inv.status === 'partially_paid' || inv.status === 'overdue' || inv.status === 'pending') &&
                (inv.balanceAmount > 0.01 || (inv.balanceAmount === undefined && inv.total > 0)) // Handle migration
            );
            
            // Normalize balance if needed
            const normalized = unpaid.map(inv => ({
                ...inv,
                balanceAmount: inv.balanceAmount ?? inv.total
            }));

            setCustomerInvoices(normalized.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch customer invoices");
        }
    };

    // Auto-Apply Logic
    const amount = form.watch("amount");
    const autoApply = form.watch("autoApply");

    useEffect(() => {
        if (!autoApply || !amount || !customerInvoices.length) return;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) return;

        const applications = distributePayment(numAmount, customerInvoices);
        form.setValue("applications", applications); // Just for submission
        
        // We calculate UI display based on inputs, so form.applications is mostly for submission
        // But for Auto mode, we want to show what WILL happen
    }, [amount, autoApply, customerInvoices]);


    // Manual Input Handling
    const handleManualApply = (invoiceId: string, val: string) => {
        const currentApps = form.getValues("applications") || [];
        const numVal = parseFloat(val) || 0;
        
        const existingIndex = currentApps.findIndex(a => a.invoiceId === invoiceId);
        const invoice = customerInvoices.find(i => i.id === invoiceId);
        if(!invoice) return;

        const newApps = [...currentApps];
        if (numVal > 0) {
            const app = {
                invoiceId,
                invoiceNumber: invoice.invoiceNumber,
                amountApplied: numVal
            };
            if (existingIndex >= 0) newApps[existingIndex] = app;
            else newApps.push(app);
        } else {
             if (existingIndex >= 0) newApps.splice(existingIndex, 1);
        }
        
        form.setValue("applications", newApps);
    };

    const onSubmit = async (data: PaymentFormValues) => {
        if (!user) return;
        setLoading(true);
        try {
            const paymentData = {
                ...data,
                amount: parseFloat(data.amount),
                customerName: selectedCustomer?.name || "",
                customerId: data.customerId,
                appliedTo: data.applications || []
            };

            // Validation: manual vs total
            const totalApplied = paymentData.appliedTo.reduce((sum, a) => sum + a.amountApplied, 0);
            if (totalApplied > paymentData.amount + 0.01) {
                toast.error("Total applied amount cannot exceed payment amount");
                setLoading(false);
                return;
            }

            // Add generated payment number
            const finalPaymentData = {
                ...paymentData,
                paymentNumber: `PAY-${Date.now().toString().slice(-8)}`,
            };

            await firestoreService.addPayment(finalPaymentData, user.uid);
            toast.success("Payment recorded successfully");
            router.push("/payments");
        } catch (error: any) {
            console.error("Payment Submission Error:", error);
            const errorMessage = error?.message || "Failed to record payment";
            toast.error(`Error: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    // Calculate totals for UI
    const currentApplications = form.watch("applications") || [];
    const totalApplied = currentApplications.reduce((sum, app) => sum + app.amountApplied, 0);
    const unapplied = Math.max(0, (parseFloat(amount) || 0) - totalApplied);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Customer Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="customerId"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Customer</FormLabel>
                                        <Popover open={openCustomer} onOpenChange={setOpenCustomer}>
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
                                                                    onSelect={() => handleCustomerSelect(customer)}
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
                                    </FormItem>
                                )}
                            />

                            {selectedCustomer && (
                                <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Total Outstanding:</span>
                                        <span className="font-bold text-red-500">{formatCurrency(selectedCustomer.totalOutstanding || 0)}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">{selectedCustomer.email}</div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Payment Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="paymentDate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Date</FormLabel>
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
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="paymentMethod"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Method</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select method" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="cash">Cash</SelectItem>
                                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                    <SelectItem value="cheque">Cheque</SelectItem>
                                                    <SelectItem value="upi">UPI</SelectItem>
                                                    <SelectItem value="card">Card</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="referenceNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Reference #</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Optional" {...field} />
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
                                            <Textarea placeholder="Optional notes" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Applications */}
                {selectedCustomer && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Unpaid Invoices</CardTitle>
                            <FormField
                                control={form.control}
                                name="autoApply"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-2">
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Auto-apply to oldest
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead className="w-[150px] text-right">Apply Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customerInvoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                No unpaid invoices found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        customerInvoices.map(invoice => {
                                            const applied = currentApplications.find(a => a.invoiceId === invoice.id)?.amountApplied || 0;
                                            const balance = invoice.balanceAmount ?? invoice.total;
                                            
                                            return (
                                                <TableRow key={invoice.id}>
                                                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                                    <TableCell>{format(invoice.dueDate, "MMM d, yyyy")}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(invoice.paidAmount || 0)}</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(balance)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Input 
                                                            type="number" 
                                                            className="text-right h-8"
                                                            value={applied > 0 ? applied : ''}
                                                            placeholder="0.00"
                                                            readOnly={autoApply}
                                                            onChange={(e) => handleManualApply(invoice.id, e.target.value)}
                                                            max={balance}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex justify-end gap-x-6 border-t pt-4">
                                <div className="text-sm">
                                    Total Payment: <span className="font-bold">{formatCurrency(parseFloat(amount) || 0)}</span>
                                </div>
                                <div className="text-sm">
                                    Applied: <span className="font-bold text-green-600">{formatCurrency(totalApplied)}</span>
                                </div>
                                <div className="text-sm">
                                    Unapplied (Credit): <span className="font-bold text-amber-600">{formatCurrency(unapplied)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="flex justify-end gap-4">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Record Payment
                    </Button>
                </div>
            </form>
        </Form>
    );
}
