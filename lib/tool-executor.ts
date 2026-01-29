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
  
  const startTime = Date.now();
  console.log('[AI Tool] Executing:', {
    tool: toolName,
    input: toolInput,
    userId: userId,
    timestamp: new Date().toISOString()
  });

  try {
    let result: ToolResult;
    // Route to appropriate API endpoint
    switch (toolName) {
      case "search_products":
        result = await executeSearchProducts(toolInput, userId);
        break;
      
      case "search_customers":
        result = await executeSearchCustomers(toolInput, userId);
        break;
      
      // Add more cases in Phase AI-4
      
      default:
        result = {
          success: false,
          error: `Unknown tool: ${toolName}`
        };
    }

    console.log('[AI Tool] Result:', {
      tool: toolName,
      success: result.success,
      dataLength: result.data?.products?.length || result.data?.length, // Handle inconsistent structure
      error: result.error,
      duration: `${Date.now() - startTime}ms`
    });

    return result;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[AI Tool] Error [${toolName}] (${duration}ms):`, error);
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

async function executeSearchCustomers(
  input: { query: string; limit?: number },
  userId: string
): Promise<ToolResult> {
  try {
      const { query, limit = 5 } = input;
      
      const sanitizedQuery = (query || "").trim().toLowerCase();
      
      const allCustomers = await firestoreService.getCustomers(userId);
      
      let results = allCustomers;
      
      if (sanitizedQuery) {
          results = allCustomers.filter(customer => {
              const nameMatch = customer.name?.toLowerCase().includes(sanitizedQuery);
              const emailMatch = customer.email?.toLowerCase().includes(sanitizedQuery);
              const phoneMatch = customer.phone?.toLowerCase().includes(sanitizedQuery);
              const companyMatch = customer.company?.toLowerCase().includes(sanitizedQuery);
              return nameMatch || emailMatch || phoneMatch || companyMatch;
          });
      }
      
      // Slice results
      results = results.slice(0, limit);

      return {
        success: true,
        data: {
          count: results.length,
          customers: results.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            company: c.company || ""
          }))
        }
      };

  } catch (error: any) {
      return {
          success: false,
          error: error.message || "Customer search failed"
      };
  }
}
