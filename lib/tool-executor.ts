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
      
      case "get_customers_with_pending_payments":
        result = await executeGetCustomersPendingPayments(toolInput, userId);
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

async function executeGetCustomersPendingPayments(
  input: { limit?: number },
  userId: string
): Promise<ToolResult> {
  try {
      const { limit = 10 } = input;
      
      // Get all invoices for the user
      const allInvoices = await firestoreService.getInvoices(userId);
      
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

      return {
        success: true,
        data: {
          count: customers.length,
          customers: customers.map(c => ({
            customerId: c.customerId,
            customerName: c.customerName,
            customerEmail: c.customerEmail,
            totalOutstanding: c.totalOutstanding,
            invoiceCount: c.invoiceCount,
            oldestInvoiceDate: c.oldestInvoiceDate
          }))
        }
      };

  } catch (error: any) {
      return {
          success: false,
          error: error.message || "Failed to get customers with pending payments"
      };
  }
}
