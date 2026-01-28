import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { firestoreService } from "@/lib/firestore-service";
import { GetCustomerOutstandingRequest, CustomerOutstandingResult, OutstandingInvoiceInfo } from "@/types/ai-tools";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { customerId } = body as GetCustomerOutstandingRequest;

    if (!customerId) {
        return errorResponse("Customer ID is required");
    }

    const customer = await firestoreService.getCustomerById(customerId, user);
    if (!customer) {
        return errorResponse("Customer not found", 404);
    }

    // Get unpaid invoices
    const allInvoices = await firestoreService.getInvoices(user);
    const customerInvoices = allInvoices.filter(inv => 
        inv.customerId === customerId && 
        (inv.balanceAmount ?? inv.total) > 0.01 // Positive balance
    );

    const mappedInvoices: OutstandingInvoiceInfo[] = customerInvoices.map(inv => {
        const dueDate = new Date(inv.dueDate);
        const now = new Date();
        const diffTime = now.getTime() - dueDate.getTime();
        const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        return {
            invoiceNumber: inv.invoiceNumber,
            totalAmount: inv.total,
            paidAmount: inv.paidAmount || 0,
            balanceAmount: inv.balanceAmount ?? inv.total,
            dueDate: inv.dueDate,
            daysOverdue: daysOverdue > 0 ? daysOverdue : 0
        };
    }).sort((a,b) => b.daysOverdue - a.daysOverdue); // Most overdue first

    const result: CustomerOutstandingResult = {
        customerId,
        customerName: customer.name,
        totalOutstanding: customer.totalOutstanding || 0,
        invoices: mappedInvoices
    };

    return successResponse(result);

  } catch (error: any) {
    console.error("Error in get-customer-outstanding:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
