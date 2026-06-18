"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Users,
  PackageCheck
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ── Invoice Created Card ──────────────────────────────────────────────────────
interface InvoiceCreatedCardProps {
  data: {
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    subtotal: number;
    taxAmount: number;
    taxRate: number;
    totalAmount: number;
    balanceAmount: number;
    itemsCount: number;
    stockUpdated?: boolean;
  };
}

export function InvoiceCreatedCard({ data }: InvoiceCreatedCardProps) {
  if (!data) return null;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Invoice Created
            </span>
            <h4 className="text-sm font-semibold text-neutral-900 mt-1">
              {data.customerName}
            </h4>
          </div>
          <Badge variant="outline" className="font-mono text-xs text-neutral-700 bg-neutral-50">
            {data.invoiceNumber}
          </Badge>
        </div>

        {/* Invoice Summary Details */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-b border-neutral-100 py-3 text-xs">
          <div>
            <span className="text-neutral-400 block mb-0.5">Items</span>
            <span className="font-medium text-neutral-800">{data.itemsCount} items</span>
          </div>
          <div>
            <span className="text-neutral-400 block mb-0.5">Tax ({data.taxRate}%)</span>
            <span className="font-medium text-neutral-800">{formatCurrency(data.taxAmount)}</span>
          </div>
          <div>
            <span className="text-neutral-400 block mb-0.5">Subtotal</span>
            <span className="font-medium text-neutral-800">{formatCurrency(data.subtotal)}</span>
          </div>
          <div>
            <span className="text-neutral-400 block mb-0.5">Total Amount</span>
            <span className="font-bold text-neutral-900">{formatCurrency(data.totalAmount)}</span>
          </div>
        </div>

        {/* Footer actions & Stock updates */}
        <div className="mt-3.5 flex items-center justify-between">
          <div>
            {data.stockUpdated && (
              <span className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                <PackageCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Stock levels updated
              </span>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 text-xs font-medium border-neutral-300 hover:border-black hover:bg-neutral-50 transition-colors">
            <Link href={`/invoices/${data.invoiceId}`} className="flex items-center gap-1">
              View Invoice
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Low Stock Card ──────────────────────────────────────────────────────────
interface LowStockProduct {
  id: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  shortfall: number;
}

interface LowStockCardProps {
  data: {
    count: number;
    products: LowStockProduct[];
  };
}

export function LowStockCard({ data }: LowStockCardProps) {
  const [reordered, setReordered] = useState(false);
  const productsList = data?.products || [];

  if (productsList.length === 0) {
    return (
      <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <span className="text-sm font-medium text-neutral-800">All products are well-stocked!</span>
      </div>
    );
  }

  const handleReorder = () => {
    setReordered(true);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Low Stock Alert
            </span>
            <h4 className="text-sm font-semibold text-neutral-900 mt-1">
              {productsList.length} {productsList.length === 1 ? "Product needs" : "Products need"} attention
            </h4>
          </div>
          <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
        </div>

        {/* Mini Table */}
        <div className="overflow-x-auto border border-neutral-100 rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className="p-2 font-semibold text-neutral-600">Product</th>
                <th className="p-2 font-semibold text-neutral-600 text-right">Stock</th>
                <th className="p-2 font-semibold text-neutral-600 text-right">Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {productsList.map((prod) => (
                <tr key={prod.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50">
                  <td className="p-2 font-medium text-neutral-800 truncate max-w-[140px]">{prod.name}</td>
                  <td className="p-2 text-right text-neutral-600 font-mono">{prod.currentStock}</td>
                  <td className="p-2 text-right text-red-500 font-medium font-mono">+{prod.shortfall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={handleReorder}
            disabled={reordered}
            className={`h-8 text-xs font-medium transition-all ${
              reordered
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-default"
                : "bg-black text-white hover:bg-neutral-800"
            }`}
          >
            {reordered ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Reorder Submitted
              </span>
            ) : (
              "Reorder All"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Revenue Report Card ──────────────────────────────────────────────────────
interface TopProduct {
  name: string;
  quantitySold: number;
  revenue: number;
}

interface RevenueReportCardProps {
  data: {
    period: string;
    totalRevenue: number;
    totalInvoices: number;
    averageOrderValue: number;
    topProducts?: TopProduct[];
    paymentStatus?: {
      collected: number;
      outstanding: number;
    };
  };
}

export function RevenueReportCard({ data }: RevenueReportCardProps) {
  if (!data) return null;
  const products = data.topProducts || [];

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 border-l-4 border-l-sky-500 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
              Revenue Report
            </span>
            <p className="text-[11px] text-neutral-400 mt-1 font-medium">{data.period}</p>
          </div>
          <TrendingUp className="h-4.5 w-4.5 text-sky-500" />
        </div>

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-100">
            <span className="text-[10px] text-neutral-400 block">Revenue</span>
            <span className="text-xs font-bold text-neutral-900 truncate block">
              {formatCurrency(data.totalRevenue)}
            </span>
          </div>
          <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-100">
            <span className="text-[10px] text-neutral-400 block">Invoices</span>
            <span className="text-xs font-bold text-neutral-900 block">
              {data.totalInvoices}
            </span>
          </div>
          <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-100">
            <span className="text-[10px] text-neutral-400 block">Avg Order</span>
            <span className="text-xs font-bold text-neutral-900 truncate block">
              {formatCurrency(data.averageOrderValue)}
            </span>
          </div>
        </div>

        {/* Top Products */}
        {products.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 block">
              Top Products by Revenue
            </span>
            <div className="space-y-1.5">
              {products.slice(0, 3).map((prod, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-neutral-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-neutral-400 shrink-0">#{idx + 1}</span>
                    <span className="text-neutral-700 truncate font-medium">{prod.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-semibold text-neutral-800">{formatCurrency(prod.revenue)}</span>
                    <span className="text-[10px] text-neutral-400 ml-1">({prod.quantitySold} sold)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pending Payments Card ────────────────────────────────────────────────────
interface PendingCustomer {
  customerId: string;
  customerName: string;
  customerEmail: string;
  totalOutstanding: number;
  invoiceCount: number;
  oldestInvoiceDate: any;
}

interface PendingPaymentsCardProps {
  data: {
    count: number;
    customers: PendingCustomer[];
  };
}

export function PendingPaymentsCard({ data }: PendingPaymentsCardProps) {
  const customersList = data?.customers || [];

  if (customersList.length === 0) {
    return (
      <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <span className="text-sm font-medium text-neutral-800">All payments are fully paid!</span>
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 border-l-4 border-l-rose-500 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              Pending Payments
            </span>
            <h4 className="text-sm font-semibold text-neutral-900 mt-1">
              Outstanding Accounts: {customersList.length}
            </h4>
          </div>
          <Users className="h-4.5 w-4.5 text-rose-500" />
        </div>

        {/* Customer List */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {customersList.map((cust) => (
            <div
              key={cust.customerId}
              className="flex items-center justify-between p-2 rounded-lg border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-800 truncate">
                  {cust.customerName}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {cust.invoiceCount} {cust.invoiceCount === 1 ? "invoice" : "invoices"} pending
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-rose-600">
                  {formatCurrency(cust.totalOutstanding)}
                </span>
                <span className="block text-[9px] text-neutral-400 mt-0.5">Outstanding</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Product Created Card ──────────────────────────────────────────────────────
interface ProductCreatedCardProps {
  data: {
    productId: string;
    name: string;
    sku: string;
    price: number;
    stockQuantity: number;
    category: string;
    description?: string;
  };
}

export function ProductCreatedCard({ data }: ProductCreatedCardProps) {
  if (!data) return null;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 border-l-4 border-l-violet-500 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
              Product Added
            </span>
            <h4 className="text-sm font-semibold text-neutral-900 mt-1">
              {data.name}
            </h4>
          </div>
          <Badge variant="outline" className="font-mono text-xs text-neutral-700 bg-neutral-50">
            {data.sku}
          </Badge>
        </div>

        {/* Product Details Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-b border-neutral-100 py-3 text-xs">
          <div>
            <span className="text-neutral-400 block mb-0.5">Price</span>
            <span className="font-bold text-neutral-900">{formatCurrency(data.price)}</span>
          </div>
          <div>
            <span className="text-neutral-400 block mb-0.5">Category</span>
            <span className="font-medium text-neutral-800 truncate block max-w-[80px]">
              {data.category}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block mb-0.5">Starting Stock</span>
            <span className="font-medium text-neutral-855 font-mono">{data.stockQuantity} units</span>
          </div>
        </div>

        {/* Description if present */}
        {data.description && (
          <p className="mt-3 text-xs text-neutral-500 line-clamp-2 italic">
            "{data.description}"
          </p>
        )}

        {/* Footer actions */}
        <div className="mt-3.5 flex items-center justify-end">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs font-medium border-neutral-300 hover:border-black hover:bg-neutral-50 transition-colors">
            <Link href="/inventory" className="flex items-center gap-1">
              View Inventory
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
