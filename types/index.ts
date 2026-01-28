export type InvoiceStatus = 'paid' | 'pending' | 'partially_paid' | 'overdue' | 'unpaid' | 'draft';
export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "upi" | "card" | "other";

export interface Product {
    id: string;
    userId: string; // Multi-tenancy: owner of this product
    name: string;
    description: string;
    sku: string;
    price: number;
    stockQuantity: number;
    category: string;
    
    // Inventory Management
    reorderLevel?: number;
    unit?: string;

    // Stock Source Configuration
    canBePurchased: boolean;
    canBeProduced: boolean;
    productionNotes?: string;
    estimatedProductionCost?: number;
    
    // Cost Tracking
    averageCost: number;
    lastCost: number;
    totalValue: number;

    createdAt: Date;
    updatedAt: Date;
}

export interface Customer {
    id: string;
    userId: string; // Multi-tenancy: owner of this customer
    name: string;
    email: string;
    phone: string;
    address: string;
    company?: string;
    taxId?: string;
    
    // Stats
    totalSpent?: number;
    totalInvoices?: number;
    lastOrderDate?: Date;
    totalOutstanding?: number;

    createdAt: Date;
    updatedAt: Date;
}

export interface InvoiceItem {
    id: string;
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    price: number;
}

export interface Invoice {
    id: string;
    userId: string; // Multi-tenancy: owner of this invoice
    invoiceNumber: string;
    customerId?: string;
    customerName: string;
    customerEmail: string;
    customerAddress: string;
    items: InvoiceItem[] | { [key: string]: InvoiceItem }; // Handling both legacy object and array
    total: number;
    status: InvoiceStatus;
    dueDate: Date;
    createdAt: Date;
    
    // Payment tracking
    paidAmount: number;
    balanceAmount: number;
    payments?: string[]; // IDs of applied payments
}

export interface PaymentApplication {
    invoiceId: string;
    amountApplied: number;
    invoiceNumber: string; // denormalized for easier display
}

export interface Payment {
    id: string;
    userId: string; // Multi-tenancy: owner of this payment
    paymentNumber: string;
    amount: number;
    paymentDate: Date;
    paymentMethod: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
    
    customerId: string;
    customerName: string; // denormalized
    
    appliedTo: PaymentApplication[];
    unappliedAmount: number;

    createdAt: Date;
    updatedAt: Date;
}

export type TransactionType = 
    | 'purchase'           // from Purchase Order
    | 'production'         // manual production entry
    | 'sale'              // from Invoice
    | 'adjustment'        // manual correction
    | 'return_customer'   // from Customer
    | 'return_vendor'     // to Vendor
    | 'damage'            // wastage
    | 'transfer';         // future use

export interface InventoryTransaction {
    id: string;
    userId: string; // Multi-tenancy: owner of this transaction
    productId: string;
    productName: string;
    sku?: string;
    
    transactionType: TransactionType;
    
    quantity: number; // positive = in, negative = out
    unitCost?: number;
    totalCost?: number;
    
    // Linking
    referenceType?: 'PurchaseOrder' | 'Invoice' | 'ProductionBatch' | 'Manual';
    referenceId?: string;
    referenceNumber?: string;
    
    // Snapshot
    stockBefore: number;
    stockAfter: number;
    
    notes?: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface PurchaseOrderItem {
    productId: string;
    quantity: number;
    unitCost: number;
    total: number;
}

export interface PurchaseOrder {
    id: string;
    userId: string; // Multi-tenancy: owner of this purchase order
    poNumber: string;
    vendorName?: string; // Opt
    supplierId: string;
    status: 'draft' | 'ordered' | 'received' | 'cancelled';
    items: PurchaseOrderItem[];
    totalAmount: number;
    orderDate: Date;
    expectedDate?: Date;
    receivedDate?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Supplier {
    id: string;
    userId: string; // Multi-tenancy: owner of this supplier
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// --- AI User Settings ---

export interface UserSettings {
  id?: string;
  userId: string;
  aiProvider: 'openai' | 'anthropic' | 'google';
  aiApiKey?: string;
  aiApiKeySet?: boolean; // UI flag
  aiKeyLastUpdated?: Date;
  aiModel?: string;
  updatedAt?: Date;
}
