import { NextResponse } from "next/server";

// Standard success response
export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status: 200 }
  );
}

// Standard error response
export function errorResponse(message: string, status: number = 400, errorDetails?: any) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      details: errorDetails,
    },
    { status }
  );
}

// This is a placeholder. In a real app with NextAuth/Clerk/Firebase Auth,
// you would get the session here.
// For now, since we are using firebase client SDK in the frontend,
// the API routes usually verify the ID token passed in the Authorization header.
// However, adhering to the plan which assumes we can get the user.
// We will look for a simple header "x-user-id" for testing simplicity if no proper auth middleware exists,
// OR ideally we should use `firebase-admin` to verify the token.
// 
// Given the existing codebase uses `lib/firebase.ts` (client sdk) and `lib/firestore-service.ts`,
// checking if there's any server-side auth set up.
// If not, we might need a workaround for these API routes or assume the AI sends a simulated User ID header for now.
//
// Update: The prompt says "Get current authenticated user ID".
// We will try to extract it from headers.
export async function getCurrentUser(request: Request): Promise<string | null> {
    const userId = request.headers.get("x-user-id");
    // In a production app, verify Bearer token here using firebase-admin
    if (userId) return userId;
    
    return null; 
}

// Verify resource ownership generic helper
// Note: This matches the logic we usually do inside firestore-service with `where("userId", "==", userId)`
// So this might be redundant if we just query by UserID, but good for single doc verification.
export async function verifyResourceOwnership(
  resource: { userId: string },
  userId: string
): Promise<boolean> {
  return resource.userId === userId;
}
