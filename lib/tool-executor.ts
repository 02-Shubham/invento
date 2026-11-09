import { adminService } from "@/lib/admin-service";
import { Product, UserSettings } from "@/types";
import {
  ActionTool,
  ActionPreview,
  ActionView,
  createPendingAction,
  toActionView,
} from "@/lib/pending-actions";

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  /** Set when a write tool produced an approval proposal (sent to the UI, not the model). */
  proposal?: ActionView;
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

      // Write tools never execute here: they create a pending proposal for the owner to approve.
      case "create_invoice":
      case "adjust_stock":
      case "add_product":
        result = await proposeWriteTool(toolName, toolInput, userId);
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
      
      const allProducts = await adminService.getProducts(userId);
      
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
      
      const allCustomers = await adminService.getCustomers(userId);
      
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
      const allInvoices = await adminService.getInvoices(userId);
      
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

// ══════════════════════════════════════════════════════════════════════════════
// WRITE TOOLS — propose → approve → commit
//
// The AI can never write business data directly. For create_invoice,
// adjust_stock and add_product the model's call only reaches `prepare*`, which
// validates it against real data and stores a PENDING action (lib/pending-actions).
// The owner approves in the UI; the approve route then calls `commitWriteTool`
// with the STORED input — never with anything supplied by the browser.
// ══════════════════════════════════════════════════════════════════════════════

export const WRITE_TOOLS: ReadonlySet<string> = new Set<ActionTool>([
  "create_invoice",
  "adjust_stock",
  "add_product",
]);
export const isWriteTool = (name: string): name is ActionTool => WRITE_TOOLS.has(name);

type Prepared =
  | { success: true; input: Record<string, any>; preview: ActionPreview }
  | { success: false; error: string };

const MAX_INVOICE_LINES = 50;
const round2 = (n: number) => parseFloat(n.toFixed(2));
const toNum = (v: any) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);
const isPositive = (n: any): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

async function proposeWriteTool(tool: ActionTool, input: any, userId: string): Promise<ToolResult> {
  const prepared = await prepareWriteTool(tool, input, userId);
  if (!prepared.success) return { success: false, error: prepared.error };

  const action = await createPendingAction({
    userId,
    tool,
    input: prepared.input,
    preview: prepared.preview,
  });

  return {
    success: true,
    data: {
      status: "pending_approval",
      proposalId: action.id,
      message:
        "NOT EXECUTED. This is only a proposal: nothing has been created or changed yet. " +
        "It is now shown to the owner as an approval card with Approve and Reject buttons. " +
        "Briefly tell the user what you prepared (who/what and quantities) and ask them to review and approve it. " +
        "Do NOT state, calculate or guess any prices, totals, tax or currency symbols: the card shows the exact figures. " +
        "Do not say it is done and do not call this tool again for the same request.",
    },
    proposal: toActionView(action),
  };
}

