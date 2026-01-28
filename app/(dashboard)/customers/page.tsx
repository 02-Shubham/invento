"use client";

import { useEffect, useState } from "react";
import { 
  ColumnDef, 
  flexRender, 
  getCoreRowModel, 
  useReactTable, 
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { firestoreService } from "@/lib/firestore-service";
import { Customer } from "@/types";
import { Loader2, Plus, Search, MoreHorizontal, Pencil, Trash2, CreditCard } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

// Form Schema
const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  company: z.string().optional(),
  taxId: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sorting, setSorting] = useState<SortingState>([]);
    
    // Dialog States
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    const { user } = useAuth(); // Get authenticated user
    const router = useRouter();

    const fetchCustomers = async () => {
        if (!user) return; // Wait for user
        setIsLoading(true);
        try {
            const data = await firestoreService.getCustomers(user.uid);
            setCustomers(data);
        } catch (error) {
            console.error("Failed to fetch customers", error);
            toast.error("Failed to load customers");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchCustomers();
        }
    }, [user]);

    // Add/Edit Form Logic
    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            address: "",
            company: "",
            taxId: "",
        },
    });

    const onSubmit = async (data: CustomerFormValues) => {
        if (!user) return;
        try {
            if (editingCustomer) {
                await firestoreService.updateCustomer(editingCustomer.id, data, user.uid);
                toast.success("Customer updated successfully");
                setIsEditDialogOpen(false);
            } else {
                await firestoreService.addCustomer({
                    ...data,
                    totalSpent: 0,
                    totalInvoices: 0,
                    totalOutstanding: 0,
                }, user.uid);
                toast.success("Customer created successfully");
                setIsAddDialogOpen(false);
            }
            fetchCustomers();
            form.reset();
            setEditingCustomer(null);
        } catch (error) {
            console.error("Error saving customer", error);
            toast.error("Failed to save customer");
        }
    };

    const handleEditClick = (customer: Customer) => {
        setEditingCustomer(customer);
        form.reset({
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            company: customer.company || "",
            taxId: customer.taxId || "",
        });
        setIsEditDialogOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!user) return;
        if(confirm("Are you sure? This cannot be undone.")) {
            try {
                await firestoreService.deleteCustomer(id, user.uid);
                toast.success("Customer deleted");
                fetchCustomers();
            } catch (error) {
                 toast.error("Failed to delete customer");
            }
        }
    }


    const columns: ColumnDef<Customer>[] = [
        {
          accessorKey: "name",
          header: "Name",
          cell: ({ row }) => (
              <div className="font-medium">
                  <Link href={`/customers/${row.original.id}`} className="hover:underline text-primary">
                      {row.original.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.original.email}</div>
              </div>
          )
        },
        {
            accessorKey: "company",
            header: "Company",
            cell: ({ row }) => row.original.company || "-"
        },
        {
            accessorKey: "phone",
            header: "Phone",
        },
        {
          accessorKey: "totalInvoices",
          header: "Invoices",
          cell: ({ row }) => <div className="text-center">{row.original.totalInvoices}</div>
        },
        {
            accessorKey: "totalSpent",
            header: () => <div className="text-right">Total Spent</div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("totalSpent") || "0");
                return <div className="text-right font-medium">{formatCurrency(amount)}</div>
            },
        },
        {
            accessorKey: "totalOutstanding",
            header: () => <div className="text-right">Outstanding</div>,
            cell: ({ row }) => {
                const amount = row.original.totalOutstanding || 0;
                return <div className={`text-right font-medium ${amount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {formatCurrency(amount)}
                </div>
            },
        },
        {
            accessorKey: "lastOrderDate",
            header: "Last Order",
            cell: ({ row }) => {
                const date = row.original.lastOrderDate;
                return date ? format(date, "MMM d, yyyy") : "-";
            }
        },
        {
          id: "actions",
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/customers/${row.original.id}`)}>
                    View Details
                </DropdownMenuItem>
                <Link href={`/payments/new?customerId=${row.original.id}`}>
                    <DropdownMenuItem>
                        Record Payment
                    </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={() => handleEditClick(row.original)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeleteClick(row.original.id)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        },
    ];

    const table = useReactTable({
        data: customers,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        state: {
            sorting,
            globalFilter: searchTerm,
        },
        onGlobalFilterChange: setSearchTerm,
    });


    // Reusable Form Dialog
    const CustomerDialog = ({ 
        open, 
        onOpenChange, 
        title, 
        description 
    }: { open: boolean, onOpenChange: (open: boolean) => void, title: string, description: string }) => (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) {
                setEditingCustomer(null);
                form.reset();
            }
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl><Input placeholder="john@example.com" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl><Input placeholder="+1 234 567 890" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Address</FormLabel>
                                    <FormControl><Textarea placeholder="123 Main St..." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="company"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Company (Optional)</FormLabel>
                                        <FormControl><Input placeholder="Acme Inc." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="taxId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tax ID (Optional)</FormLabel>
                                        <FormControl><Input placeholder="TAX-123" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit">{editingCustomer ? "Update" : "Create"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer base.</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

       <div className="flex items-center py-4">
        <div className="relative w-full max-w-sm">
           <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
           <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-8"
           />
        </div>
      </div>

      <div className="border rounded-md">
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
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                </TableRow>
            ) : table.getRowModel().rows?.length ? (
               table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
                <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No customers found.
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

      {/* Dialogs */}
      <CustomerDialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen} 
        title="Add Customer"
        description="Add a new customer to your database."
      />
       <CustomerDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        title="Edit Customer"
        description="Update existing customer details."
      />
    </div>
  );
}
