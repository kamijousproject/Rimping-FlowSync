import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { listPayments, recordPayment } from "@/backend/services/payments";
import { saveUpload } from "@/backend/upload";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const payments = await listPayments(Number(id));
    return NextResponse.json({ payments });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const ct = req.headers.get("content-type") || "";
    let amount = 0;
    let paid_at = new Date();
    let method = "transfer";
    let reference: string | undefined;
    let notes: string | undefined;
    let slip_path: string | undefined;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      amount = Number(form.get("amount") || 0);
      const pa = form.get("paid_at");
      paid_at = pa ? new Date(String(pa)) : new Date();
      method = String(form.get("method") || "transfer");
      reference = (form.get("reference") as string) || undefined;
      notes = (form.get("notes") as string) || undefined;
      const file = form.get("slip");
      if (file instanceof File && file.size > 0) {
        slip_path = await saveUpload("slips", file);
      }
    } else {
      const body = await req.json().catch(() => null);
      if (!body) return badRequest("body ไม่ถูกต้อง");
      amount = Number(body.amount || 0);
      paid_at = body.paid_at ? new Date(body.paid_at) : new Date();
      method = body.method || "transfer";
      reference = body.reference;
      notes = body.notes;
    }
    if (!amount || amount <= 0) return badRequest("amount ต้องมากกว่า 0");

    const result = await recordPayment({
      po_id: Number(id),
      amount,
      paid_at,
      method,
      reference,
      notes,
      slip_path,
      recorded_by: auth.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
