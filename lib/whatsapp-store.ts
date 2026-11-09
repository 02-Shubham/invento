/**
 * WhatsApp ↔ user linking and chat state. Admin-SDK only (default-deny rules cover these collections).
 *
 *  whatsapp_link_codes/{code}   one-time code a signed-in user generates (10 min)
 *  whatsapp_links/{phone}       verified phone → userId (proved by messaging the code FROM that phone)
 *  whatsapp_events/{messageId}  dedupe: Meta retries deliveries
 *  whatsapp_sessions/{phone}    short rolling chat history for the agent
 */
import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_HISTORY = 12;

export async function createLinkCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
  const db = adminDb();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  for (let i = 0; i < 5; i++) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      await db.collection("whatsapp_link_codes").doc(code).create({ userId, expiresAt: Timestamp.fromDate(expiresAt) });
      return { code, expiresAt };
    } catch (e: any) {
      if (e?.code !== 6 /* ALREADY_EXISTS */) throw e;
    }
  }
  throw new Error("Could not generate a code, try again");
}

/** Consume a code (single use) and link `phone` to its owner. Returns the userId or null. */
export async function consumeLinkCode(code: string, phone: string): Promise<string | null> {
  const db = adminDb();
  const ref = db.collection("whatsapp_link_codes").doc(code);
  const userId = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    const d = snap.data()!;
    if (d.expiresAt.toDate().getTime() < Date.now()) return null;
    return d.userId as string;
  });
  if (!userId) return null;

  // One phone per user: drop their previous link(s), then link this phone
  const old = await db.collection("whatsapp_links").where("userId", "==", userId).get();
  const batch = db.batch();
  old.docs.forEach((d) => d.id !== phone && batch.delete(d.ref));
  batch.set(db.collection("whatsapp_links").doc(phone), { userId, linkedAt: Timestamp.now() });
  await batch.commit();
  return userId;
}

export async function getLinkedUser(phone: string): Promise<string | null> {
  const snap = await adminDb().collection("whatsapp_links").doc(phone).get();
  return snap.exists ? (snap.data()!.userId as string) : null;
}

export async function getLinkForUser(userId: string): Promise<{ phone: string; linkedAt: Date } | null> {
  const q = await adminDb().collection("whatsapp_links").where("userId", "==", userId).limit(1).get();
  if (q.empty) return null;
  return { phone: q.docs[0].id, linkedAt: q.docs[0].data().linkedAt.toDate() };
}

export async function unlinkUser(userId: string): Promise<void> {
  const db = adminDb();
  const q = await db.collection("whatsapp_links").where("userId", "==", userId).get();
  const batch = db.batch();
  q.docs.forEach((d) => {
    batch.delete(d.ref);
    batch.delete(db.collection("whatsapp_sessions").doc(d.id));
  });
  await batch.commit();
}

/** True the first time a message id is seen; false for Meta's retries. */
export async function markMessageSeen(messageId: string): Promise<boolean> {
  try {
    await adminDb().collection("whatsapp_events").doc(messageId).create({ at: Timestamp.now() });
    return true;
  } catch (e: any) {
    if (e?.code === 6) return false;
    throw e;
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function getHistory(phone: string): Promise<ChatTurn[]> {
  const snap = await adminDb().collection("whatsapp_sessions").doc(phone).get();
  return snap.exists ? ((snap.data()!.messages as ChatTurn[]) || []) : [];
}

export async function saveHistory(phone: string, messages: ChatTurn[]): Promise<void> {
  await adminDb().collection("whatsapp_sessions").doc(phone).set({
    messages: messages.slice(-MAX_HISTORY),
    updatedAt: Timestamp.now(),
  });
}
