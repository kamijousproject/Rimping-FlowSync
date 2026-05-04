import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_helpers";
import { getCreditNote, updateCreditNote, voidCreditNote } from "@/backend/services/credit-notes";

type Ctx = { params: Promise<{ id: string; cnId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { cnId } = await params;
  const cn = await getCreditNote(Number(cnId));
  if (!cn) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ credit_note: cn });
}

export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { cnId } = await params;
  const body = await req.json();
  try {
    const cn = await updateCreditNote(Number(cnId), {
      reason: body.reason,
      items: body.items,
      updated_by: auth.user.id,
    });
    return NextResponse.json({ credit_note: cn });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { cnId } = await params;
  try {
    await voidCreditNote(Number(cnId), auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
