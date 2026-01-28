import { CreateInvoiceForm } from "@/components/invoices/CreateInvoiceForm";

export default function NewInvoicePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
        <p className="text-muted-foreground">
          Create a new invoice for a customer. Inventory stock will be deducted automatically.
        </p>
      </div>
      <CreateInvoiceForm />
    </div>
  );
}
