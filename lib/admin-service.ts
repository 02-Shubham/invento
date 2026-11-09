/**
 * Server-side data access (Firebase Admin SDK).
 *
 * Use this from API routes / the AI tool executor ONLY. It mirrors the method
 * names and signatures of `firestoreService` for the operations the server
 * needs, so the browser-facing service stays untouched.
 *
 * The Admin SDK bypasses Firestore security rules, so EVERY method here must
 * enforce `userId` ownership itself. `userId` must always come from
 * `getCurrentUser()` (a verified ID token), never from request input.
 */
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  Product,
  Invoice,
  Customer,
  Payment,
  InvoiceStatus,
  InventoryTransaction,
} from "@/types";

// Admin Timestamps → JS Dates (recursively), matching the client service's output
const convertDates = (data: any): any => {
  if (data instanceof Timestamp) return data.toDate();
  if (Array.isArray(data)) return data.map(convertDates);
  if (data && typeof data === "object") {
    const out: any = {};
    for (const key of Object.keys(data)) out[key] = convertDates(data[key]);
    return out;
  }
  return data;
};

const withId = <T>(snap: FirebaseFirestore.DocumentSnapshot): T =>
  ({ id: snap.id, ...convertDates(snap.data()) } as T);

const now = () => Timestamp.now();

/** Fetch a doc and return it only if it exists AND belongs to the user. */
async function getOwned<T>(
  collectionName: string,
  id: string,
  userId: string
): Promise<T | undefined> {
  const snap = await adminDb().collection(collectionName).doc(id).get();
  if (!snap.exists || snap.data()?.userId !== userId) return undefined;
  return withId<T>(snap);
}

async function listOwned<T>(collectionName: string, userId: string): Promise<T[]> {
  const snap = await adminDb().collection(collectionName).where("userId", "==", userId).get();
  return snap.docs.map((d) => withId<T>(d));
}

/** Throws unless the doc exists and belongs to the user. */
async function assertOwned(collectionName: string, id: string, userId: string, what: string) {
  const ref = adminDb().collection(collectionName).doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== userId) {
    throw new Error(`Unauthorized: You don't have permission to update this ${what}`);
  }
  return ref;
}

