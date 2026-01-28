"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { firestoreService } from "@/lib/firestore-service";
import { InventoryTransaction, Product, TransactionType } from "@/types";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";

export default function StockHistoryPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [productFilter, setProductFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    // Fetch Products for filter
    const qProd = query(collection(db, "products"), orderBy("name"));
    const unsubProd = onSnapshot(qProd, (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    // Fetch Transactions (Real-time for now, ideally filtered server-side)
    const qTrans = query(collection(db, "inventory_transactions"), orderBy("createdAt", "desc"));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => firestoreService.convertTransaction(doc)) as unknown as InventoryTransaction[]);
        setLoading(false);
    });

    return () => {
        unsubProd();
        unsubTrans();
    };
  }, []);

  const filteredTransactions = transactions.filter(t => {
      const matchProduct = productFilter === "all" || t.productId === productFilter;
      const matchType = typeFilter === "all" || t.transactionType === typeFilter;
      return matchProduct && matchType;
  });

  const getBadgeColor = (type: TransactionType) => {
      switch (type) {
          case 'purchase': return "bg-blue-100 text-blue-800 hover:bg-blue-100";
          case 'production': return "bg-green-100 text-green-800 hover:bg-green-100";
          case 'sale': return "bg-orange-100 text-orange-800 hover:bg-orange-100";
          case 'return_customer': return "bg-purple-100 text-purple-800 hover:bg-purple-100";
          case 'return_vendor': return "bg-red-100 text-red-800 hover:bg-red-100";
          case 'adjustment': return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
          default: return "bg-gray-100 text-gray-800";
      }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Movement History</h1>
        <p className="text-muted-foreground mt-2">
            View all inventory transactions including purchases, sales, and corrections.
        </p>
      </div>

      <Card>
          <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <div className="flex gap-4 pt-4">
                  <div className="w-[250px]">
                      <Select value={productFilter} onValueChange={setProductFilter}>
                          <SelectTrigger>
                              <SelectValue placeholder="Filter by Product" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">All Products</SelectItem>
                              {products.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="w-[200px]">
                       <Select value={typeFilter} onValueChange={setTypeFilter}>
                          <SelectTrigger>
                              <SelectValue placeholder="Filter by Type" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              <SelectItem value="purchase">Purchase</SelectItem>
                              <SelectItem value="production">Production</SelectItem>
                              <SelectItem value="sale">Sale</SelectItem>
                              <SelectItem value="adjustment">Adjustment</SelectItem>
                              <SelectItem value="return_customer">Customer Return</SelectItem>
                              <SelectItem value="return_vendor">Vendor Return</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <Button variant="outline" onClick={() => { setProductFilter("all"); setTypeFilter("all"); }}>
                      Reset
                  </Button>
              </div>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Cost</TableHead>
                          <TableHead>Ref</TableHead>
                          <TableHead>Start → End</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {loading ? (
                          <TableRow>
                              <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                          </TableRow>
                      ) : filteredTransactions.length === 0 ? (
                          <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                  No transactions found.
                              </TableCell>
                          </TableRow>
                      ) : (
                          filteredTransactions.map((t) => (
                              <TableRow key={t.id}>
                                  <TableCell className="whitespace-nowrap">
                                      {t.createdAt ? format(t.createdAt, "MMM d, yyyy h:mm a") : "-"}
                                  </TableCell>
                                  <TableCell className="font-medium">{t.productName}</TableCell>
                                  <TableCell>
                                      <Badge className={getBadgeColor(t.transactionType)} variant="outline">
                                          {t.transactionType.replace('_', ' ')}
                                      </Badge>
                                  </TableCell>
                                  <TableCell className={t.quantity > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                      {t.quantity > 0 ? "+" : ""}{t.quantity}
                                  </TableCell>
                                  <TableCell>
                                      {t.unitCost ? formatCurrency(t.unitCost) : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                      {t.referenceNumber || "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                      {t.stockBefore} → {t.stockAfter}
                                  </TableCell>
                              </TableRow>
                          ))
                      )}
                  </TableBody>
              </Table>
          </CardContent>
      </Card>
    </div>
  );
}
