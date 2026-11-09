import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi-spec";

/** GET /api/openapi — the OpenAPI 3.0 document as JSON (usable with Postman, codegen, etc.). */
export async function GET() {
  return NextResponse.json(openApiSpec);
}