async function prepareWriteTool(tool: ActionTool, input: any, userId: string): Promise<Prepared> {
  try {
    switch (tool) {
      case "create_invoice": return await prepareCreateInvoice(input, userId);
      case "adjust_stock":   return await prepareAdjustStock(input, userId);
      case "add_product":    return await prepareAddProduct(input, userId);
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to prepare action" };
  }
}

/** Execute an APPROVED action using its stored input. Only the approve route calls this. */
export async function commitWriteTool(tool: ActionTool, storedInput: any, userId: string): Promise<ToolResult> {
  try {
    switch (tool) {
      case "create_invoice": return await commitCreateInvoice(storedInput, userId);
      case "adjust_stock":   return await commitAdjustStock(storedInput, userId);
      case "add_product":    return await commitAddProduct(storedInput, userId);
      default:               return { success: false, error: `Unknown action: ${tool}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Action failed" };
  }
}

// ── create_invoice ───────────────────────────────────────────────────────────

async function prepareCreateInvoice(
  input: { customerId?: string; items?: { productId: string; quantity: number }[]; notes?: string },
  userId: string
): Promise<Prepared> {
  const { customerId, items, notes } = input || {};
  if (!customerId || typeof customerId !== "string") {
    return { success: false, error: "customerId is required. Use search_customers to find it." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: "At least one item is required." };
  }
  if (items.length > MAX_INVOICE_LINES) {
    return { success: false, error: `Too many items (max ${MAX_INVOICE_LINES}).` };
  }

  // Validate and merge duplicate lines for the same product
  const wanted = new Map<string, number>();
  for (const item of items) {
    const quantity = toNum(item?.quantity);
    if (!item?.productId || typeof item.productId !== "string" || !isPositive(quantity)) {
      return { success: false, error: "Every item needs a productId and a quantity greater than 0." };
    }
    wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + quantity);
  }

  const customer = await adminService.getCustomerById(customerId, userId);
  if (!customer) return { success: false, error: "Customer not found" };

  const settings = (await adminService.getUserSettings(userId)) as UserSettings | null;
  const taxRatePct = settings?.taxRate ?? 0; // e.g. 18 for 18%

  const allProducts = await adminService.getProducts(userId);
  const lines: { productId: string; name: string; sku: string; quantity: number; price: number }[] = [];
  const warnings: string[] = [];
  let subtotal = 0;

  for (const [productId, quantity] of wanted) {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return { success: false, error: `Product not found: ${productId}` };
    if ((product.stockQuantity || 0) < quantity) {
      return {
        success: false,
        error: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity || 0}, Needed: ${quantity}`,
      };
    }
    const price = product.price || 0;
    if (price === 0) warnings.push(`${product.name} has a price of 0.`);
    subtotal += price * quantity;
    lines.push({ productId: product.id, name: product.name, sku: product.sku || "", quantity, price });
  }

  subtotal = round2(subtotal);
  const taxAmount = round2((subtotal * taxRatePct) / 100);
  const total = round2(subtotal + taxAmount);

  if ((customer.totalOutstanding || 0) > 0.01) {
    warnings.push(`${customer.name} already owes ${round2(customer.totalOutstanding || 0)}.`);
  }

  const cleanNotes = typeof notes === "string" ? notes.trim().slice(0, 500) : "";

  return {
    success: true,
    // This stored object is exactly what commit will use — including the prices the owner sees.
    input: { customerId, customerName: customer.name, items: lines, subtotal, taxRatePct, taxAmount, total, notes: cleanNotes },
    preview: {
      title: "Create invoice",
      subtitle: customer.name,
      lines: lines.map((l) => ({ label: l.name, quantity: l.quantity, unitPrice: l.price, amount: round2(l.price * l.quantity) })),
      totals: [
        { label: "Subtotal", amount: subtotal },
        ...(taxRatePct > 0 ? [{ label: `Tax (${taxRatePct}%)`, amount: taxAmount }] : []),
        { label: "Total", amount: total, bold: true },
      ],
      details: [
        { label: "Due", value: "30 days after approval" },
        ...(cleanNotes ? [{ label: "Notes", value: cleanNotes }] : []),
        { label: "Stock", value: "Will be deducted when approved" },
      ],
      warnings,
    },
  };
}

async function commitCreateInvoice(stored: any, userId: string): Promise<ToolResult> {
  const customer = await adminService.getCustomerById(stored.customerId, userId);
  if (!customer) return { success: false, error: "Customer no longer exists" };

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const invoiceItems = stored.items.map((l: any) => ({
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    productId: l.productId,
    name: l.name,
    sku: l.sku || "",
    quantity: l.quantity,
    price: l.price, // the price the owner approved
  }));

  const invoiceData: any = {
    invoiceNumber,
    customerId: stored.customerId,
    customerName: customer.name,
    customerEmail: customer.email || "",
    customerAddress: customer.address || "",
    items: invoiceItems,
    total: stored.total,
    subtotal: stored.subtotal,
    tax: stored.taxAmount,
    balanceAmount: stored.total,
    paidAmount: 0,
    status: "pending",
    notes: stored.notes || "",
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Atomic: re-checks stock, deducts it and logs the movements. Throws if stock
  // dropped since the proposal was made — the action is then marked failed.
  const invoiceId = await adminService.createInvoiceWithStockUpdate(invoiceData, userId);

  // The invoice exists now; a failure in these bookkeeping updates must not
  // report the whole action as failed.
  try {
    await adminService.updateCustomerStats(stored.customerId, stored.total, userId);
    // Server-side increment: safe even if a payment was recorded while this waited for approval
    await adminService.adjustCustomerOutstanding(stored.customerId, stored.total, userId);
  } catch (error) {
    console.error("[AI Tool] Invoice created but customer totals update failed:", error);
  }

  return {
    success: true,
    data: {
      invoiceId,
      invoiceNumber,
      customerName: customer.name,
      subtotal: stored.subtotal,
      taxAmount: stored.taxAmount,
      taxRate: stored.taxRatePct,
      totalAmount: stored.total,
      balanceAmount: stored.total,
      itemsCount: stored.items.length,
      stockUpdated: true,
    },
  };
}

// ── adjust_stock ─────────────────────────────────────────────────────────────

async function prepareAdjustStock(
  input: { productId?: string; quantity?: number; notes?: string },
  userId: string
): Promise<Prepared> {
  const quantity = toNum(input?.quantity);
  if (!input?.productId || typeof input.productId !== "string") {
    return { success: false, error: "productId is required. Use search_products to find it." };
  }
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity === 0) {
    return { success: false, error: "quantity must be a non-zero number (positive adds stock, negative removes it)." };
  }

  const product = await adminService.getProductById(input.productId, userId);
  if (!product) return { success: false, error: "Product not found" };

  const current = product.stockQuantity || 0;
  const newStock = current + quantity;
  if (newStock < 0) {
    return { success: false, error: `Cannot reduce stock below 0. Current stock is ${current}, adjustment is ${quantity}.` };
  }

  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 300) : "AI stock adjustment";

  return {
    success: true,
    input: { productId: product.id, productName: product.name, quantity, notes },
    preview: {
      title: quantity > 0 ? "Add stock" : "Remove stock",
      subtitle: `${product.name}${product.sku ? ` (${product.sku})` : ""}`,
      details: [
        { label: "Current stock", value: String(current) },
        { label: "Change", value: `${quantity > 0 ? "+" : ""}${quantity}` },
        { label: "New stock", value: String(newStock) },
        { label: "Reason", value: notes },
      ],
      warnings: newStock === 0 ? [`${product.name} will be out of stock.`] : [],
    },
  };
}

