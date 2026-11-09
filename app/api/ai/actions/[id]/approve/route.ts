import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/api-helpers";
import { claimForExecution, finishAction, toActionView } from "@/lib/pending-actions";
import { commitWriteTool } from "@/lib/tool-executor";

/**
 * POST /api/ai/actions/{id}/approve
 *
 * Executes an AI-proposed action. The request carries NO data: the server runs
 * exactly the input it stored when the action was proposed, so what the owner
 * saw on the card is what gets committed.
 *
 * `claimForExecution` is an atomic pending → executing transition, so double
 * clicks, second tabs and retries can never execute the action twice.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUser(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const claim = await claimForExecution(id, userId);
  if (!claim.ok) {
    return NextResponse.json(
      { success: false, error: claim.error, action: claim.action ? toActionView(claim.action) : undefined },
      { status: claim.code }
    );
  }

  const { action } = claim;
  console.log(`[Actions] approve | user:${userId} | action:${id} | tool:${action.tool}`);

  const outcome = await commitWriteTool(action.tool, action.input, userId);

  if (outcome.success) {
    await finishAction(id, { success: true, result: outcome.data });
    return NextResponse.json({
      success: true,
      action: toActionView({ ...action, status: "done", result: outcome.data }),
    });
  }

  const error = outcome.error || "Action failed";
  await finishAction(id, { success: false, error });
  console.warn(`[Actions] failed | action:${id} | ${error}`);
  // Business failure (e.g. stock dropped since the proposal): 200 with success:false, like the tool endpoints
  return NextResponse.json({
    success: false,
    error,
    action: toActionView({ ...action, status: "failed", error }),
  });
}
