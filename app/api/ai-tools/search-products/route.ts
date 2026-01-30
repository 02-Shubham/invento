import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { sanitizeQuery } from "@/lib/validation";
import { firestoreService } from "@/lib/firestore-service";
import { SearchProductsRequest, ProductResult } from "@/types/ai-tools";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { query, limit = 10 } = body as SearchProductsRequest;

    if (!query) {
      return errorResponse("Query is required");
    }

    const sanitizedQuery = sanitizeQuery(query);
    const allProducts = await firestoreService.getProducts(user);
    
    // Fuzzy matching locally since Firestore doesn't support full-text search easily
    // This is acceptable for small-medium datasets
    const results = allProducts.filter(product => {
        const nameMatch = product.name?.toLowerCase().includes(sanitizedQuery);
        const skuMatch = product.sku?.toLowerCase().includes(sanitizedQuery);
        return nameMatch || skuMatch;
    }).slice(0, limit);

    const mappedResults: ProductResult[] = results.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku || "",
        sellingPrice: p.price || 0,
        stockQuantity: p.stockQuantity || 0,
        canBePurchased: true, // Assuming default
        canBeProduced: false // Assuming default
    }));

    return successResponse(mappedResults);

  } catch (error: any) {
    console.error("Error in search-products:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
