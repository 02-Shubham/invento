"use client";

import { useStore } from "@/lib/store"; // Keeping for settings/other if needed, but removing product/actions
import { useAuth } from "@/lib/auth-context";
import { Product } from "@/types";
import { useState, useEffect } from "react";
import {
  ColumnDef,
  getCoreRowModel,
  useReactTable,
  flexRender,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoreHorizontal, Plus, Search, RefreshCw } from "lucide-react";
import { ProductForm } from "@/components/inventory/ProductForm";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { firestoreService } from "@/lib/firestore-service";

export default function InventoryPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const data = await firestoreService.getProducts(user.uid);
      setProducts(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch products");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "sku",
      header: "SKU",
    },
    {
      accessorKey: "category",
      header: "Category",
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => {
        const price = parseFloat(row.getValue("price"));
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(price);
      },
    },
    {
      accessorKey: "stockQuantity",
      header: "Stock",
      cell: ({ row }) => {
        const val = row.getValue("stockQuantity");
        const stock = typeof val === 'number' ? val : parseFloat(val as string) || 0; 
        const reorderLevel = row.original.reorderLevel || 0;
        
        return (
             <div className="flex items-center space-x-2">
                <span>{stock}</span>
                {stock === 0 ? (
                    <Badge variant="destructive">Out of Stock</Badge>
                ) : stock < reorderLevel ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Low Stock</Badge>
                ) : (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-transparent">In Stock</Badge>
                )}
             </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const product = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setEditingProduct(product)}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={async () => {
                   if (!user) return;
                   if (confirm('Are you sure you want to delete this product?')) {
                     try {
                        await firestoreService.deleteProduct(product.id, user.uid);
                        toast.success("Product deleted");
                        fetchProducts();
                     } catch (error) {
                         toast.error("Failed to delete product");
                     }
                   }
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
    },
  });

  const handleCreateProduct = async (data: any) => {
    if (!user) return;
    try {
      await firestoreService.addProduct(data, user.uid);
      setIsAddOpen(false);
      toast.success("Product created successfully");
      fetchProducts();
    } catch (error) {
      toast.error("Failed to create product");
    }
  };

  const handleUpdateProduct = async (data: any) => {
    if (!editingProduct || !user) return;
    try {
       await firestoreService.updateProduct(editingProduct.id, data, user.uid);
       setEditingProduct(null);
       toast.success("Product updated successfully");
       fetchProducts();
    } catch (error) {
       toast.error("Failed to update product");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <div className="flex space-x-2">
            <Button variant="outline" size="icon" onClick={fetchProducts} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
                <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Product
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                </DialogHeader>
                <ProductForm
                onSubmit={handleCreateProduct}
                onCancel={() => setIsAddOpen(false)}
                isLoading={isLoading}
                />
            </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="flex items-center py-4">
        <div className="relative w-full max-w-sm">
             <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
            placeholder="Search products..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="pl-8"
            />
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        Loading products...
                    </TableCell>
                </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
       {/* Edit Dialog */}
       <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
            </DialogHeader>
            {editingProduct && (
                 <ProductForm
                 initialData={editingProduct}
                 onSubmit={handleUpdateProduct}
                 onCancel={() => setEditingProduct(null)}
                 isLoading={isLoading}
               />
            )}
        </DialogContent>
       </Dialog>
       
    </div>
  );
}
