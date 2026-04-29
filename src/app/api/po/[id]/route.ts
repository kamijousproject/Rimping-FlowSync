import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "../../_helpers";
import { getPo, updatePo } from "@/backend/services/po";
import { listPayments } from "@/backend/services/payments";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const data = await getPo(Number(id));
    if (!data) return NextResponse.json({ error: "ไม่พบ PO" }, { status: 404 });
    const payments = await listPayments(Number(id));
    return NextResponse.json({ ...data, payments });
  } catch (e) {
    return serverError(e);
  }
}

const UpdateSchema = z.object({
  credit_term_days: z.coerce.number().int().min(0).max(365),
  notes: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        product_name: z.string().min(1),
        description: z.string().optional(),
        quantity: z.coerce.number().positive(),
        unit: z.string().optional(),
        unit_price: z.coerce.number().min(0),
      })
    )
    .min(1),
});

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success)
    return badRequest("ข้อมูลไม่ถูกต้อง", parsed.error.issues);
  try {
    await updatePo({
      id: Number(id),
      credit_term_days: parsed.data.credit_term_days,
      notes: parsed.data.notes ?? null,
      items: parsed.data.items,
      edited_by: auth.user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
