import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  Timestamp,
  QueryDocumentSnapshot,
  runTransaction,
  writeBatch,
  where,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import { Product, Invoice, Customer, Payment, InvoiceStatus, InventoryTransaction, TransactionType, PurchaseOrder } from "@/types";
import { getUserCollection, getCurrentUserId } from "./firestore-helpers";

// Helper to convert Firestore dates to JS Dates
const convertDates = (data: any) => {
  const newData = { ...data };
  for (const key in newData) {
    if (newData[key] instanceof Timestamp) {
      newData[key] = newData[key].toDate();
    } else if (typeof newData[key] === 'object' && newData[key] !== null) {
      newData[key] = convertDates(newData[key]);
    }
  }
  return newData;
};

// Generic converter
const converter = <T>() => ({
  toFirestore: (data: T) => data,
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const data = snap.data();
    return { id: snap.id, ...convertDates(data) } as T;
  },
});

export const firestoreService = {
  // --- Helpers ---
  convertTransaction: (doc: QueryDocumentSnapshot): InventoryTransaction => {
      const data = doc.data();
      return { 
          id: doc.id, 
          ...convertDates(data) 
      } as InventoryTransaction;
  },

  // --- Customers ---
  async addCustomer(customer: Omit<Customer, "id" | "createdAt" | "updatedAt" | "userId">, userId: string) {
    try {
      const docRef = await addDoc(collection(db, "customers"), {
        ...customer,
        userId,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding customer:", error);
      throw error;
    }
  },

  async updateCustomer(id: string, data: Partial<Customer>, userId: string) {
    try {
      const docRef = doc(db, "customers", id);
      // Verify ownership
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error("Unauthorized: You don't have permission to update this customer");
      }
      await updateDoc(docRef, { ...data, updatedAt: Timestamp.fromDate(new Date()) });
    } catch (error) {
      console.error("Error updating customer:", error);
      throw error;
    }
  },

  async deleteCustomer(id: string, userId: string) {
    try {
      const docRef = doc(db, "customers", id);
      // Verify ownership
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error("Unauthorized: You don't have permission to delete this customer");
      }
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw error;
    }
  },

  async getCustomers(userId: string): Promise<Customer[]> {
    try {
      const q = getUserCollection("customers", userId);
      const querySnapshot = await getDocs(q.withConverter(converter<Customer>()));
      return querySnapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error("Error getting customers:", error);
      throw error;
    }
  },

  async getCustomerById(id: string, userId: string): Promise<Customer | undefined> {
    try {
      const docRef = doc(db, "customers", id).withConverter(converter<Customer>());
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        return undefined;
      }
      return docSnap.data();
    } catch (error) {
      console.error("Error getting customer:", error);
      throw error;
    }
  },

  async updateCustomerStats(customerId: string, invoiceTotal: number, userId: string) {
     try {
       const customerRef = doc(db, "customers", customerId);
       await runTransaction(db, async (transaction) => {
         const customerSnap = await transaction.get(customerRef);
         if (!customerSnap.exists()) return;
         
         const customer = customerSnap.data();
         if (customer.userId !== userId) {
           throw new Error("Unauthorized");
         }
         
         transaction.update(customerRef, {
           totalSpent: (customer.totalSpent || 0) + invoiceTotal,
           totalInvoices: (customer.totalInvoices || 0) + 1,
           lastOrderDate: Timestamp.fromDate(new Date()),
           updatedAt: Timestamp.fromDate(new Date())
         });
       });
     } catch (error) {
        console.error("Error updating customer stats:", error);
     }
  },

  // --- Products ---
  async addProduct(product: Omit<Product, "id" | "createdAt" | "updatedAt" | "userId">, userId: string) {
    try {
      const docRef = await addDoc(collection(db, "products"), {
        ...product,
        userId,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding product:", error);
      throw error;
    }
  },

  async updateProduct(id: string, data: Partial<Product>, userId: string) {
    try {
      const docRef = doc(db, "products", id);
      // Verify ownership
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error("Unauthorized: You don't have permission to update this product");
      }
      await updateDoc(docRef, { ...data, updatedAt: Timestamp.fromDate(new Date()) });
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  },

  async deleteProduct(id: string, userId: string) {
    try {
      const docRef = doc(db, "products", id);
      // Verify ownership
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error("Unauthorized: You don't have permission to delete this product");
      }
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  },

  async getProducts(userId: string): Promise<Product[]> {
    try {
      const q = getUserCollection("products", userId);
      const querySnapshot = await getDocs(q.withConverter(converter<Product>()));
      return querySnapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error("Error getting products:", error);
      throw error;
    }
  },

  async getProductById(id: string, userId: string): Promise<Product | undefined> {
    try {
      const docRef = doc(db, "products", id).withConverter(converter<Product>());
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        return undefined;
      }
      return docSnap.data();
    } catch (error) {
      console.error("Error getting product:", error);
      throw error;
    }
  },
    
  async updateProductStock(id: string, newQuantity: number, userId: string) {
      try {
        const docRef = doc(db, "products", id);
        // Verify ownership
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || docSnap.data().userId !== userId) {
          throw new Error("Unauthorized");
        }
        await updateDoc(docRef, { stockQuantity: newQuantity, updatedAt: Timestamp.fromDate(new Date()) });
      } catch (error) {
        console.error("Error updating stock:", error);
        throw error;
      }
  },


  // --- Invoices ---
  async addInvoice(invoice: Omit<Invoice, "id" | "userId">, userId: string) {
    try {
      const docRef = await addDoc(collection(db, "invoices"), {
        ...invoice,
        userId,
        createdAt: Timestamp.fromDate(new Date()),
        invoiceDate: Timestamp.fromDate(new Date((invoice as any).invoiceDate)),
        dueDate: Timestamp.fromDate(new Date((invoice as any).dueDate)),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding invoice:", error);
      throw error;
    }
  },

  async getInvoices(userId: string): Promise<Invoice[]> {
    try {
      const q = getUserCollection("invoices", userId);
      const querySnapshot = await getDocs(q.withConverter(converter<Invoice>()));
      return querySnapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error("Error getting invoices:", error);
      throw error;
    }
  },

  async getInvoiceById(id: string, userId: string): Promise<Invoice | undefined> {
    try {
      const docRef = doc(db, "invoices", id).withConverter(converter<Invoice>());
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        return undefined;
      }
      return docSnap.data();
    } catch (error) {
      console.error("Error getting invoice:", error);
      throw error;
    }
  },

  async updateInvoiceStatus(id: string, status: string, userId: string) {
    try {
      const docRef = doc(db, "invoices", id);
      // Verify ownership
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error("Unauthorized");
      }
      await updateDoc(docRef, { status });
    } catch (error) {
      console.error("Error updating invoice status:", error);
      throw error;
    }
  },

  async deleteInvoice(id: string, userId: string) {
    try {
      const docRef = doc(db, "invoices", id);
      // Verify ownership
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error("Unauthorized");
      }
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw error;
    }
  },

  async createInvoiceWithStockUpdate(invoice: Omit<Invoice, "id" | "userId">, userId: string) {
    try {
      return await runTransaction(db, async (transaction) => {
        // 1. READ PASS: Check stock for all items first
        const productUpdates = [];
        const itemsList = Array.isArray(invoice.items) ? invoice.items : Object.values(invoice.items || {});
        
        for (const item of itemsList) {
          const productRef = doc(db, "products", item.productId);
          const productSnap = await transaction.get(productRef); // READ
          
          if (!productSnap.exists()) {
            throw new Error(`Product "${item.name}" not found`);
          }

          const productData = productSnap.data();
          // Verify product belongs to user
          if (productData.userId !== userId) {
            throw new Error(`Product "${item.name}" not found`);
          }

          const currentStock = productData.stockQuantity || 0;

          if (currentStock < item.quantity) {
             throw new Error(`Insufficient stock for "${item.name}". Available: ${currentStock}, Requested: ${item.quantity}`);
          }
          
          // Store the update for later
          productUpdates.push({
              ref: productRef,
              productId: item.productId,
              productName: item.name || "Product", // Fallback
              quantity: item.quantity,
              unitCost: productData.averageCost || 0, // Store cost at time of sale
              stockBefore: currentStock,
              newStock: currentStock - item.quantity,
              transactionType: 'sale' as TransactionType
          });
        }

        // 3. Create invoice (Use set instead of addDoc inside transaction)
        const invoiceRef = doc(collection(db, "invoices")); 
        const invoiceId = invoiceRef.id;

        // 2. WRITE PASS: Perform all updates and log transactions
        for (const update of productUpdates) {
             // Update Product Stock
             transaction.update(update.ref, { 
                stockQuantity: update.newStock,
                updatedAt: Timestamp.fromDate(new Date())
             });

             // Create Inventory Transaction Log
             const txnRef = doc(collection(db, "inventory_transactions"));
             transaction.set(txnRef, {
                 id: txnRef.id,
                 userId,
                 productId: update.productId,
                 productName: update.productName,
                 quantity: -update.quantity, // Negative for sale
                 transactionType: 'sale',
                 referenceType: 'Invoice',
                 referenceId: invoiceId,
                 stockBefore: update.stockBefore,
                 stockAfter: update.newStock,
                 unitCost: update.unitCost, // Cost at time of sale (COGS tracking)
                 createdAt: Timestamp.fromDate(new Date()),
                 notes: `Invoice Sale #${invoiceId.slice(0, 8)}`
             });
        }

        transaction.set(invoiceRef, {
          ...invoice,
          userId,
          id: invoiceId, 
          createdAt: Timestamp.fromDate(new Date()),
          invoiceDate: Timestamp.fromDate(new Date((invoice as any).invoiceDate)),
          dueDate: Timestamp.fromDate(new Date((invoice as any).dueDate)),
        });
        
        return invoiceId;
      });
    } catch (error: any) {
       console.error("Transaction failed: ", error);
       throw error;
    }

  },

  // --- Payments ---

  async getPayments(userId: string): Promise<Payment[]> {
    const q = getUserCollection("payments", userId, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      paymentDate: doc.data().paymentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Payment[];
  },

  async getPaymentById(id: string, userId: string): Promise<Payment | null> {
    const docRef = doc(db, "payments", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) return null;
    return {
      id: docSnap.id,
      ...docSnap.data(),
      paymentDate: docSnap.data().paymentDate?.toDate(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate(),
    } as Payment;
  },

  async getCustomerPayments(customerId: string, userId: string): Promise<Payment[]> {
    const q = query(
      getUserCollection("payments", userId),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      paymentDate: doc.data().paymentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Payment[];
  },

  async addPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, userId: string): Promise<string> {
    return await runTransaction(db, async (transaction) => {
      // 1. Create Payment Ref
      const paymentRef = doc(collection(db, "payments"));
      
      // 2. Prepare Payment Data
      const newPayment: any = {
        ...paymentData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 3. READS PHASE
      // 3.1 Read all invoices involved
      const invoiceRefs = paymentData.appliedTo.map((app: any) => doc(db, "invoices", app.invoiceId));
      const invoiceDocs = await Promise.all(invoiceRefs.map((ref: any) => transaction.get(ref)));
      
      const invoiceMap = new Map<string, Invoice>();
      invoiceDocs.forEach((doc: any, index: number) => {
          if (!doc.exists()) {
             throw new Error(`Invoice ${paymentData.appliedTo[index].invoiceId} not found`);
          }
          const invoiceData = doc.data();
          if (invoiceData.userId !== userId) {
            throw new Error("Unauthorized: Invoice does not belong to you");
          }
          invoiceMap.set(paymentData.appliedTo[index].invoiceId, invoiceData as Invoice);
      });

      // 3.2 Read Customer
      const customerRef = doc(db, "customers", paymentData.customerId);
      const customerDoc = await transaction.get(customerRef);
      if (customerDoc.exists() && customerDoc.data().userId !== userId) {
        throw new Error("Unauthorized: Customer does not belong to you");
      }

          // WRITES PHASE
          // 4.1 Update Invoices
          paymentData.appliedTo.forEach((application: any) => {
              const invoiceRef = doc(db, "invoices", application.invoiceId);
              const currentInvoice = invoiceMap.get(application.invoiceId)!;

          const newPaidAmount = (currentInvoice.paidAmount || 0) + application.amountApplied;
          const newBalanceAmount = (currentInvoice.total || 0) - newPaidAmount;
          
          let newStatus: InvoiceStatus = 'pending';
          if (newBalanceAmount <= 0.01) newStatus = 'paid'; // tolerance for float errors
          else if (newPaidAmount > 0) newStatus = 'partially_paid';
          else newStatus = 'unpaid';

          const currentPayments = currentInvoice.payments || [];

          transaction.update(invoiceRef, {
              paidAmount: newPaidAmount,
              balanceAmount: newBalanceAmount,
              status: newStatus,
              payments: [...currentPayments, paymentRef.id]
          });
      });

      // 4.2 Update Customer Outstanding
      if (customerDoc.exists()) {
          const currentOutstanding = customerDoc.data().totalOutstanding || 0;
          transaction.update(customerRef, {
              totalOutstanding: currentOutstanding - paymentData.amount
          });
      }

      // 4.3 Commit Payment
      transaction.set(paymentRef, newPayment);
      
      return paymentRef.id;
    });
  },

  async deletePayment(id: string, userId: string): Promise<void> {
      return await runTransaction(db, async (transaction) => {
          const paymentRef = doc(db, "payments", id);
          const paymentDoc = await transaction.get(paymentRef);
          
          if (!paymentDoc.exists()) throw new Error("Payment not found");
          
          const payment = paymentDoc.data() as Payment;
          if (payment.userId !== userId) {
            throw new Error("Unauthorized");
          }

          // READS PHASE
          // 1. Read all associated invoices
          const invoiceRefs = payment.appliedTo.map((app: any) => doc(db, "invoices", app.invoiceId));
          
          // However, we also need to read the customer.
          const customerRef = doc(db, "customers", payment.customerId);
          
          // Execute all reads
          const [customerDoc, ...invoiceDocs] = await Promise.all([
             transaction.get(customerRef),
             ...invoiceRefs.map((ref: any) => transaction.get(ref))
          ]);

          const invoiceMap = new Map<string, Invoice>();
          // Map invoice docs back to their IDs
          // invoiceDocs order matches payment.appliedTo order
          invoiceDocs.forEach((doc: any, index: number) => {
              if (doc.exists()) {
                  const invoiceData = doc.data();
                  if (invoiceData.userId !== userId) {
                    throw new Error("Unauthorized");
                  }
                  invoiceMap.set(payment.appliedTo[index].invoiceId, invoiceData as Invoice);
              }
          });

          // WRITES PHASE
          // 2. Reverse Invoice Updates
           payment.appliedTo.forEach((application: any) => {
              const invoice = invoiceMap.get(application.invoiceId);
              if (invoice) {
                  const invoiceRef = doc(db, "invoices", application.invoiceId);
                  
                  const newPaidAmount = (invoice.paidAmount || 0) - application.amountApplied;
                  const newBalanceAmount = (invoice.total || 0) - newPaidAmount;
                  
                  let invoiceDueDate = invoice.dueDate;
                  // Handle strict TS check if it thinks it is Date but runtime is Timestamp
                  if (invoiceDueDate && (invoiceDueDate as any).toDate) {
                      invoiceDueDate = (invoiceDueDate as any).toDate();
                  }

                  let newStatus: InvoiceStatus = 'pending';
                  if (newBalanceAmount <= 0.01) newStatus = 'paid';
                  else if (newPaidAmount > 0) newStatus = 'partially_paid';
                  else if (new Date(invoiceDueDate) < new Date()) newStatus = 'overdue';
                  else newStatus = 'unpaid';

                  const currentPayments = invoice.payments || [];
                  const updatedPayments = currentPayments.filter((pid: any) => pid !== id);

                  transaction.update(invoiceRef, {
                      paidAmount: newPaidAmount,
                      balanceAmount: newBalanceAmount,
                      status: newStatus,
                      payments: updatedPayments
                  });
              }
           });

          // 3. Reverse Customer Outstanding
          if (customerDoc.exists()) {
              const currentOutstanding = customerDoc.data().totalOutstanding || 0;
              transaction.update(customerRef, {
                  totalOutstanding: currentOutstanding + payment.amount
              });
          }

          // 4. Delete Payment
          transaction.delete(paymentRef);
      });
  },

  // --- Inventory Management ---
  async addInventoryTransaction(transactionData: Omit<InventoryTransaction, 'id' | 'createdAt' | 'stockBefore' | 'stockAfter' | 'userId'>, userId: string) {
    return await runTransaction(db, async (txn) => {
        const productRef = doc(db, "products", transactionData.productId);
        const productDoc = await txn.get(productRef);

        if (!productDoc.exists()) {
            throw new Error(`Product ${transactionData.productId} not found`);
        }

        const product = productDoc.data() as Product;
        if (product.userId !== userId) {
          throw new Error("Unauthorized: Product does not belong to you");
        }

        const currentStock = product.stockQuantity || 0;
        const currentAvgCost = product.averageCost || 0;
        
        // Calculate new stock
        // transactionData.quantity is positive for IN, negative for OUT
        const newStock = currentStock + transactionData.quantity;

        // Calculate new Weighted Average Cost (only for stock IN)
        let newAvgCost = currentAvgCost;
        if (transactionData.quantity > 0 && transactionData.unitCost !== undefined) {
             const currentValue = currentStock * currentAvgCost;
             const addedValue = transactionData.quantity * transactionData.unitCost;
             // Protect against divide by zero if newStock is 0 (unlikely for addition)
             const tempStock = currentStock + transactionData.quantity; // basically newStock
             
             if (tempStock > 0) {
                 newAvgCost = (currentValue + addedValue) / tempStock;
             }
        }
        
        // Calculate new Total Value
        const newTotalValue = newStock * newAvgCost;

        // Create Transaction Record
        const transactionRef = doc(collection(db, "inventory_transactions"));
        const newTransaction: any = {
            ...transactionData,
            userId,
            stockBefore: currentStock,
            stockAfter: newStock,
            totalCost: transactionData.unitCost ? (Math.abs(transactionData.quantity) * transactionData.unitCost) : 0,
            createdAt: new Date(),
        };

        // Writes
        txn.set(transactionRef, newTransaction);
        
        txn.update(productRef, {
            stockQuantity: newStock,
            averageCost: newAvgCost,
            lastCost: transactionData.unitCost || product.lastCost || 0, // Update last cost if provided
            totalValue: newTotalValue,
            updatedAt: new Date()
        });

        return transactionRef.id;
    });
  },

  async getInventoryTransactions(userId: string, filters?: {
      productId?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      type?: TransactionType;
  }) {
      try {
          let q = getUserCollection("inventory_transactions", userId, orderBy("createdAt", "desc"));
          
          if (filters?.productId) {
              q = query(q, where("productId", "==", filters.productId));
          }
          
          if (filters?.type) {
              q = query(q, where("transactionType", "==", filters.type));
          }

          const snapshot = await getDocs(q);
          const transactions = snapshot.docs.map(converter<InventoryTransaction>().fromFirestore);
          
          let filtered = transactions;
          if (filters?.startDate) {
              filtered = filtered.filter(t => t.createdAt >= filters.startDate!);
          }
          if (filters?.endDate) {
              filtered = filtered.filter(t => t.createdAt <= filters.endDate!);
          }
          
          return filtered;
      } catch (error) {
          console.error("Error fetching transactions:", error);
          throw error;
      }
  },

  // Purchase Order Methods
  async addPurchaseOrder(po: Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt" | "userId">, userId: string) {
      const docRef = await addDoc(collection(db, "purchase_orders"), {
          ...po,
          userId,
          status: 'ordered',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
      });
      return docRef.id;
  },

  async getPurchaseOrders(userId: string) {
      const q = getUserCollection("purchase_orders", userId, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
  },

  async getPurchaseOrderById(id: string, userId: string) {
      const docRef = doc(db, "purchase_orders", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.userId !== userId) {
          return null;
        }
        return { id: docSnap.id, ...data } as PurchaseOrder;
      }
      return null;
  },

  async updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>, userId: string) {
      const docRef = doc(db, "purchase_orders", id);
      // Verify ownership
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().userId !== userId) {
        throw new Error("Unauthorized");
      }
      await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
  }

};
