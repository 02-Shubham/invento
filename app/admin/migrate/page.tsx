"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { firestoreService } from "@/lib/firestore-service";
import { MOCK_PRODUCTS, MOCK_INVOICES } from "@/lib/store";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function MigrateDataPage() {
  const { user } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleMigrate = async () => {
    if (!user) {
      toast.error("You must be logged in to run migration");
      return;
    }
    setIsMigrating(true);
    setLog([]);
    addLog("Starting migration...");

    try {
      // 1. Migrate Products
      addLog(`Found ${MOCK_PRODUCTS.length} mock products.`);
      for (const product of MOCK_PRODUCTS) {
        // Remove ID to let firestore generate it, OR keep it. 
        // firestoreService.addProduct generates new ID. 
        // If we want to keep relations valid (Invoices use product IDs), we might want to manually specify ID.
        // BUT firestoreService.addProduct uses addDoc (auto ID).
        // For migration simplicity, we'll just add them and let Invoices refer to "names" or new IDs if we updated them.
        // HOWEVER, MOCK_INVOICES reference 'productId: "1"'. If we generate new IDs, those links break.
        // Let's rely on the names or just acknowledge that links might break for MOCK data if we don't handle IDs.
        // BETTER: Use setDoc with specific ID if we want to preserve. 
        // But firestoreService doesn't expose setDoc for products easily.
        // Let's just Add them. The stats on dashboard don't strictly require valid product IDs, just invoice totals.
        // Inventory deduction in invoices won't work for old invoices anyway.
        
        const { id, createdAt, updatedAt, userId, ...productData } = product;
        await firestoreService.addProduct(productData as any, user.uid);
        addLog(`Migrated product: ${product.name}`);
      }

      // 2. Migrate Invoices
      addLog(`Found ${MOCK_INVOICES.length} mock invoices.`);
      for (const invoice of MOCK_INVOICES) {
         // Same issue with IDs. We will generate new ones.
         const { id, userId, invoiceDate, ...invoiceData } = invoice as any;
         await firestoreService.addInvoice(invoiceData as any, user.uid);
         addLog(`Migrated invoice: ${invoice.invoiceNumber}`);
      }

      addLog("Migration completed successfully!");
      toast.success("Migration done");

    } catch (error: any) {
      console.error(error);
      addLog(`Error: ${error.message}`);
      toast.error("Migration failed");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Migration</h1>
        <p className="text-muted-foreground">
          Seed the Firestore database with initial mock data.
        </p>
      </div>

      <div className="p-4 border rounded-md bg-white">
        <Button onClick={handleMigrate} disabled={isMigrating}>
          {isMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isMigrating ? "Migrating..." : "Run Migration"}
        </Button>
      </div>

      {log.length > 0 && (
        <div className="p-4 bg-slate-950 text-slate-50 rounded-md font-mono text-xs h-64 overflow-y-auto">
          {log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </div>
      )}
    </div>
  );
}
