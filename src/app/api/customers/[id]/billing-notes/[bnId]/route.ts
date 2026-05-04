import { NextRequest, NextResponse } from "next/server";
import { getBillingNote } from "@/backend/services/billing-notes";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; bnId: string }> }
) {
  const { bnId } = await params;
  const bn = await getBillingNote(Number(bnId));
  if (!bn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ billing_note: bn });
}
