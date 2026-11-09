import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { adminService } from "@/lib/admin-service";
import { AddStockRequest, AddStockResult } from "@/types/ai-tools";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { productId, quantity, source, unitCost, notes } = body as AddStockRequest;

    if (!productId || !quantity || quantity <= 0) {
        return errorResponse("Product ID and positive Quantity are required");
    }

    if (unitCost !== undefined && (typeof unitCost !== "number" || unitCost < 0)) {
        return errorResponse("unitCost must be a non-negative number");
    }

    const product = await adminService.getProductById(productId, user);
    if (!product) {
        return errorResponse("Product not found", 404);
    }

    // Map the API's `source` onto the inventory ledger's transaction types.
    const transactionType =
        source === "production" ? "production" :
        source === "return" ? "return_customer" :
        "adjustment";

    // One atomic transaction: updates stockQuantity, the weighted-average cost
    // (when unitCost is given) and writes an inventory_transactions record.
    // The selling price is never modified.
    const transactionId = await adminService.addInventoryTransaction({
        productId,
        productName: product.name,
        sku: product.sku,
        transactionType,
        quantity, // positive = stock in
        unitCost,
        referenceType: "Manual",
        notes: notes || `Stock added via API (${source || "adjustment"})`,
    }, user);

    const updated = await adminService.getProductById(productId, user);

    const result: AddStockResult = {
        productName: product.name,
        quantityAdded: quantity,
        newStockLevel: updated?.stockQuantity ?? (product.stockQuantity || 0) + quantity,
        transactionId,
    };

    return successResponse(result);

  } catch (error: any) {
    console.error("Error in add-stock:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
