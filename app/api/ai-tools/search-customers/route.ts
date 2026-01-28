import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { sanitizeQuery } from "@/lib/validation";
import { firestoreService } from "@/lib/firestore-service";
import { SearchCustomersRequest, CustomerResult } from "@/types/ai-tools";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { query, limit = 10 } = body as SearchCustomersRequest;

    if (!query) {
      return errorResponse("Query is required");
    }

    const sanitizedQuery = sanitizeQuery(query);
    const allCustomers = await firestoreService.getCustomers(user);

    // Fuzzy matching locally
    const results = allCustomers.filter(customer => {
        const nameMatch = customer.name.toLowerCase().includes(sanitizedQuery);
        const emailMatch = customer.email?.toLowerCase().includes(sanitizedQuery);
        const phoneMatch = customer.phone?.includes(sanitizedQuery) || customer.phone?.replace(/\D/g, '').includes(sanitizedQuery);
        return nameMatch || emailMatch || phoneMatch;
    }).slice(0, limit);

    const mappedResults: CustomerResult[] = results.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email || "",
        phone: c.phone,
        totalOutstanding: c.totalOutstanding || 0
    }));

    return successResponse(mappedResults);

  } catch (error: any) {
    console.error("Error in search-customers:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
