/**
 * Shared approve step for AI-proposed actions. Used by the web approve route and
 * the WhatsApp button handler so both channels execute exactly the same way:
 * atomic claim (exactly-once) → run the stored input → record the outcome.
 */
import { claimForExecution, finishAction, toActionView, type ActionView } from "@/lib/pending-actions";
import { commitWriteTool } from "@/lib/tool-executor";

export interface ApproveOutcome {
  /** HTTP-style code: 200 when the commit ran (even if the business rule failed), else claim error code. */
  code: number;
  success: boolean;
  error?: string;
  action?: ActionView;
}

export async function approveAction(id: string, userId: string): Promise<ApproveOutcome> {
  const claim = await claimForExecution(id, userId);
  if (!claim.ok) {
    return { code: claim.code, success: false, error: claim.error, action: claim.action ? toActionView(claim.action) : undefined };
  }
  const { action } = claim;
  console.log(`[Actions] approve | user:${userId} | action:${id} | tool:${action.tool}`);

  const outcome = await commitWriteTool(action.tool, action.input, userId);
  if (outcome.success) {
    await finishAction(id, { success: true, result: outcome.data });
    return { code: 200, success: true, action: toActionView({ ...action, status: "done", result: outcome.data }) };
  }
  const error = outcome.error || "Action failed";
  await finishAction(id, { success: false, error });
  console.warn(`[Actions] failed | action:${id} | ${error}`);
  return { code: 200, success: false, error, action: toActionView({ ...action, status: "failed", error }) };
}
