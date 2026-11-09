import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/api-helpers";
import { whatsappConfigured } from "@/lib/whatsapp";
import { createLinkCode, getLinkForUser, unlinkUser } from "@/lib/whatsapp-store";

const mask = (p: string) => `+${p.slice(0, 2)}••••••${p.slice(-3)}`;

/** GET — is WhatsApp configured, and is this account linked? */
export async function GET(req: NextRequest) {
  const userId = await getCurrentUser(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const link = await getLinkForUser(userId);
  return NextResponse.json({
    success: true,
    configured: whatsappConfigured(),
    linked: !!link,
    phone: link ? mask(link.phone) : null,
    businessNumber: process.env.WHATSAPP_DISPLAY_NUMBER || null,
  });
}

/** POST — create a one-time link code (valid 10 min) to send from the phone being linked. */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUser(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!whatsappConfigured()) return NextResponse.json({ success: false, error: "WhatsApp is not configured on this server" }, { status: 503 });
  const { code, expiresAt } = await createLinkCode(userId);
  return NextResponse.json({ success: true, code, expiresAt: expiresAt.toISOString(), businessNumber: process.env.WHATSAPP_DISPLAY_NUMBER || null });
}

/** DELETE — unlink the phone. */
export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUser(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  await unlinkUser(userId);
  return NextResponse.json({ success: true });
}
