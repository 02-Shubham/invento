/**
 * Pending actions — the approval queue for AI-proposed write operations.
 *
 * The rule this module enforces: THE SERVER DECIDES WHAT GETS APPROVED.
 * When the assistant wants to change data, the validated input is stored here
 * as a `pending` record. The browser only ever receives a view of it and can
 * only answer "approve" or "reject" by id — it never supplies the data that is
 * executed. Approval executes exactly the stored `input`.
 *
 * Storage: Firestore collection `pending_actions`, accessed ONLY through the
 * Admin SDK. The default-deny rule in firestore.rules blocks browser access.
 * The records double as the audit log of everything the agent proposed/did.
 *
 * Lifecycle:  pending ──claim──▶ executing ──▶ done | failed
 *                │
 *                ├──▶ rejected
 *                └──▶ expired   (derived lazily when read after expiresAt)
 */
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export type ActionTool = "create_invoice" | "adjust_stock" | "add_product";
export type ActionStatus = "pending" | "executing" | "done" | "failed" | "rejected" | "expired";

/** What the approval card shows. Built by the server from validated data. */
export interface ActionPreview {
  title: string;
  subtitle?: string;
  /** Line items (e.g. invoice lines). */
  lines?: { label: string; quantity: number; unitPrice: number; amount: number }[];
  /** Plain label/value rows (e.g. stock before/after). */
  details?: { label: string; value: string }[];
  /** Money totals, shown at the bottom. */
  totals?: { label: string; amount: number; bold?: boolean }[];
  /** Non-blocking things the owner should know (e.g. "a product with this name exists"). */
  warnings?: string[];
}

export interface PendingAction {
  id: string;
  userId: string;
  tool: ActionTool;
  input: Record<string, any>;
  preview: ActionPreview;
  status: ActionStatus;
  createdAt: Date;
  expiresAt: Date;
  decidedAt?: Date;
  result?: any;
  error?: string;
}

/** The subset sent to the browser. */
export interface ActionView {
  id: string;
  tool: ActionTool;
  preview: ActionPreview;
  status: ActionStatus;
  expiresAt: string;
  result?: any;
  error?: string;
}

/** How long an owner has to approve a proposal. */
export const ACTION_TTL_MS = 24 * 60 * 60 * 1000;

const COLLECTION = "pending_actions";
const col = () => adminDb().collection(COLLECTION);

const toDate = (v: any): Date => (v instanceof Timestamp ? v.toDate() : new Date(v));

function fromSnap(snap: FirebaseFirestore.DocumentSnapshot): PendingAction {
  const d = snap.data()!;
  return {
    id: snap.id,
    userId: d.userId,
    tool: d.tool,
    input: d.input,
    preview: d.preview,
    status: d.status,
    createdAt: toDate(d.createdAt),
    expiresAt: toDate(d.expiresAt),
    decidedAt: d.decidedAt ? toDate(d.decidedAt) : undefined,
    result: d.result,
    error: d.error,
  };
}

export function toActionView(a: PendingAction): ActionView {
  return {
    id: a.id,
    tool: a.tool,
    preview: a.preview,
    status: a.status,
    expiresAt: a.expiresAt.toISOString(),
    result: a.result,
    error: a.error,
  };
}

/** Store a validated proposal. Nothing has been written to business data yet. */
export async function createPendingAction(params: {
  userId: string;
  tool: ActionTool;
  input: Record<string, any>;
  preview: ActionPreview;
}): Promise<PendingAction> {
  const now = Date.now();
  const ref = col().doc();
  await ref.set({
    userId: params.userId,
    tool: params.tool,
    input: params.input,
    preview: params.preview,
    status: "pending",
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + ACTION_TTL_MS),
  });
  return fromSnap(await ref.get());
}

/**
 * Fetch an action the user owns. Returns null if it doesn't exist OR belongs to
 * someone else (indistinguishable on purpose). A pending action past its expiry
 * is reported — and persisted — as `expired`.
 */
export async function getPendingAction(id: string, userId: string): Promise<PendingAction | null> {
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.userId !== userId) return null;
  const action = fromSnap(snap);
  if (action.status === "pending" && action.expiresAt.getTime() < Date.now()) {
    await ref.update({ status: "expired", decidedAt: Timestamp.now() });
    return { ...action, status: "expired" };
  }
  return action;
}

export type ClaimResult =
  | { ok: true; action: PendingAction }
  | { ok: false; code: 404 | 409 | 410; error: string; action?: PendingAction };

/**
 * Atomically move pending → executing. This is the single gate that guarantees
 * an action executes at most once: of any number of concurrent approve calls
 * (double-click, second tab, retry), exactly one wins the transaction.
 */
export async function claimForExecution(id: string, userId: string): Promise<ClaimResult> {
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx): Promise<ClaimResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()!.userId !== userId) {
      return { ok: false, code: 404, error: "Action not found" };
    }
    const action = fromSnap(snap);

    if (action.status === "pending" && action.expiresAt.getTime() < Date.now()) {
      tx.update(ref, { status: "expired", decidedAt: Timestamp.now() });
      return { ok: false, code: 410, error: "This proposal has expired. Ask the assistant to prepare it again.", action: { ...action, status: "expired" } };
    }
    if (action.status !== "pending") {
      return { ok: false, code: 409, error: `This action was already handled (${action.status}).`, action };
    }

    tx.update(ref, { status: "executing", decidedAt: Timestamp.now() });
    return { ok: true, action: { ...action, status: "executing" } };
  });
}

/** Record the outcome of an executed action. */
export async function finishAction(
  id: string,
  outcome: { success: true; result: any } | { success: false; error: string }
): Promise<void> {
  await col().doc(id).update(
    outcome.success
      ? { status: "done", result: outcome.result, finishedAt: Timestamp.now() }
      : { status: "failed", error: outcome.error, finishedAt: Timestamp.now() }
  );
}

/** Reject a pending action. Writes nothing to business data. */
export async function rejectAction(id: string, userId: string): Promise<ClaimResult> {
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx): Promise<ClaimResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()!.userId !== userId) {
      return { ok: false, code: 404, error: "Action not found" };
    }
    const action = fromSnap(snap);
    if (action.status !== "pending") {
      return { ok: false, code: 409, error: `This action was already handled (${action.status}).`, action };
    }
    tx.update(ref, { status: "rejected", decidedAt: Timestamp.now() });
    return { ok: true, action: { ...action, status: "rejected" } };
  });
}
