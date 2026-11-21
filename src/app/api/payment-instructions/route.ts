import { NextResponse } from "next/server";
import { getBankTransferInstructions } from "@/features/events/config/payment";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ success: true, bank: getBankTransferInstructions() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: { message: "Bank transfer instructions are not configured yet." } }, { status: 503 }); }
}
