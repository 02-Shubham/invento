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

      case "create_invoice":
        result = await executeCreateInvoice(toolInput, userId);
        break;

      case "adjust_stock":
        result = await executeAdjustStock(toolInput, userId);
        break;

      case "get_revenue_report":
        result = await executeGetRevenueReport(toolInput, userId);
        break;

      case "get_low_stock_products":
        result = await executeGetLowStockProducts(toolInput, userId);
        break;
      
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

async function executeCreateInvoice(
  input: { customerId: string; items: { productId: string; quantity: number }[]; notes?: string },
  userId: string
): Promise<ToolResult> {
  try {
    const { customerId, items, notes } = input;
    if (!customerId || !items || items.length === 0) {
      return { success: false, error: "Customer ID and Items are required" };
    }

    const customer = await firestoreService.getCustomerById(customerId, userId);
    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    const allProducts = await firestoreService.getProducts(userId);
    const invoiceItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = allProducts.find(p => p.id === item.productId);
      if (!product) {
        return { success: false, error: `Product not found: ${item.productId}` };
      }
      if ((product.stockQuantity || 0) < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Needed: ${item.quantity}`
        };
      }

      const lineTotal = (product.price || 0) * item.quantity;
      subtotal += lineTotal;

      invoiceItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        productId: product.id,
        name: product.name,
        sku: product.sku || "",
        quantity: item.quantity,
        price: product.price || 0,
      });
    }

    const total = subtotal;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const newInvoiceData: any = {
      invoiceNumber,
      customerId,
      customerName: customer.name,
      customerEmail: customer.email || "",
      customerAddress: customer.address || "",
      items: invoiceItems,
      total,
      subtotal,
      tax: 0,
      balanceAmount: total,
      paidAmount: 0,
      status: 'pending',
      notes: notes || "",
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };

    const invoiceId = await firestoreService.createInvoiceWithStockUpdate(newInvoiceData, userId);
    await firestoreService.updateCustomerStats(customerId, total, userId);
    
    // Update customer outstanding balance
    const currentOutstanding = customer.totalOutstanding || 0;
    await firestoreService.updateCustomer(customerId, {
      totalOutstanding: currentOutstanding + total
    }, userId);

    return {
      success: true,
      data: {
        invoiceId,
        invoiceNumber,
        customerName: customer.name,
        totalAmount: total,
        balanceAmount: total,
        itemsCount: items.length,
        stockUpdated: true
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create invoice" };
  }
}

async function executeAdjustStock(
  input: { productId: string; quantity: number; notes?: string },
  userId: string
): Promise<ToolResult> {
  try {
    const { productId, quantity, notes } = input;
    if (!productId || quantity === 0) {
      return { success: false, error: "Product ID and non-zero Quantity are required" };
    }

    const product = await firestoreService.getProductById(productId, userId);
    if (!product) {
      return { success: false, error: "Product not found" };
    }

    const newStock = (product.stockQuantity || 0) + quantity;
    if (newStock < 0) {
      return {
        success: false,
        error: `Cannot reduce stock below 0. Current stock is ${product.stockQuantity}, adjustment is ${quantity}.`
      };
    }

    const transactionId = await firestoreService.addInventoryTransaction({
      productId,
      productName: product.name,
      quantity,
      transactionType: 'adjustment',
      unitCost: product.averageCost || product.price || 0,
      notes: notes || "AI stock adjustment",
    }, userId);

    return {
      success: true,
      data: {
        productName: product.name,
        quantityAdjusted: quantity,
        newStockLevel: newStock,
        transactionId
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to adjust stock" };
  }
}

async function executeGetRevenueReport(
  input: { startDate?: string; endDate?: string },
  userId: string
): Promise<ToolResult> {
  try {
    const { startDate, endDate } = input;
    let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    let end = endDate ? new Date(endDate) : new Date();

    const allInvoices = await firestoreService.getInvoices(userId);
    const periodInvoices = allInvoices.filter(inv => {
      const d = new Date(inv.createdAt);
      return d >= start && d <= end;
    });

    const totalRevenue = periodInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalCollected = periodInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalOutstanding = totalRevenue - totalCollected;
    const totalInvoices = periodInvoices.length;
    const averageOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    const productStats: Record<string, { name: string, quantitySold: number, revenue: number }> = {};
    
    periodInvoices.forEach(inv => {
      const items = Array.isArray(inv.items) ? inv.items : Object.values(inv.items || {});
      items.forEach((item: any) => {
        if (!productStats[item.productId]) {
          productStats[item.productId] = { name: item.name, quantitySold: 0, revenue: 0 };
        }
        productStats[item.productId].quantitySold += (item.quantity || 0);
        const itemTotal = item.total || ((item.price || 0) * (item.quantity || 0)) || 0;
        productStats[item.productId].revenue += itemTotal; 
      });
    });

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      success: true,
      data: {
        period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        totalRevenue,
        totalInvoices,
        averageOrderValue,
        topProducts,
        paymentStatus: {
          collected: totalCollected,
          outstanding: totalOutstanding
        }
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to generate revenue report" };
  }
}

async function executeGetLowStockProducts(
  input: { threshold?: number },
  userId: string
): Promise<ToolResult> {
  try {
    const { threshold = 10 } = input;
    const allProducts = await firestoreService.getProducts(userId);
    
    const lowStockProducts = allProducts
      .filter(p => (p.stockQuantity || 0) < threshold)
      .map(p => ({
        id: p.id,
        name: p.name,
        currentStock: p.stockQuantity || 0,
        reorderLevel: threshold,
        shortfall: threshold - (p.stockQuantity || 0),
      }))
      .sort((a, b) => a.currentStock - b.currentStock);

    return {
      success: true,
      data: {
        count: lowStockProducts.length,
        products: lowStockProducts
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to retrieve low stock products" };
  }
}
