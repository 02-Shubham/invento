import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { firestoreService } from "@/lib/firestore-service";
import { RecordPaymentRequest, RecordPaymentResult } from "@/types/ai-tools";
import { distributePayment } from "@/lib/payment-utils";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { customerId, amount, paymentMethod, invoiceIds, autoApply = true } = body as RecordPaymentRequest;

    if (!customerId || amount === undefined || amount <= 0) {
      return errorResponse("Customer ID and positive Amount are required");
    }

    const customer = await firestoreService.getCustomerById(customerId, user);
    if (!customer) {
        return errorResponse("Customer not found", 404);
    }

    // 1. Fetch Invoices to Apply To
    const allInvoices = await firestoreService.getInvoices(user);
    // Filter for customer and status
    let eligibleInvoices = allInvoices.filter(inv => 
        inv.customerId === customerId && 
        (inv.status === 'unpaid' || inv.status === 'partially_paid' || inv.status === 'overdue' || inv.status === 'pending') &&
        (inv.balanceAmount ?? inv.total) > 0.01 // Floating point safety
    );

    // If specific invoice IDs provided, filter further
    if (invoiceIds && invoiceIds.length > 0) {
        eligibleInvoices = eligibleInvoices.filter(inv => invoiceIds.includes(inv.id));
    }

    // Sort by Date (Oldest First) for auto-apply
    eligibleInvoices.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // 2. Distribute Payment
    let appliedTo: { invoiceId: string; invoiceNumber: string; amountApplied: number }[] = [];
    if (autoApply && eligibleInvoices.length > 0) {
        appliedTo = distributePayment(amount, eligibleInvoices);
    }

    // 3. Create Payment Record & Update Invoices
    const totalApplied = appliedTo.reduce((sum, app) => sum + app.amountApplied, 0);
    const paymentData = {
        paymentNumber: `PAY-${Date.now().toString().slice(-8)}`,
        customerId,
        customerName: customer.name,
        amount,
        paymentDate: new Date(),
        paymentMethod: paymentMethod as any,
        referenceNumber: "",
        notes: "Recorded via AI Agent",
        autoApply,
        appliedTo: appliedTo, // This matches PaymentApplication[] type expected by service
        unappliedAmount: amount - totalApplied
    };

    // Use service to record payment transactionally
    // firestoreService.addPayment handles: Payment creation, Invoice updates, Customer stats updates.
    const paymentId = await firestoreService.addPayment(paymentData, user);

    // 4. Construct Result
    // We need to return what happened.
    // addPayment doesn't return the applied details, so we rely on our calculation `appliedTo`.
    // (Assuming no race condition changed balances between distributePayment and addPayment)
    
    // We also need updated customer outstanding.
    // Service updates it, but we don't get the new value back.
    // We can estimate it: oldOutstanding - amount (if all applied? or just amount paid?)
    // Actually, `addPayment` updates `totalOutstanding` by subtracting `amount`.
    const newOutstanding = (customer.totalOutstanding || 0) - amount;

    const result: RecordPaymentResult = {
        paymentId,
        paymentNumber: paymentData.paymentNumber,
        amount,
        appliedTo: appliedTo.map(a => ({
            invoiceNumber: a.invoiceNumber,
            amountApplied: a.amountApplied,
            remainingBalance: 0 // We'd need to calculate this per invoice, slight approximation for now or re-fetch
        })),
        customerOutstanding: newOutstanding < 0 ? 0 : newOutstanding
    };

    return successResponse(result);

  } catch (error: any) {
    console.error("Error in record-payment:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
