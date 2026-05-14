import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../../_helpers";
import { updatePayment, deletePayment, getPaymentById } from "@/backend/services/payments";
import { saveUpload } from "@/backend/upload";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { paymentId } = await ctx.params;
  try {
    const payment = await getPaymentById(Number(paymentId));
    if (!payment) {
      return NextResponse.json({ error: "ไม่พบรายการชำระเงิน" }, { status: 404 });
    }
    return NextResponse.json({ payment });
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { paymentId } = await ctx.params;
  try {
    const ct = req.headers.get("content-type") || "";
    let amount: number | undefined;
    let paid_at: Date | undefined;
    let method: string | undefined;
    let reference: string | null | undefined;
    let notes: string | null | undefined;
    let slip_path: string | null | undefined;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const amt = form.get("amount");
      if (amt !== null) amount = Number(amt);
      const pa = form.get("paid_at");
      if (pa) paid_at = new Date(String(pa));
      const mth = form.get("method");
      if (mth !== null) method = String(mth);
      const ref = form.get("reference");
      if (ref !== null) reference = String(ref) || null;
      const nt = form.get("notes");
      if (nt !== null) notes = String(nt) || null;
      
      const file = form.get("slip");
      if (file instanceof File && file.size > 0) {
        slip_path = await saveUpload("slips", file);
      }
    } else {
      const body = await req.json().catch(() => null);
      if (!body) return badRequest("body ไม่ถูกต้อง");
      amount = body.amount;
      paid_at = body.paid_at ? new Date(body.paid_at) : undefined;
      method = body.method;
      reference = body.reference;
      notes = body.notes;
      slip_path = body.slip_path;
    }

    const updated = await updatePayment(Number(paymentId), {
      amount,
      paid_at,
      method,
      reference,
      notes,
      slip_path,
      edited_by: auth.user.id,
    });

    if (!updated) {
      return NextResponse.json({ error: "ไม่พบรายการชำระเงิน" }, { status: 404 });
    }

    return NextResponse.json({ payment: updated });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { paymentId } = await ctx.params;
  try {
    await deletePayment(Number(paymentId), auth.user.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
