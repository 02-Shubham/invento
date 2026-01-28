import { Invoice, InvoiceStatus, PaymentApplication, Payment } from "@/types";

export const calculateInvoiceStatus = (invoice: Invoice): InvoiceStatus => {
  if (invoice.balanceAmount <= 0.01) return 'paid';
  if (invoice.paidAmount > 0 && invoice.balanceAmount > 0.01) return 'partially_paid';
  if (new Date(invoice.dueDate) < new Date() && invoice.balanceAmount > 0.01) return 'overdue';
  return 'unpaid';
};

export const distributePayment = (amount: number, invoices: Invoice[]): PaymentApplication[] => {
  // Sort invoices by due date (oldest first)
  const sortedInvoices = [...invoices].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  let remainingPayment = amount;
  const applications: PaymentApplication[] = [];

  for (const invoice of sortedInvoices) {
    if (remainingPayment <= 0) break;
    
    // Skip fully paid invoices
    if (invoice.balanceAmount <= 0.01) continue;

    const applyAmount = Math.min(remainingPayment, invoice.balanceAmount);
    
    applications.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amountApplied: applyAmount
    });

    remainingPayment -= applyAmount;
  }

  return applications;
};

export const calculateCustomerOutstanding = (invoices: Invoice[]): number => {
  return invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);
};

export const validatePaymentApplication = (amount: number, applications: PaymentApplication[]): boolean => {
  const totalApplied = applications.reduce((sum, app) => sum + app.amountApplied, 0);
  // Allow strict equality or very small floating point diff
  return Math.abs(totalApplied - amount) < 0.01 || totalApplied < amount;
};
