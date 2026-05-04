import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { setPoStatus, getPo } from "@/backend/services/po";

const ALLOWED = [
  "draft",
  "confirmed",
  "packed",
  "checked",
  "delivered",
  "received",
  "cancelled",
];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.status || !ALLOWED.includes(body.status))
    return badRequest("status ไม่ถูกต้อง");
  if (body.status === "delivered" && !body.tax_invoice_number?.trim())
    return badRequest("กรุณากรอกเลขที่ใบกำกับภาษีเต็มรูปแบบก่อนจัดส่ง");
  try {
    await setPoStatus(Number(id), body.status, {
      tax_invoice_number: body.tax_invoice_number?.trim() || undefined,
      edited_by: auth.user.id,
    });
    const updated = await getPo(Number(id));
    if (!updated) return badRequest("ไม่พบ PO");
    return NextResponse.json(updated.po);
  } catch (e) {
    return serverError(e);
  }
}
