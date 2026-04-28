import { NextResponse } from "next/server";
import { requireUser, serverError } from "../../_helpers";
import { getPo } from "@/backend/services/po";
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
