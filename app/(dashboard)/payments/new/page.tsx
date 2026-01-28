import { CreatePaymentForm } from "@/components/payments/CreatePaymentForm";

export default function NewPaymentPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Record Payment</h1>
        <p className="text-muted-foreground">
          Record a new payment from a customer and apply it to their invoices.
        </p>
      </div>
      <CreatePaymentForm />
    </div>
  );
}
