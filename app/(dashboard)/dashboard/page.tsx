"use client";

import { useStore } from "@/lib/store"; // Keep settings
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreVertical, Plus, RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { firestoreService } from "@/lib/firestore-service";
import { Product, Invoice } from "@/types";
import { toast } from "sonner";

export default function DashboardPage() {
  const { settings } = useStore();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // --- Fetch Data ---
  useEffect(() => {
    if (!user) return;
    
    async function loadData() {
        try {
            const [fetchedProducts, fetchedInvoices, fetchedCustomers, fetchedPayments] = await Promise.all([
                firestoreService.getProducts(user.uid),
                firestoreService.getInvoices(user.uid),
                firestoreService.getCustomers(user.uid),
                firestoreService.getPayments(user.uid)
            ]);
            setProducts(fetchedProducts);
            setInvoices(fetchedInvoices);
            setCustomerCount(fetchedCustomers.length);
            setPayments(fetchedPayments);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load dashboard data");
        } finally {
            setIsLoading(false);
        }
    }
    loadData();
  }, [user]);


  // --- Metrics Calculations ---
  // Total Revenue = Total Paid Amount across all invoices
  const totalRevenue = invoices.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
  
  // Total Outstanding = Total Balance Amount across all invoices
  const totalOutstanding = invoices.reduce((acc, curr) => acc + (curr.balanceAmount || 0), 0);

  // Total Collected = Sum of all payments entries (should imply cash flow)
  // This might be redundant with totalRevenue if strictly linked, but payments tracks cash flow date
  const totalCollected = payments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const totalSoldItems = invoices
    .flatMap(i => Array.isArray(i.items) ? i.items : Object.values(i.items || {}))
    .reduce((acc, item: any) => acc + (item?.quantity || 0), 0);
  
  const pendingAmount = invoices
      .filter(i => i.status === "pending")
      .reduce((acc, curr) => acc + (curr.total || 0), 0);
      
  const totalCustomers = 0; // We will fetch this below

  // --- Chart Data Preparation ---
  // Group invoices by date for the area chart
  const validInvoices = [...invoices];
  // Sort by date
  validInvoices.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // Aggregate by day to make chart cleaner if multiple invoices per day
  const incomeByDate = validInvoices.reduce((acc: any, inv) => {
      const date = new Date(inv.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      acc[date] = (acc[date] || 0) + inv.total;
      return acc;
  }, {});

  const chartData = Object.keys(incomeByDate).map(date => ({
      name: date,
      income: incomeByDate[date]
  }));

  // Add simplified mock trend if empty so it looks good initially
  if (chartData.length === 0) {
      chartData.push({ name: 'Jan 1', income: 4000 }, { name: 'Jan 2', income: 3000 }, { name: 'Jan 3', income: 5000 }, { name: 'Jan 4', income: 4500 });
  }

  // --- Helper for Currency ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { 
        style: "currency", 
        currency: settings?.currency || "USD" 
    }).format(amount);
  }

  // --- Components ---
  const StatCard = ({ title, value, color, percentage, label, isLoading }: any) => {
      const data = [
          { name: 'val', value: percentage },
          { name: 'rem', value: 100 - percentage }
      ];
      const COLORS = [color, '#f3f4f6'];

      return (
        <Card className="border-none shadow-sm pb-2">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
                <MoreVertical className="h-4 w-4 text-gray-400 cursor-pointer" />
            </CardHeader>
            <CardContent className="flex items-center justify-between pt-4">
                <div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                        {isLoading ? (
                             <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
                        ) : value}
                    </div>
                    <div className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", 
                        title === 'Total Income' ? "bg-blue-50 text-blue-700" : 
                        title === 'Sold Products' ? "bg-lime-50 text-lime-700" : "bg-amber-50 text-amber-700"
                    )}>
                        ↗ {percentage}% {label}
                    </div>
                </div>
                <div className="h-20 w-20 relative">
                        <PieChart width={80} height={80}>
                        <Pie
                            data={data}
                            innerRadius={25}
                            outerRadius={35}
                            startAngle={90}
                            endAngle={-270}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-bold fill-gray-900">
                             {percentage}%
                        </text>
                        </PieChart>
                </div>
            </CardContent>
        </Card>
      )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         {/* Top Section / Header removed as it is in Navbar now ideally, but keeping title context if needed. 
             Actually INVO puts 'Last 6 months' filter here. We'll skip complex filters for MVP. */}
      </div>

      {/* Stats Row */}
      <div className="grid gap-6 md:grid-cols-4">
        <StatCard 
            title="Total Income" 
            value={formatCurrency(totalRevenue)} 
            color="#2563EB" // Blue
            percentage={46} 
            label="Since last month"
            isLoading={isLoading}
        />
        <StatCard 
            title="Sold Products" 
            value={totalSoldItems} 
            color="#84CC16" // Lime
            percentage={58} 
            label="Growth"
            isLoading={isLoading}
        />
        <StatCard 
            title="Total Customers" 
            value={customerCount} 
            color="#a855f7" // Purple
            percentage={12} 
            label="Verified"
            isLoading={isLoading}
        />
        <StatCard 
            title="Total Revenue" 
            value={formatCurrency(totalRevenue + pendingAmount)} 
            color="#FBBF24" // Amber
            percentage={72} 
            label="Target reached"
            isLoading={isLoading}
        />
      </div>

      {/* Main Chart Section */}
      <div className="grid gap-6 md:grid-cols-3">
          {/* Chart takes up 2/3 */}
          <Card className="col-span-2 border-none shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="text-base font-semibold text-gray-900">Total Income</CardTitle>
                </div>
                <div className="flex space-x-2">
                     <Button variant="ghost" size="sm" className="text-blue-600 bg-blue-50 hover:bg-blue-100 h-8">1D</Button>
                     <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 h-8">1W</Button>
                     <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 h-8">1M</Button>
                </div>
             </CardHeader>
             <CardContent className="pl-0">
                <div className="h-[300px] w-full">
                    {isLoading ? (
                        <div className="h-full w-full flex items-center justify-center bg-gray-50/50">
                            <RefreshCw className="h-8 w-8 animate-spin text-gray-300" />
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#6B7280', fontSize: 12}} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#6B7280', fontSize: 12}} 
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#2563EB', fontWeight: 'bold' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="income" 
                                    stroke="#2563EB" 
                                    strokeWidth={2} 
                                    fillOpacity={1} 
                                    fill="url(#colorIncome)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
             </CardContent>
          </Card>

          {/* User List / Side Widget Placeholder matching INVO */}
          <Card className="col-span-1 border-none shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-base font-semibold text-gray-900">Users</CardTitle>
                 <Button size="icon" className="h-6 w-6 rounded bg-blue-600 hover:bg-blue-700 text-white">
                     <Plus className="h-4 w-4" />
                 </Button>
             </CardHeader>
             <CardContent>
                 <div className="space-y-4">
                     {[1,2,3,4,5].map((i) => (
                         <div key={i} className="flex items-center justify-between">
                             <div className="flex items-center space-x-3">
                                 <div className="h-8 w-8 rounded-full bg-gray-200" />
                                 <div>
                                     <p className="text-sm font-medium text-gray-900">User Name {i}</p>
                                     <p className="text-xs text-gray-500">Sales Rep</p>
                                 </div>
                             </div>
                             <span className="text-xs font-bold text-gray-500">Top</span>
                         </div>
                     ))}
                 </div>
             </CardContent>
          </Card>
      </div>

      {/* Last Orders Table */}
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-gray-900">Last Orders</CardTitle>
                <p className="text-sm text-gray-500">Latest transaction history</p>
            </div>
            <Link href="/invoices/new">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                    <Plus className="mr-2 h-4 w-4" /> Add new order
                </Button>
            </Link>
        </CardHeader>
        <CardContent>
             <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                     <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                         <tr>
                             <th className="px-4 py-3 font-medium">Date</th>
                             <th className="px-4 py-3 font-medium">Customer</th>
                             <th className="px-4 py-3 font-medium">Invoice #</th>
                             <th className="px-4 py-3 font-medium">Amount</th>
                             <th className="px-4 py-3 font-medium">Status</th>
                             <th className="px-4 py-3 font-medium text-right">Action</th>
                         </tr>
                     </thead>
                     <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-400">Loading recent orders...</td>
                            </tr>
                        ) : invoices.length === 0 ? (
                           <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-400">No recent orders found</td>
                            </tr>
                        ) : (
                          // Sort by date desc (newest first) then slice
                          invoices
                            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .slice(0, 5).map((invoice) => (
                              <tr key={invoice.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                      {new Date(invoice.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">
                                      {invoice.customerName}
                                  </td>
                                  <td className="px-4 py-3 text-gray-500">
                                      {invoice.invoiceNumber}
                                  </td>
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                      {formatCurrency(invoice.total)}
                                  </td>
                                   <td className="px-4 py-3">
                                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium capitalize",
                                          invoice.status === 'paid' ? "bg-green-100 text-green-700" :
                                          invoice.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                                          "bg-gray-100 text-gray-700"
                                      )}>
                                          {invoice.status}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900">
                                          <Settings className="h-4 w-4" /> 
                                      </Button>
                                  </td>
                              </tr>
                          ))
                        )}
                     </tbody>
                 </table>
             </div>
        </CardContent>
      </Card>
    </div>
  );
}


