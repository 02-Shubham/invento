"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { firestoreService } from "@/lib/firestore-service";
import { Customer, Invoice, Payment } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
    Loader2, 
    ArrowLeft, 
    Mail, 
    Phone, 
    MapPin, 
    ExternalLink, 
    FileText, 
    DollarSign,
    Calendar,
    ShoppingBag,
    CreditCard
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const customerId = params.id as string;

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
             setIsLoading(true);
            try {
                // 1. Fetch Customer
                const customerData = await firestoreService.getCustomerById(customerId);
                if (!customerData) {
                    toast.error("Customer not found");
                    router.push("/customers");
                    return;
                }
                setCustomer(customerData);

                // 2. Fetch Invoices
                const allInvoices = await firestoreService.getInvoices();
                const customerInvoices = allInvoices
                    .filter(inv => inv.customerId === customerId)
                    .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
                setInvoices(customerInvoices);

                // 3. Fetch Payments
                const customerPayments = await firestoreService.getCustomerPayments(customerId);
                setPayments(customerPayments.sort((a,b) => b.paymentDate.getTime() - a.paymentDate.getTime()));

            } catch (error) {
                console.error("Error loading customer data", error);
                toast.error("Failed to load customer data");
            } finally {
                setIsLoading(false);
            }
        };

        if (customerId) {
            loadData();
        }
    }, [customerId, router]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!customer) return null;

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            {/* Header / Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <div>
                         <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
                         {customer.company && <p className="text-muted-foreground">{customer.company}</p>}
                    </div>
                </div>
                <div className="flex space-x-2">
                    <Button variant="outline" onClick={() => router.push(`/customers?edit=${customerId}`)}>
                        Edit Customer
                    </Button>
                    <Link href={`/payments/new?customerId=${customerId}`}>
                         <Button variant="outline">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Record Payment
                         </Button>
                    </Link>
                    <Button onClick={() => router.push(`/invoices/new?customerId=${customerId}`)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Create Invoice
                    </Button>
                </div>
            </div>

            {/* Info and Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Contact Info */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Contact Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                            <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
                        </div>
                        <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                             <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
                        </div>
                        <div className="flex items-start">
                             <MapPin className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                             <span className="whitespace-pre-wrap">{customer.address}</span>
                        </div>
                         {customer.taxId && (
                            <div className="pt-2">
                                <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Tax ID</span>
                                <p>{customer.taxId}</p>
                            </div>
                         )}
                    </CardContent>
                </Card>

                {/* Stats */}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                            <DollarSign className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {formatCurrency(customer.totalOutstanding || 0)}
                            </div>
                             <p className="text-xs text-muted-foreground">
                                Pending payments
                             </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(customer.totalSpent)}</div>
                             <p className="text-xs text-muted-foreground">
                                Lifetime value
                             </p>
                        </CardContent>
                    </Card>
                    
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{customer.totalInvoices}</div>
                             <p className="text-xs text-muted-foreground">
                                Orders placed
                             </p>
                        </CardContent>
                    </Card>
            
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Last Order</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {customer.lastOrderDate ? format(customer.lastOrderDate, "MMM d") : "-"}
                            </div>
                             <p className="text-xs text-muted-foreground">
                                {customer.lastOrderDate ? format(customer.lastOrderDate, "yyyy") : ""}
                             </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Invoices and Payments Tabs */}
            <Tabs defaultValue="invoices" className="w-full">
                <TabsList>
                    <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
                    <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="invoices" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Invoice History</CardTitle>
                            <CardDescription>Recent invoices generated for this customer.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No invoices found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        invoices.map((inv) => (
                                            <TableRow key={inv.id}>
                                                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                                                <TableCell>{format(inv.createdAt, "MMM d, yyyy")}</TableCell>
                                                <TableCell>
                                                     <Badge
                                                        variant={
                                                        inv.status === "paid"
                                                            ? "default"
                                                            : inv.status === "partially_paid"
                                                            ? "outline"
                                                            : inv.status === "pending"
                                                            ? "secondary"
                                                            : "destructive"
                                                        }
                                                        className={
                                                            inv.status === "paid" ? "bg-green-600" : 
                                                            inv.status === "partially_paid" ? "bg-blue-500 text-white border-transparent" :
                                                            inv.status === "pending" ? "bg-amber-500 text-white" : ""
                                                        }
                                                    >
                                                        {inv.status.toUpperCase().replace("_", " ")}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(inv.total)}</TableCell>
                                                <TableCell className="text-right font-medium text-red-600">
                                                    {formatCurrency(inv.balanceAmount ?? inv.total)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={`/invoices/${inv.id}`}>
                                                        <Button variant="ghost" size="sm">
                                                            View
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="payments" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Payment History</CardTitle>
                            <CardDescription>Payments received from this customer.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Payment #</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No payments found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        payments.map((payment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell>{format(payment.paymentDate, "MMM d, yyyy")}</TableCell>
                                                <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                                                <TableCell className="capitalize">{payment.paymentMethod.replace("_", " ")}</TableCell>
                                                <TableCell>{payment.referenceNumber || "-"}</TableCell>
                                                <TableCell className="text-right font-bold text-green-600">
                                                    {formatCurrency(payment.amount)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={`/payments/${payment.id}`}>
                                                        <Button variant="ghost" size="sm">
                                                            View
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
