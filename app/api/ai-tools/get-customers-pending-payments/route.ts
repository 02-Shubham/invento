import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { firestoreService } from "@/lib/firestore-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { limit = 10 } = body;

    // Get all invoices for the user
    const allInvoices = await firestoreService.getInvoices(user);

    // Filter for unpaid/partially paid/overdue invoices
    const unpaidInvoices = allInvoices.filter(invoice => 
      invoice.status === 'unpaid' || 
      invoice.status === 'partially_paid' || 
      invoice.status === 'overdue'
    );

    // Group by customer and calculate totals
    const customerMap = new Map<string, {
      customerId: string;
      customerName: string;
      customerEmail: string;
      totalOutstanding: number;
      invoiceCount: number;
      oldestInvoiceDate: Date;
    }>();

    for (const invoice of unpaidInvoices) {
      const customerId = invoice.customerId || 'unknown';
      const outstanding = invoice.balanceAmount || invoice.total;

      if (customerMap.has(customerId)) {
        const existing = customerMap.get(customerId)!;
        existing.totalOutstanding += outstanding;
        existing.invoiceCount += 1;
        
        // Update oldest invoice date if this one is older
        const invoiceDate = new Date(invoice.createdAt);
        if (invoiceDate < existing.oldestInvoiceDate) {
          existing.oldestInvoiceDate = invoiceDate;
        }
      } else {
        customerMap.set(customerId, {
          customerId,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          totalOutstanding: outstanding,
          invoiceCount: 1,
          oldestInvoiceDate: new Date(invoice.createdAt)
        });
      }
    }

    // Convert to array and sort by outstanding amount (descending)
    const customers = Array.from(customerMap.values())
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, limit);

    return successResponse({
      customers,
      totalCustomersWithPendingPayments: customers.length
    });

  } catch (error: any) {
    console.error("Error in get-customers-pending-payments:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
