export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Product search
export interface SearchProductsRequest {
  query: string;
  limit?: number;
}

export interface ProductResult {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  stockQuantity: number;
  canBePurchased: boolean;
  canBeProduced: boolean;
}

// Customer search
export interface SearchCustomersRequest {
  query: string;
  limit?: number;
}

export interface CustomerResult {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOutstanding?: number;
}

// Stock check
export interface CheckStockRequest {
  productId: string;
  quantityNeeded: number;
}

export interface StockCheckResult {
  available: boolean;
  currentStock: number;
  quantityNeeded: number;
  shortfall?: number;
  productName: string;
}

// Create invoice
export interface InvoiceItemInput {
  productId: string;
  quantity: number;
}

export interface CreateInvoiceRequest {
  customerId: string;
  items: InvoiceItemInput[];
  notes?: string;
}

export interface InvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  balanceAmount: number;
  itemsCount: number;
  stockUpdated: boolean;
  pdfUrl?: string; // Optional for now
}

// Create Customer
export interface CreateCustomerRequest {
    name: string;
    email?: string;
    phone: string;
    address?: string;
}

export interface CreateCustomerResult {
    id: string;
    name: string;
    phone: string;
    message: string;
}

// Record Payment
export interface RecordPaymentRequest {
    customerId: string;
    amount: number;
    paymentMethod: string; // 'cash' | 'bank_transfer' | 'upi' | ...
    invoiceIds?: string[]; // Optional specific invoices
    autoApply?: boolean; 
}

export interface AppliedPaymentInfo {
    invoiceNumber: string;
    amountApplied: number;
    remainingBalance: number;
}

export interface RecordPaymentResult {
    paymentId: string;
    paymentNumber: string;
    amount: number;
    appliedTo: AppliedPaymentInfo[];
    customerOutstanding: number;
}

// Analytics: Low Stock
export interface GetLowStockRequest {
    threshold?: number;
}

export interface LowStockProductResult {
    id: string;
    name: string;
    currentStock: number;
    reorderLevel: number;
    shortfall: number;
    preferredVendorId?: string;
}

// Analytics: Customer Outstanding
export interface GetCustomerOutstandingRequest {
    customerId: string;
}

export interface OutstandingInvoiceInfo {
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    dueDate: Date; // or string
    daysOverdue: number;
}

export interface CustomerOutstandingResult {
    customerId: string;
    customerName: string;
    totalOutstanding: number;
    invoices: OutstandingInvoiceInfo[];
}

// Analytics: Sales Summary
export interface GetSalesSummaryRequest {
    startDate?: string;
    endDate?: string;
}

export interface TopProductInfo {
    name: string;
    quantitySold: number;
    revenue: number;
}

export interface SalesSummaryResult {
    period: string;
    totalRevenue: number;
    totalInvoices: number;
    averageOrderValue: number;
    topProducts: TopProductInfo[];
    paymentStatus: {
        collected: number;
        outstanding: number;
    };
}

// Stock: Add Stock
export interface AddStockRequest {
    productId: string;
    quantity: number;
    source: 'production' | 'adjustment' | 'return';
    unitCost?: number;
    notes?: string;
}

export interface AddStockResult {
    productName: string;
    quantityAdded: number;
    newStockLevel: number;
    transactionId: string;
}
