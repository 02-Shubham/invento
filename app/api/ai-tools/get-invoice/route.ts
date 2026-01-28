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
    const { invoiceId } = body;

    if (!invoiceId) {
      return errorResponse("Invoice ID is required");
    }

    const invoice = await firestoreService.getInvoiceById(invoiceId, user);

    if (!invoice) {
        return errorResponse("Invoice not found", 404);
    }

    return successResponse({
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        items: invoice.items,
        totalAmount: invoice.total,
        paidAmount: invoice.paidAmount || 0,
        balanceAmount: invoice.balanceAmount ?? invoice.total,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate
    });

  } catch (error: any) {
    console.error("Error in get-invoice:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
