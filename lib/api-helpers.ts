import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

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

/**
 * Returns the verified Firebase UID for the request, or null.
 *
 * The client must send `Authorization: Bearer <Firebase ID token>`.
 * The token's signature, expiry and audience are verified by the Admin SDK;
 * nothing the client sends other than a valid token is trusted.
 */
export async function getCurrentUser(request: Request): Promise<string | null> {
    const header = request.headers.get("authorization");
    const match = header?.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;

    try {
        const decoded = await adminAuth().verifyIdToken(match[1]);
        return decoded.uid;
    } catch (error) {
        console.warn("[Auth] ID token verification failed:", (error as Error).message);
        return null;
    }
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
