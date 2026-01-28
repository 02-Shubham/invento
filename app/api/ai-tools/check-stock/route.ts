import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { firestoreService } from "@/lib/firestore-service";
import { CheckStockRequest, StockCheckResult } from "@/types/ai-tools";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { productId, quantityNeeded } = body as CheckStockRequest;

    if (!productId || quantityNeeded === undefined || quantityNeeded <= 0) {
      return errorResponse("Valid Product ID and Quantity Needed are required");
    }

    const product = await firestoreService.getProductById(productId, user);

    if (!product) {
        return errorResponse("Product not found", 404);
    }

    const currentStock = product.stockQuantity || 0;
    const available = currentStock >= quantityNeeded;
    const shortfall = available ? 0 : quantityNeeded - currentStock;

    const result: StockCheckResult = {
        available,
        currentStock,
        quantityNeeded,
        shortfall: available ? undefined : shortfall,
        productName: product.name
    };

    if (!available) {
        // Return success=false but with data explaining why (as per spec example alternative, 
        // OR success=true with available=false data. 
        // Example in prompt showed success: false for insufficient stock.
        // But usually tools should return success: true with "available: false" so the AI doesn't crash on HTTP error.
        // However, prompt spec says:
        /*
        {
          "success": false,
          "error": "Insufficient stock",
          "data": { ... }
        }
        */
       // I'll follow the prompt, but returning data in error response is slightly unusual for some clients.
       // My helper errorResponse supports details.
       
       return NextResponse.json({
           success: false,
           error: "Insufficient stock",
           data: result
       }, { status: 200 }); // Status 200 so AI can read the structured logic, or should I use 400? 
       // Often AI tools prefer 200 with logical error. I will use 200.
    }

    return successResponse(result);

  } catch (error: any) {
    console.error("Error in check-stock:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
