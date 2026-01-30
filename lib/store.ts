import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Invoice, Customer } from '@/types';

interface Settings {
  businessName: string;
  businessAddress: string;
  businessEmail: string;
  businessPhone: string;
  taxRate: number;
  currency: string;
  invoicePrefix: string;
  defaultPaymentTerms?: string;
}

interface AppState {
  products: Product[];
  invoices: Invoice[];
  customers: Customer[];
  settings: Settings;
  
  // Product Actions
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  
  // Invoice Actions
  addInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  
  // Customer Actions
  addCustomer: (customer: Customer) => void;

  // Settings Actions
  updateSettings: (settings: Partial<Settings>) => void;
}

// Mock Data
export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    userId: 'mock-user',
    name: 'Wireless Mouse',
    sku: 'WM-001',
    category: 'Electronics',
    description: 'Ergonomic wireless mouse with 2 year battery life',
    price: 29.99,
    stockQuantity: 45,
    reorderLevel: 10,
    unit: 'pcs',
    canBePurchased: true,
    canBeProduced: false,
    averageCost: 15.00,
    lastCost: 15.00,
    totalValue: 675.00,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    userId: 'mock-user',
    name: 'Mechanical Keyboard',
    sku: 'MK-002',
    category: 'Electronics',
    description: 'RGB Mechanical Keyboard with Blue Switches',
    price: 89.99,
    stockQuantity: 8,
    reorderLevel: 15,
    unit: 'pcs',
    canBePurchased: true,
    canBeProduced: false,
    averageCost: 50.00,
    lastCost: 50.00,
    totalValue: 400.00,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    userId: 'mock-user',
    name: 'Office Chair',
    sku: 'OC-101',
    category: 'Furniture',
    description: 'Ergonomic mesh office chair',
    price: 199.99,
    stockQuantity: 5,
    reorderLevel: 5,
    unit: 'pcs',
    canBePurchased: true,
    canBeProduced: false,
    averageCost: 100.00,
    lastCost: 100.00,
    totalValue: 500.00,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
    {
    id: '4',
    userId: 'mock-user',
    name: 'USB-C Cable (2m)',
    sku: 'CB-004',
    category: 'Electronics',
    description: 'High speed charging cable',
    price: 12.50,
    stockQuantity: 100,
    reorderLevel: 20,
    unit: 'pcs',
    canBePurchased: true,
    canBeProduced: false,
    averageCost: 5.00,
    lastCost: 5.00,
    totalValue: 500.00,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '5',
    userId: 'mock-user',
    name: 'Monitor Stand',
    sku: 'MS-500',
    category: 'Furniture',
    description: 'Adjustable aluminum monitor stand',
    price: 45.00,
    stockQuantity: 0,
    reorderLevel: 10,
    unit: 'pcs',
    canBePurchased: true,
    canBeProduced: false,
    averageCost: 20.00,
    lastCost: 20.00,
    totalValue: 0.00,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: '1',
    userId: 'mock-user',
    invoiceNumber: 'INV-001',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerAddress: '123 Main St, NY',
    items: [
      { productId: '1', productName: 'Wireless Mouse', quantity: 2, unitPrice: 29.99, total: 59.98 } as any
    ],
    subtotal: 59.98,
    tax: 5.99,
    total: 65.97,
    paidAmount: 65.97,
    balanceAmount: 0,
    payments: [],
    status: 'paid',
    dueDate: new Date('2024-02-14'),
    createdAt: new Date('2024-01-15'),
  },
   {
    id: '2',
    userId: 'mock-user',
    invoiceNumber: 'INV-002',
    customerName: 'Acme Corp',
    customerEmail: 'billing@acme.com',
    customerAddress: '456 Business Rd, CA',
    items: [
      { productId: '3', productName: 'Office Chair', quantity: 5, unitPrice: 199.99, total: 999.95 } as any
    ],
    subtotal: 999.95,
    tax: 99.99,
    total: 1099.94,
    paidAmount: 0,
    balanceAmount: 1099.94,
    payments: [],
    status: 'pending',
    dueDate: new Date('2024-03-31'),
    createdAt: new Date('2024-03-01'),
  }
];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      products: MOCK_PRODUCTS,
      invoices: MOCK_INVOICES,
      customers: [],

      // Product Actions
      addProduct: (product) => 
        set((state) => ({ products: [...state.products, product] })),
      
      updateProduct: (id, updates) =>
        set((state) => ({
          products: state.products.map((p) => 
            p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
          ),
        })),
        
      deleteProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        })),

      // Invoice Actions
      addInvoice: (invoice) =>
        set((state) => ({ invoices: [invoice, ...state.invoices] })),
        
      deleteInvoice: (id) =>
        set((state) => ({
          invoices: state.invoices.filter((i) => i.id !== id),
        })),

      // Customer Actions
      addCustomer: (customer) =>
        set((state) => ({ customers: [...state.customers, customer] })),
        
      // Settings Actions
      settings: {
        businessName: "Shubham Bags",
        businessAddress: "Powai, Mumbai",
        businessEmail: "shubham@shubhambags.com",
        businessPhone: "8850502975",
        taxRate: 18,
        currency: "INR",
        invoicePrefix: "INV-",
        defaultPaymentTerms: "Due on Receipt"
      },
      updateSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
    }),
    {
      name: 'invo-storage',
      skipHydration: true, 
    }
  )
);
