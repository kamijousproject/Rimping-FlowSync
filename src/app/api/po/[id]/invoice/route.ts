import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { generateInvoice } from "@/backend/services/payments";
import { getPo } from "@/backend/services/po";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const data = await getPo(Number(id));
    if (!data) return badRequest("ไม่พบ PO");
    const amount = Number(body.amount || data.po.remaining_amount);
    if (amount <= 0) return badRequest("ยอด invoice ต้องมากกว่า 0");
    const invoice = await generateInvoice({
      po_id: Number(id),
      amount,
      generated_by: auth.user.id,
    });
    return NextResponse.json({ invoice });
  } catch (e) {
    return serverError(e);
  }
}
