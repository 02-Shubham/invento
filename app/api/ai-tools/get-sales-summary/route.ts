import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { firestoreService } from "@/lib/firestore-service";
import { GetSalesSummaryRequest, SalesSummaryResult } from "@/types/ai-tools";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { startDate, endDate } = body as GetSalesSummaryRequest;

    let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    let end = endDate ? new Date(endDate) : new Date();

    const allInvoices = await firestoreService.getInvoices(user);
    const periodInvoices = allInvoices.filter(inv => {
        const d = new Date(inv.createdAt);
        return d >= start && d <= end;
    });

    const totalRevenue = periodInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalCollected = periodInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalOutstanding = totalRevenue - totalCollected;
    const totalInvoices = periodInvoices.length;
    const averageOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    // Top Products
    // We need to aggregate items from all invoices. 
    // This is expensive locally but okay for small data.
    const productStats: Record<string, { name: string, quantitySold: number, revenue: number }> = {};
    
    periodInvoices.forEach(inv => {
        // Handle legacy items object or array
        const items = Array.isArray(inv.items) ? inv.items : Object.values(inv.items || {});
        items.forEach((item: any) => { // using any for item temporarily to avoid strict type checks on legacy loose props
            if (!productStats[item.productId]) {
                productStats[item.productId] = { name: item.name, quantitySold: 0, revenue: 0 };
            }
            productStats[item.productId].quantitySold += (item.quantity || 0);
            
            // Calculate total if missing (legacy data integrity) or use item.total
            // item.total should exist in modern invoices, but good to fallback
            const itemTotal = item.total || (item.price * item.quantity) || 0;
            productStats[item.productId].revenue += itemTotal; 
        });
    });

    const topProducts = Object.values(productStats)
        .sort((a,b) => b.revenue - a.revenue)
        .slice(0, 5); // Top 5

    const result: SalesSummaryResult = {
        period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        totalRevenue,
        totalInvoices,
        averageOrderValue,
        topProducts,
        paymentStatus: {
            collected: totalCollected,
            outstanding: totalOutstanding
        }
    };

    return successResponse(result);

  } catch (error: any) {
    console.error("Error in get-sales-summary:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
