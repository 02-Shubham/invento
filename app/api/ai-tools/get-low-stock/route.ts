import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { firestoreService } from "@/lib/firestore-service";
import { GetLowStockRequest, LowStockProductResult } from "@/types/ai-tools";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { threshold = 10 } = body as GetLowStockRequest; // Default threshold 10 if not provided

    const allProducts = await firestoreService.getProducts(user);
    
    // Filter and sort
    const lowStockProducts = allProducts
        .filter(p => (p.stockQuantity || 0) < threshold)
        .map(p => ({
            id: p.id,
            name: p.name,
            currentStock: p.stockQuantity || 0,
            reorderLevel: threshold,
            shortfall: threshold - (p.stockQuantity || 0),
            // preferredVendorId: p.vendorId // If we add vendor support later
        } as LowStockProductResult))
        .sort((a,b) => a.currentStock - b.currentStock); // Lowest stock first

    return successResponse(lowStockProducts);

  } catch (error: any) {
    console.error("Error in get-low-stock:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
