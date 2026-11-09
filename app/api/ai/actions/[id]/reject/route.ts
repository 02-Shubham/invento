import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/api-helpers";
import { rejectAction, toActionView } from "@/lib/pending-actions";

/** POST /api/ai/actions/{id}/reject — discard a proposal. Nothing is written to business data. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUser(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await rejectAction(id, userId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, action: result.action ? toActionView(result.action) : undefined },
      { status: result.code }
    );
  }
  return NextResponse.json({ success: true, action: toActionView(result.action) });
}
