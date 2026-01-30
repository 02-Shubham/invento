"use client";

import { useStore } from "@/lib/store";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoicePDF } from "@/components/invoices/InvoicePDF";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { ArrowLeft, Download, Trash2, RefreshCw, CreditCard, Plus } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { firestoreService } from "@/lib/firestore-service";
import { Invoice, Payment } from "@/types";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useAuth } from "@/lib/auth-context";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { settings } = useStore(); // Keep settings from store for PDF
  const { user } = useAuth();
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoiceAndPayments() {
        if (!id || Array.isArray(id) || !user) return;
        try {
            setIsLoading(true);
            const fetchedInvoice = await firestoreService.getInvoiceById(id, user.uid);
            if (fetchedInvoice) {
                setInvoice(fetchedInvoice);
                
                // Fetch associated payments
                if (fetchedInvoice.payments && fetchedInvoice.payments.length > 0) {
                    const paymentPromises = fetchedInvoice.payments.map(pid => firestoreService.getPaymentById(pid, user.uid));
                    const fetchedPayments = await Promise.all(paymentPromises);
                    // Filter out nulls in case a payment was deleted but not removed from invoice ref (shouldn't happen with correct transaction logic)
                    setPayments(fetchedPayments.filter(p => p !== null) as Payment[]);
                }
            } else {
                toast.error("Invoice not found");
                router.push("/invoices");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch invoice details");
        } finally {
            setIsLoading(false);
        }
    }
    if (user && id) {
        fetchInvoiceAndPayments();
    }
  }, [id, router, user]);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center p-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  if (!invoice) {
    return <div>Invoice not found</div>;
  }

  const handleDelete = async () => {
    if (!user) return;
    if (confirm("Are you sure you want to delete this invoice?")) {
        try {
            await firestoreService.deleteInvoice(invoice.id, user.uid);
            toast.success("Invoice deleted");
            router.push("/invoices");
        } catch (error) {
            toast.error("Failed to delete invoice");
        }
    }
  };

  // Safe check for items being array vs object (legacy) or missing
  const invoiceItems = Array.isArray(invoice.items) 
    ? invoice.items 
    : invoice.items ? Object.values(invoice.items) : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
            <Badge
                variant={
                invoice.status === "paid"
                    ? "default"
                    : invoice.status === "partially_paid" // Handle new status
                    ? "outline" // or distinctive color
                    : invoice.status === "pending"
                    ? "secondary"
                    : "destructive"
                }
                className={
                    invoice.status === "paid" ? "bg-green-600" : 
                    invoice.status === "partially_paid" ? "bg-blue-500 text-white border-transparent" :
                    invoice.status === "pending" ? "bg-amber-500 text-white" : ""
                }
            >
                {invoice.status.toUpperCase().replace("_", " ")}
            </Badge>
        </div>
        <div className="flex space-x-2">
            <Link href={`/payments/new?customerId=${invoice.customerId}`}>
                 <Button variant="outline">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Record Payment
                 </Button>
            </Link>
            <Button variant="destructive" size="icon" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
            </Button>
            
            <PDFDownloadLink
                document={<InvoicePDF invoice={invoice} settings={settings} />}
                fileName={`invoice-${invoice.invoiceNumber}.pdf`}
            >
                {/* @ts-ignore */}
                {({ loading }) => (
                    <Button disabled={loading}>
                        <Download className="mr-2 h-4 w-4" />
                        {loading ? "Generating..." : "Download PDF"}
                    </Button>
                )}
            </PDFDownloadLink>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
          <Card className="col-span-2">
            <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h3 className="font-semibold text-sm text-muted-foreground">From</h3>
                         <div className="mt-1">
                            <p className="font-medium">{settings?.businessName || "Your Company"}</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{settings?.businessAddress}</p>
                            <p className="text-sm text-muted-foreground">{settings?.businessEmail}</p>
                            <p className="text-sm text-muted-foreground">{settings?.businessPhone}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-muted-foreground">Bill To</h3>
                         <div className="mt-1">
                            <p className="font-medium">{invoice.customerName}</p>
                             <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.customerAddress}</p>
                            <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                     <div>
                        <h3 className="font-semibold text-sm text-muted-foreground">Invoice Date</h3>
                        <p>{format(invoice.createdAt, "MMM d, yyyy")}</p>
                    </div>
                     <div>
                        <h3 className="font-semibold text-sm text-muted-foreground">Due Date</h3>
                        <p>{format(invoice.dueDate, "MMM d, yyyy")}</p>
                    </div>
                     <div>
                        <h3 className="font-semibold text-sm text-muted-foreground">Terms</h3>
                        <p>{settings?.defaultPaymentTerms || "Due on Receipt"}</p>
                    </div>
                </div>
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
                <CardTitle>Payment Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                     <span className="text-muted-foreground">Total Amount</span>
                     <span className="font-bold text-lg">{formatCurrency(invoice.total)}</span>
                </div>
                 <div className="flex justify-between items-center pb-2 border-b text-green-600">
                     <span className="font-medium">Amount Paid</span>
                     <span className="font-bold">{formatCurrency(invoice.paidAmount || 0)}</span>
                </div>
                 <div className="flex justify-between items-center pt-2">
                     <span className="font-medium text-muted-foreground">Balance Due</span>
                     <span className="font-bold text-xl text-red-600">{formatCurrency(invoice.balanceAmount ?? invoice.total)}</span>
                </div>
            </CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoiceItems.map((item: any, index: number) => (
                        <TableRow key={index}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.price * item.quantity)}</TableCell>
                        </TableRow>
                    ))}
                    <TableRow>
                        <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.subtotal || 0)}</TableCell>
                    </TableRow>
                     <TableRow>
                        <TableCell colSpan={3} className="text-right font-medium">Tax</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.tax || 0)}</TableCell>
                    </TableRow>
                     <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold text-lg">Total</TableCell>
                        <TableCell className="text-right font-bold text-lg">{formatCurrency(invoice.total)}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
       {payments.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Payment #</TableHead>
                            <TableHead>Method</TableHead>
                             <TableHead>Reference</TableHead>
                             <TableHead className="text-right">Amount Applied</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => {
                            // Find the amount applied specifically to this invoice
                            const application = payment.appliedTo?.find(app => app.invoiceId === invoice.id);
                            const appliedAmount = application ? application.amountApplied : 0;

                            return (
                                <TableRow key={payment.id}>
                                    <TableCell>{format(payment.paymentDate, "MMM d, yyyy")}</TableCell>
                                    <TableCell>
                                        <Link href={`/payments/${payment.id}`} className="hover:underline text-primary">
                                            {payment.paymentNumber}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="capitalize">{payment.paymentMethod.replace("_", " ")}</TableCell>
                                    <TableCell>{payment.referenceNumber || "-"}</TableCell>
                                    <TableCell className="text-right font-medium text-green-600">
                                        {formatCurrency(appliedAmount)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
       )}

      {invoice.inventoryLog && invoice.inventoryLog.length > 0 && (
         <Card>
            <CardHeader>
                 <CardTitle className="text-sm font-medium">Inventory Log</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="text-sm text-muted-foreground space-y-1">
                    {invoice.inventoryLog.map((log: string, i: number) => (
                        <div key={i} className="flex gap-2">
                             <span className="text-gray-400">•</span>
                             <span>{log}</span>
                        </div>
                    ))}
                 </div>
            </CardContent>
         </Card>
      )}
    </div>
  );
}
