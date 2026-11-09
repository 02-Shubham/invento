import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/api-helpers";
import { getPendingAction, toActionView } from "@/lib/pending-actions";

/** GET /api/ai/actions/{id} — current state of an AI-proposed action (owner only). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUser(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const action = await getPendingAction(id, userId);
  if (!action) return NextResponse.json({ success: false, error: "Action not found" }, { status: 404 });

  return NextResponse.json({ success: true, action: toActionView(action) });
}
