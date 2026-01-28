"use client";

import { useStore } from "@/lib/store"; // Keeping for settings if needed
import { Invoice } from "@/types";
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
import { MoreHorizontal, Plus, Search, RefreshCw, Filter } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { firestoreService } from "@/lib/firestore-service";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export default function InvoicesPage() {
  const { user } = useAuth(); // Get authenticated user
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const fetchInvoices = async () => {
    if (!user) return; // Wait for user
    try {
      setIsLoading(true);
      const data = await firestoreService.getInvoices(user.uid);
      // Sort by newest first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInvoices(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch invoices");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
        fetchInvoices();
    }
  }, [user]);

  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => <span className="font-medium">{row.getValue("invoiceNumber")}</span>
    },
    {
      accessorKey: "customerName",
      header: "Customer",
    },
    {
      accessorKey: "invoiceDate",
      header: "Date",
      cell: ({ row }) => {
        const val = row.getValue("invoiceDate");
        if (!val) return "N/A";
        const date = new Date(val as any);
        if (isNaN(date.getTime())) return "Invalid Date";
        return format(date, "MMM d, yyyy");
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={
              status === "paid"
                ? "default"
                : status === "partially_paid"
                ? "outline"
                : status === "pending"
                ? "secondary" 
                : "destructive"
            }
            className={
                status === "paid" ? "bg-green-600 hover:bg-green-600" : 
                status === "partially_paid" ? "bg-blue-500 text-white border-transparent hover:bg-blue-600" :
                status === "pending" ? "bg-amber-500 text-white hover:bg-amber-600" : ""
            }
          >
            {status.toUpperCase().replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "total",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("total"));
        return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
      },
    },
    {
      accessorKey: "balanceAmount",
      header: () => <div className="text-right">Balance</div>,
      cell: ({ row }) => {
        const balance = row.original.balanceAmount ?? row.original.total;
        return <div className="text-right font-medium text-red-600">{formatCurrency(balance)}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const invoice = row.original;
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
                onClick={() => navigator.clipboard.writeText(invoice.id)}
              >
                Copy ID
              </DropdownMenuItem>
              <Link href={`/invoices/${invoice.id}`}>
                <DropdownMenuItem>View details</DropdownMenuItem>
              </Link>
              <Link href={`/payments/new?customerId=${invoice.customerId}`}>
                <DropdownMenuItem>Record Payment</DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <Button onClick={fetchInvoices} variant="outline" size="sm" className="mr-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
            placeholder="Filter by customer..."
            value={(table.getColumn("customerName")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
                table.getColumn("customerName")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
            />
        </div>
        
        <Link href="/invoices/new">
            <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Button>
        </Link>
      </div>

      <div className="rounded-md border">
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
            {table.getRowModel().rows?.length ? (
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
                  {isLoading ? "Loading..." : "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
