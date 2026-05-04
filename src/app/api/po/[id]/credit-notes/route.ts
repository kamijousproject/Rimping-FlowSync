import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_helpers";
import { createCreditNote, listCreditNotes } from "@/backend/services/credit-notes";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const notes = await listCreditNotes(Number(id));
  return NextResponse.json({ credit_notes: notes });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const body = await req.json();
  try {
    const cn = await createCreditNote({
      po_id: Number(id),
      customer_id: body.customer_id,
      created_by: auth.user.id,
      reason: body.reason,
      items: body.items,
    });
    return NextResponse.json({ credit_note: cn }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
