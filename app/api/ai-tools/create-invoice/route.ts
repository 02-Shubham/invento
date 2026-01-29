import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { firestoreService } from "@/lib/firestore-service"; // We might need to extend this service or write direct firestore code for transactions if methods are missing
import { CreateInvoiceRequest, InvoiceResult } from "@/types/ai-tools";
import { db } from "@/lib/firebase";
import { collection, doc, runTransaction, Timestamp } from "firebase/firestore";

// Re-implementing logic here to ensure it matches the AI tool requirements strictly,
// although firestoreService has `createInvoiceWithStockUpdate`.
// The AI tool requirements ask for specific error format and checks.
// It's safer to reuse `firestoreService` if possible, but for strict customized response/error handling
// and keeping all AI logic isolated, I will implement the transaction here using the same pattern.
// actually, firestoreService.createInvoiceWithStockUpdate logic is almost identical. 
// Let's reuse it but wrap it to match the API response format.

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { customerId, items, notes } = body as CreateInvoiceRequest;

    if (!customerId || !items || items.length === 0) {
      return errorResponse("Customer ID and Items are required");
    }

    // 1. Validate Customer
    const customer = await firestoreService.getCustomerById(customerId, user);
    if (!customer) {
        return errorResponse("Customer not found");
    }

    // 2. Prepare Invoice Data
    // We need to fetch product details to calculate totals.
    // However, `createInvoiceWithStockUpdate` expects an Invoice object.
    // The AI Request only has { productId, quantity }.
    // So we need to reconstruct the full invoice object first.
    
    // We can do this verification + object construction here.
    const allProducts = await firestoreService.getProducts(user);
    const invoiceItems = [];
    let subtotal = 0;

    for (const item of items) {
        const product = allProducts.find(p => p.id === item.productId);
        if (!product) {
            return errorResponse(`Product not found: ${item.productId}`);
        }
        if ((product.stockQuantity || 0) < item.quantity) {
             return NextResponse.json({
                success: false,
                error: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Needed: ${item.quantity}`
             }, { status: 200 }); // Returning 200 as per pattern
        }

        const lineTotal = (product.price || 0) * item.quantity;
        subtotal += lineTotal;
        
        invoiceItems.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            productId: product.id,
            name: product.name,
            quantity: item.quantity,
            price: product.price || 0,
            total: lineTotal
        });
    }

    const total = subtotal; // Tax implementation if needed later
    
    // Generate Invoice Number (Simple timestamp based for now, or fetch last)
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const newInvoiceData: any = {
        invoiceNumber,
        customerId,
        customerName: customer.name,
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        items: invoiceItems,
        subtotal,
        tax: 0,
        total,
        balanceAmount: total,
        paidAmount: 0,
        status: 'unpaid',
        notes: notes || "",
        createdAt: new Date(),
        updatedAt: new Date(),
        invoiceDate: new Date()
    };

    // 2. Execute Transaction
    // We reuse the service which handles: Stock Check (redundant but safe), Stock Deduct, Transaction Log, Invoice Create.
    // Note: The service might throw if stock changed in between. Catch that.
    
    try {
        const invoiceId = await firestoreService.createInvoiceWithStockUpdate(newInvoiceData, user);
        
        // 3. Update Customer Stats (Not handled by createInvoiceWithStockUpdate in service yet? - Checking service...)
        // Checking `lib/firestore-service.ts`: createInvoiceWithStockUpdate checks stock, creates invoice, logs txn.
        // It DOES NOT update customer stats (`totalSpent`, `totalInvoices`, `totalOutstanding`).
        // We should add that here.
        
        await firestoreService.updateCustomerStats(customerId, total, user);
        // Also update outstanding? updateCustomerStats implementation:
        // totalSpent += total, totalInvoices += 1.
        // It does NOT update `totalOutstanding`. We need to do that manually or fix the service.
        // Let's do it manually here to be safe.
        
        // Wait, updateCustomerStats is separate. Let's fix outstanding.
        // Actually, let's just use `updateDoc` for now since we are outside the main transaction.
        // Ideally should be in one transaction but firestoreService splits them.
        // Given the constraints, I'll update it separately.
        const currentOutstanding = customer.totalOutstanding || 0;
        await firestoreService.updateCustomer(customerId, {
            totalOutstanding: currentOutstanding + total
        }, user);


        const result: InvoiceResult = {
            invoiceId,
            invoiceNumber,
            customerName: customer.name,
            totalAmount: total,
            balanceAmount: total,
            itemsCount: items.length,
            stockUpdated: true,
            pdfUrl: `/api/invoices/${invoiceId}/pdf` // Placeholder
        };

        return successResponse(result);

    } catch (txError: any) {
        return errorResponse(txError.message || "Transaction failed");
    }

  } catch (error: any) {
    console.error("Error in create-invoice:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
