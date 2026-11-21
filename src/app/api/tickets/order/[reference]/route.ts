import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createQrCredential } from "@/lib/tickets/qr";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const token = request.headers.get("x-checkout-token");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: "Invalid ticket access." }, { status: 401 });
  try {
    const hash = createHash("sha256").update(token).digest("hex");
    const db = createSupabaseAdminClient();
    const { data, error } = await db.rpc("get_order_tickets", { p_order_reference: reference, p_checkout_token_hash: hash });
    if (error) {
      if (error.message.includes("ORDER_NOT_FOUND")) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      throw error;
    }
    if (data.status !== "paid") return NextResponse.json({ success: true, status: data.status, tickets: [], message: "Your transfer is awaiting administrator verification. Tickets are issued only after payment is confirmed." }, { headers: { "Cache-Control": "private, no-store" } });
    const tickets = (data.tickets ?? []).map((ticket: { ticketCode: string; qrNonce: string; status: string; issuedAt: string; attendeeName: string; ticketType: string }) => ({
      ticketCode: ticket.ticketCode,
      attendeeName: ticket.attendeeName,
      ticketType: ticket.ticketType,
      status: ticket.status,
      issuedAt: ticket.issuedAt,
      qrCredential: createQrCredential(ticket.ticketCode, ticket.qrNonce),
    }));
    return NextResponse.json({ success: true, status: "paid", orderReference: reference, tickets }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve tickets." }, { status: 500 });
  }
}
