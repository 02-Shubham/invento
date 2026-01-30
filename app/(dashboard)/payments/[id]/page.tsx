"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2, CalendarIcon, CreditCard, User, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { firestoreService } from "@/lib/firestore-service";
import { Payment } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function PaymentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [payment, setPayment] = useState<Payment | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id && user) {
            loadPayment(params.id as string, user.uid);
        }
    }, [params.id, user]);

    const loadPayment = async (id: string, userId: string) => {
        try {
            const data = await firestoreService.getPaymentById(id, userId);
            setPayment(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load payment");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!payment || !user) return;
        try {
            await firestoreService.deletePayment(payment.id, user.uid);
            toast.success("Payment deleted successfully");
            router.push("/payments");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete payment");
        }
    };

    if (loading) return <div className="p-8 text-center">Loading payment...</div>;
    if (!payment) return <div className="p-8 text-center">Payment not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{payment.paymentNumber}</h1>
                    <p className="text-muted-foreground">
                        Recorded on {format(payment.createdAt, "MMMM d, yyyy")}
                    </p>
                </div>
                <div className="ml-auto flex gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Payment
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action will permanently delete this payment record.
                                    Any amounts applied to invoices will be reversed, and invoice statuses will be updated.
                                    This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <User className="h-4 w-4" /> Customer
                                </div>
                                <div className="font-medium text-lg">
                                    <Link href={`/customers/${payment.customerId}`} className="hover:underline text-primary">
                                        {payment.customerName}
                                    </Link>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" /> Amount
                                </div>
                                <div className="font-bold text-2xl text-green-600">
                                    {formatCurrency(payment.amount)}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                     Method
                                </div>
                                <div className="capitalize">
                                    {payment.paymentMethod.replace("_", " ")}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4" /> Payment Date
                                </div>
                                <div>
                                    {payment.paymentDate ? format(payment.paymentDate, "MMM d, yyyy") : "N/A"}
                                </div>
                            </div>
                            {payment.referenceNumber && (
                                <div className="space-y-1 col-span-2">
                                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        Reference #
                                    </div>
                                    <div className="font-mono bg-muted p-1 rounded w-fit px-2">
                                        {payment.referenceNumber}
                                    </div>
                                </div>
                            )}
                            {payment.notes && (
                                <div className="space-y-1 col-span-2">
                                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        Notes
                                    </div>
                                    <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-md">
                                        {payment.notes}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Applied Applications</CardTitle>
                        <CardDescription>
                            How this payment was distributed across invoices
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead className="text-right">Amount Applied</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payment.appliedTo && payment.appliedTo.length > 0 ? (
                                    payment.appliedTo.map((app, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">
                                                <Link href={`/invoices/${app.invoiceId}`} className="hover:underline">
                                                    {app.invoiceNumber}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(app.amountApplied)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                            Not applied to any invoices (Credit)
                                        </TableCell>
                                    </TableRow>
                                )}
                                <TableRow className="bg-muted/50 font-medium">
                                    <TableCell>Total Applied</TableCell>
                                    <TableCell className="text-right">
                                        {formatCurrency(payment.appliedTo?.reduce((s, a) => s + a.amountApplied, 0) || 0)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
