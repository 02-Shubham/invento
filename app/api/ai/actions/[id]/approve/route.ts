import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/api-helpers";
import { approveAction } from "@/lib/action-runner";

/**
 * POST /api/ai/actions/{id}/approve
 *
 * Executes an AI-proposed action. The request carries NO data: the server runs
 * exactly the input it stored when the action was proposed, so what the owner
 * saw on the card is what gets committed. Exactly-once is guaranteed by the
 * atomic claim inside `approveAction`.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUser(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const r = await approveAction(id, userId);
  const { code, ...body } = r;
  // Claim errors keep their 404/409/410; a business failure is 200 with success:false
  return NextResponse.json(body, { status: code });
}