async function commitAdjustStock(stored: any, userId: string): Promise<ToolResult> {
  // The "not below zero" rule is enforced inside this transaction.
  const transactionId = await adminService.addInventoryTransaction(
    {
      productId: stored.productId,
      productName: stored.productName,
      quantity: stored.quantity,
      transactionType: "adjustment",
      referenceType: "Manual",
      notes: stored.notes,
    } as any,
    userId
  );
  const product = await adminService.getProductById(stored.productId, userId);
  return {
    success: true,
    data: {
      productName: stored.productName,
      quantityAdjusted: stored.quantity,
      newStockLevel: product?.stockQuantity ?? null,
      transactionId,
    },
  };
}


async function executeGetRevenueReport(
  input: { startDate?: string; endDate?: string },
  userId: string
): Promise<ToolResult> {
  try {
    const { startDate, endDate } = input;
    let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    let end = endDate ? new Date(endDate) : new Date();

    const allInvoices = await adminService.getInvoices(userId);
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
    const allProducts = await adminService.getProducts(userId);
    
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

// ── add_product ──────────────────────────────────────────────────────────────

async function prepareAddProduct(
  input: { name?: string; price?: number; stockQuantity?: number; sku?: string; category?: string; description?: string },
  userId: string
): Promise<Prepared> {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const price = toNum(input?.price);
  const stockQuantity = input?.stockQuantity === undefined ? 0 : toNum(input.stockQuantity);

  if (!name) return { success: false, error: "Product name is required." };
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return { success: false, error: "A valid price is required. Ask the user for the price." };
  }
  if (typeof stockQuantity !== "number" || !Number.isFinite(stockQuantity) || stockQuantity < 0) {
    return { success: false, error: "stockQuantity must be 0 or more." };
  }

  const existing = await adminService.getProducts(userId);

  // Fix the SKU now so the approved SKU is the one the owner saw
  let sku = typeof input.sku === "string" ? input.sku.trim() : "";
  if (!sku) {
    const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "PRD");
    sku = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const warnings: string[] = [];
  if (existing.some((p) => p.name?.trim().toLowerCase() === name.toLowerCase())) {
    warnings.push(`A product named "${name}" already exists. Approving will create a second one.`);
  }
  if (existing.some((p) => p.sku?.toLowerCase() === sku.toLowerCase())) {
    warnings.push(`SKU ${sku} is already used by another product.`);
  }

  const category = typeof input.category === "string" && input.category.trim() ? input.category.trim() : "General";
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 500) : "";

  return {
    success: true,
    input: { name, price, stockQuantity, sku, category, description },
    preview: {
      title: "Add product",
      subtitle: name,
      details: [
        { label: "SKU", value: sku },
        { label: "Category", value: category },
        { label: "Opening stock", value: String(stockQuantity) },
        ...(description ? [{ label: "Description", value: description }] : []),
      ],
      totals: [{ label: "Selling price", amount: price, bold: true }],
      warnings,
    },
  };
}

async function commitAddProduct(stored: any, userId: string): Promise<ToolResult> {
  const { name, price, stockQuantity, sku, category, description } = stored;
  const productId = await adminService.addProduct(
    {
      name,
      description,
      sku,
      price: Number(price),
      stockQuantity: Number(stockQuantity),
      category,
      canBePurchased: true,
      canBeProduced: false,
      averageCost: Number(price) * 0.7, // Assume a 70% COGS as fallback
      lastCost: Number(price) * 0.7,
      totalValue: Number(stockQuantity) * (Number(price) * 0.7),
    },
    userId
  );
  return {
    success: true,
    data: { productId, name, sku, price: Number(price), stockQuantity: Number(stockQuantity), category, description },
  };
}
