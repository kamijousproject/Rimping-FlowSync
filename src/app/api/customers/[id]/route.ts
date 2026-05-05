import { NextResponse } from "next/server";
import { requireUser, requireRole, badRequest, serverError } from "../../_helpers";
import { getCustomer, updateCustomerWithLog, getEffectiveCreditLimit, deleteCustomer } from "@/backend/services/customers";
import { listPos } from "@/backend/services/po";
import { listAllPaymentsForCustomer } from "@/backend/services/payments";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const customer = await getCustomer(Number(id));
    if (!customer)
      return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
    const [pos, payments, effective] = await Promise.all([
      listPos({ customer_id: Number(id) }),
      listAllPaymentsForCustomer(Number(id)),
      getEffectiveCreditLimit(Number(id)),
    ]);
    return NextResponse.json({ customer, pos, payments, effective });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("body ไม่ถูกต้อง");
  try {
    await updateCustomerWithLog(Number(id), body, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    await deleteCustomer(Number(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
