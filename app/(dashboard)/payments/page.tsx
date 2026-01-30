"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { firestoreService } from "@/lib/firestore-service";
import { Payment } from "@/types";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

import { useAuth } from "@/lib/auth-context";

export default function PaymentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
        fetchPayments(user.uid);
    }
  }, [user]);

  const fetchPayments = async (userId: string) => {
    try {
      const data = await firestoreService.getPayments(userId);
      setPayments(data);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((payment) =>
    payment.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    payment.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (payment.referenceNumber && payment.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">
            Track and manage customer payments.
          </p>
        </div>
        <Button onClick={() => router.push("/payments/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalCollected)}</div>
                  <p className="text-xs text-muted-foreground">
                      Across all time
                  </p>
              </CardContent>
          </Card>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by payment #, customer, or ref..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((payment) => (
                <TableRow 
                    key={payment.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/payments/${payment.id}`)}
                >
                  <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                  <TableCell>
                    {payment.paymentDate ? format(payment.paymentDate, "MMM d, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell>{payment.customerName}</TableCell>
                  <TableCell className="capitalize">
                      {payment.paymentMethod.replace('_', ' ')}
                  </TableCell>
                  <TableCell>{payment.referenceNumber || "-"}</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
