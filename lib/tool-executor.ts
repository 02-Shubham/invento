import { firestoreService } from "@/lib/firestore-service";
import { Product } from "@/types";

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function executeToolFunction(
  toolName: string,
  toolInput: any,
  userId: string
): Promise<ToolResult> {
  
  try {
    // Route to appropriate API endpoint
    switch (toolName) {
      case "search_products":
        return await executeSearchProducts(toolInput, userId);
      
      // Add more cases in Phase AI-4
      
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        };
    }
  } catch (error: any) {
    console.error(`Tool execution error [${toolName}]:`, error);
    return {
      success: false,
      error: error.message || "Tool execution failed"
    };
  }
}

async function executeSearchProducts(
  input: { query: string; limit?: number },
  userId: string
): Promise<ToolResult> {
  // Logic mirrored from app/api/ai-tools/search-products/route.ts
  // but executed directly to avoid self-referential HTTP calls and overhead.
  
  try {
      const { query, limit = 10 } = input;
      
      if (!query) {
        return { success: false, error: "Query is required" };
      }

      // Simple sanitization
      const sanitizedQuery = query.trim().toLowerCase();
      
      const allProducts = await firestoreService.getProducts(userId);
      
      // Fuzzy matching locally
      const results = allProducts.filter(product => {
          const nameMatch = product.name?.toLowerCase().includes(sanitizedQuery);
          const skuMatch = product.sku?.toLowerCase().includes(sanitizedQuery);
          return nameMatch || skuMatch;
      }).slice(0, limit);

      // Format results for AI consumption
      return {
        success: true,
        data: {
          count: results.length,
          products: results.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            stock: p.stockQuantity,
            available: (p.stockQuantity || 0) > 0
          }))
        }
      };

  } catch (error: any) {
      return {
          success: false,
          error: error.message || "Search failed"
      };
  }
}
