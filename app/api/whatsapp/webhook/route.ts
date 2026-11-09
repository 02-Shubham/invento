import { NextRequest, NextResponse, after } from "next/server";
import { verifySignature, whatsappConfigured } from "@/lib/whatsapp";
import { processInbound, type InboundMessage } from "@/lib/whatsapp-agent";

/** GET — Meta's one-time webhook verification handshake. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("hub.mode") === "subscribe" && process.env.WHATSAPP_VERIFY_TOKEN && q.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** POST — inbound messages. Signature-verified; acknowledged immediately, processed after the response. */
export async function POST(req: NextRequest) {
  if (!whatsappConfigured()) return NextResponse.json({ error: "WhatsApp not configured" }, { status: 503 });

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inbound: (InboundMessage & { id: string })[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const m of change?.value?.messages ?? []) {
        if (!m?.id || !m?.from) continue;
        inbound.push({
          id: m.id,
          from: String(m.from),
          text: m.type === "text" ? m.text?.body : undefined,
          buttonId: m.type === "interactive" ? m.interactive?.button_reply?.id : undefined,
        });
      }
    }
  }

  after(() => processInbound(inbound));

  return NextResponse.json({ received: inbound.length });
}