export const adminService = {
  // --- Customers ---
  async addCustomer(
    customer: Omit<Customer, "id" | "createdAt" | "updatedAt" | "userId">,
    userId: string
  ) {
    const ref = await adminDb().collection("customers").add({
      ...customer,
      userId,
      createdAt: now(),
      updatedAt: now(),
    });
    return ref.id;
  },

  async updateCustomer(id: string, data: Partial<Customer>, userId: string) {
    const ref = await assertOwned("customers", id, userId, "customer");
    // Never allow re-parenting a document to another user
    const { userId: _ignored, ...safe } = data as any;
    await ref.update({ ...safe, updatedAt: now() });
  },

  /**
   * Atomically add `delta` (may be negative) to a customer's outstanding balance.
   * Uses a server-side increment, so it can never overwrite a concurrent change
   * (e.g. a payment recorded while an approval was pending).
   */
  async adjustCustomerOutstanding(customerId: string, delta: number, userId: string) {
    const ref = await assertOwned("customers", customerId, userId, "customer");
    await ref.update({ totalOutstanding: FieldValue.increment(delta), updatedAt: now() });
  },

  getCustomers: (userId: string) => listOwned<Customer>("customers", userId),

  getCustomerById: (id: string, userId: string) => getOwned<Customer>("customers", id, userId),

  async updateCustomerStats(customerId: string, invoiceTotal: number, userId: string) {
    // Best-effort, like the client service: a stats failure must not fail the invoice.
    try {
      const db = adminDb();
      const ref = db.collection("customers").doc(customerId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const customer = snap.data()!;
        if (customer.userId !== userId) throw new Error("Unauthorized");
        tx.update(ref, {
          totalSpent: (customer.totalSpent || 0) + invoiceTotal,
          totalInvoices: (customer.totalInvoices || 0) + 1,
          lastOrderDate: now(),
          updatedAt: now(),
        });
      });
    } catch (error) {
      console.error("Error updating customer stats:", error);
    }
  },

  // --- Products ---
  async addProduct(
    product: Omit<Product, "id" | "createdAt" | "updatedAt" | "userId">,
    userId: string
  ) {
    const ref = await adminDb().collection("products").add({
      ...product,
      userId,
      createdAt: now(),
      updatedAt: now(),
    });
    return ref.id;
  },

  async updateProduct(id: string, data: Partial<Product>, userId: string) {
    const ref = await assertOwned("products", id, userId, "product");
    const { userId: _ignored, ...safe } = data as any;
    await ref.update({ ...safe, updatedAt: now() });
  },

  getProducts: (userId: string) => listOwned<Product>("products", userId),

  getProductById: (id: string, userId: string) => getOwned<Product>("products", id, userId),

  // --- Invoices ---
  getInvoices: (userId: string) => listOwned<Invoice>("invoices", userId),

  getInvoiceById: (id: string, userId: string) => getOwned<Invoice>("invoices", id, userId),

  /** Creates the invoice, decrements stock and logs inventory transactions atomically. */
  async createInvoiceWithStockUpdate(invoice: Omit<Invoice, "id" | "userId">, userId: string) {
    const db = adminDb();
    return db.runTransaction(async (tx) => {
      const itemsList: any[] = Array.isArray(invoice.items)
        ? invoice.items
        : Object.values(invoice.items || {});

      // Sum quantities per product so duplicate lines can't oversell
      const needed = new Map<string, { qty: number; name: string }>();
      for (const item of itemsList) {
        const entry = needed.get(item.productId) ?? { qty: 0, name: item.name };
        entry.qty += item.quantity;
        needed.set(item.productId, entry);
      }

      // READ PASS
      const updates: Array<{
        ref: FirebaseFirestore.DocumentReference;
        productId: string;
        productName: string;
        quantity: number;
        unitCost: number;
        stockBefore: number;
        newStock: number;
      }> = [];

      for (const [productId, { qty, name }] of needed) {
        const ref = db.collection("products").doc(productId);
        const snap = await tx.get(ref);
        if (!snap.exists || snap.data()?.userId !== userId) {
          throw new Error(`Product "${name}" not found`);
        }
        const product = snap.data()!;
        const currentStock = product.stockQuantity || 0;
        if (currentStock < qty) {
          throw new Error(
            `Insufficient stock for "${name}". Available: ${currentStock}, Requested: ${qty}`
          );
        }
        updates.push({
          ref,
          productId,
          productName: name || product.name || "Product",
          quantity: qty,
          unitCost: product.averageCost || 0,
          stockBefore: currentStock,
          newStock: currentStock - qty,
        });
      }

      // WRITE PASS
      const invoiceRef = db.collection("invoices").doc();
      const invoiceId = invoiceRef.id;

      for (const u of updates) {
        tx.update(u.ref, { stockQuantity: u.newStock, updatedAt: now() });
        const txnRef = db.collection("inventory_transactions").doc();
        tx.set(txnRef, {
          id: txnRef.id,
          userId,
          productId: u.productId,
          productName: u.productName,
          quantity: -u.quantity,
          transactionType: "sale",
          referenceType: "Invoice",
          referenceId: invoiceId,
          stockBefore: u.stockBefore,
          stockAfter: u.newStock,
          unitCost: u.unitCost,
          createdAt: now(),
          notes: `Invoice Sale #${invoiceId.slice(0, 8)}`,
        });
      }

      tx.set(invoiceRef, {
        ...invoice,
        userId, // after the spread: input can never override the owner
        id: invoiceId,
        createdAt: now(),
        invoiceDate: Timestamp.fromDate(new Date((invoice as any).invoiceDate)),
        dueDate: Timestamp.fromDate(new Date((invoice as any).dueDate)),
      });

      return invoiceId;
    });
  },

  // --- Payments ---
  async addPayment(
    paymentData: Omit<Payment, "id" | "createdAt" | "updatedAt" | "userId">,
    userId: string
  ): Promise<string> {
    const db = adminDb();
    return db.runTransaction(async (tx) => {
      const paymentRef = db.collection("payments").doc();
      const applied = paymentData.appliedTo;

      // READS
      const invoiceRefs = applied.map((a) => db.collection("invoices").doc(a.invoiceId));
      const invoiceSnaps = await Promise.all(invoiceRefs.map((r) => tx.get(r)));
      const invoiceMap = new Map<string, any>();
      invoiceSnaps.forEach((snap, i) => {
        if (!snap.exists) throw new Error(`Invoice ${applied[i].invoiceId} not found`);
        if (snap.data()!.userId !== userId) {
          throw new Error("Unauthorized: Invoice does not belong to you");
        }
        invoiceMap.set(applied[i].invoiceId, snap.data());
      });

      const customerRef = db.collection("customers").doc(paymentData.customerId);
      const customerSnap = await tx.get(customerRef);
      if (customerSnap.exists && customerSnap.data()!.userId !== userId) {
        throw new Error("Unauthorized: Customer does not belong to you");
      }

      // WRITES
      applied.forEach((application, i) => {
        const current = invoiceMap.get(application.invoiceId);
        const newPaid = (current.paidAmount || 0) + application.amountApplied;
        const newBalance = (current.total || 0) - newPaid;

        let newStatus: InvoiceStatus;
        if (newBalance <= 0.01) newStatus = "paid";
        else if (newPaid > 0) newStatus = "partially_paid";
        else newStatus = "unpaid";

        tx.update(invoiceRefs[i], {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          status: newStatus,
          payments: [...(current.payments || []), paymentRef.id],
        });
      });

      if (customerSnap.exists) {
        tx.update(customerRef, {
          totalOutstanding: (customerSnap.data()!.totalOutstanding || 0) - paymentData.amount,
        });
      }

      tx.set(paymentRef, {
        ...paymentData,
        userId,
        createdAt: now(),
        updatedAt: now(),
      });

      return paymentRef.id;
    });
  },

  // --- Inventory ---
  /** Applies a stock movement (+in / -out), updates weighted-average cost, logs it. */
  async addInventoryTransaction(
    transactionData: Omit<
      InventoryTransaction,
      "id" | "createdAt" | "stockBefore" | "stockAfter" | "userId"
    >,
    userId: string
  ) {
    const db = adminDb();
    return db.runTransaction(async (tx) => {
      const productRef = db.collection("products").doc(transactionData.productId);
      const snap = await tx.get(productRef);
      if (!snap.exists) throw new Error(`Product ${transactionData.productId} not found`);

      const product = snap.data() as Product;
      if (product.userId !== userId) {
        throw new Error("Unauthorized: Product does not belong to you");
      }

      const currentStock = product.stockQuantity || 0;
      const currentAvgCost = product.averageCost || 0;
      const newStock = currentStock + transactionData.quantity;

      // Checked inside the transaction so concurrent movements can't push stock negative
      if (newStock < 0) {
        throw new Error(
          `Cannot reduce stock below 0. Current stock is ${currentStock}, change is ${transactionData.quantity}.`
        );
      }

      let newAvgCost = currentAvgCost;
      if (transactionData.quantity > 0 && transactionData.unitCost !== undefined && newStock > 0) {
        newAvgCost =
          (currentStock * currentAvgCost + transactionData.quantity * transactionData.unitCost) /
          newStock;
      }

      // Firestore rejects `undefined` field values, so strip them
      const clean = Object.fromEntries(
        Object.entries(transactionData).filter(([, v]) => v !== undefined)
      );

      const txnRef = db.collection("inventory_transactions").doc();
      tx.set(txnRef, {
        ...clean,
        userId,
        stockBefore: currentStock,
        stockAfter: newStock,
        totalCost: transactionData.unitCost
          ? Math.abs(transactionData.quantity) * transactionData.unitCost
          : 0,
        createdAt: now(),
      });

      tx.update(productRef, {
        stockQuantity: newStock,
        averageCost: newAvgCost,
        lastCost: transactionData.unitCost || product.lastCost || 0,
        totalValue: newStock * newAvgCost,
        updatedAt: now(),
      });

      return txnRef.id;
    });
  },

  // --- User settings ---
  async getUserSettings(userId: string) {
    const snap = await adminDb().collection("user_settings").doc(userId).get();
    return snap.exists ? withId<any>(snap) : null;
  },
};
