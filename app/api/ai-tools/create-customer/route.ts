import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, successResponse, errorResponse } from "@/lib/api-helpers";
import { validatePhone, validateEmail } from "@/lib/validation";
import { firestoreService } from "@/lib/firestore-service";
import { CreateCustomerRequest, CreateCustomerResult, CustomerResult } from "@/types/ai-tools";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { name, email, phone, address } = body as CreateCustomerRequest;

    // Validation
    if (!name || !phone) {
        return errorResponse("Name and Phone are required");
    }
    
    if (email && !validateEmail(email)) {
        return errorResponse("Invalid email format");
    }

    /*
    // Phone validation (relaxed for now)
    if (!validatePhone(phone)) {
        return errorResponse("Invalid phone format");
    }
    */

    // Check existing
    const allCustomers = await firestoreService.getCustomers(user);
    const existing = allCustomers.find(c => 
        (c.phone === phone) || (email && c.email?.toLowerCase() === email.toLowerCase())
    );

    if (existing) {
        return successResponse<CreateCustomerResult>({
            id: existing.id,
            name: existing.name,
            phone: existing.phone,
            message: "Customer already exists"
        });
    }

    // Create new
    const newCustomerData = {
        name,
        email: email || "",
        phone,
        address: address || "",
        totalOutstanding: 0,
        totalInvoices: 0,
        totalSpent: 0
    };

    const newId = await firestoreService.addCustomer(newCustomerData, user);

    return successResponse<CreateCustomerResult>({
        id: newId,
        name,
        phone,
        message: "Customer created successfully"
    });

  } catch (error: any) {
    console.error("Error in create-customer:", error);
    return errorResponse("Internal server error", 500, error.message);
  }
}
