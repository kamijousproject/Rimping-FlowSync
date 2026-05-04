import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { setTaxInvoiceNumber } from "@/backend/services/po";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.tax_invoice_number?.trim())
    return badRequest("กรุณากรอกเลขที่ใบกำกับภาษี");
  try {
    await setTaxInvoiceNumber(
      Number(id),
      body.tax_invoice_number.trim(),
      auth.user.id
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
