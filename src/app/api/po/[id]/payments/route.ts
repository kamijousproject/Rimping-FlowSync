import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { listPayments, recordPayment } from "@/backend/services/payments";
import { saveUpload } from "@/backend/upload";
import { query, exec } from "@/backend/db";
import type { PurchaseOrder } from "@/backend/services/po";

export const runtime = "nodejs";

const RPA_BOT_URL = process.env.RPA_BOT_URL ?? "http://localhost:8001";

async function triggerPaymentRpa(paymentId: number, poId: number, amount: number, paidAt: Date) {
  try {
    const poRows = await query<PurchaseOrder>(
      "SELECT po_number, customer_id, jda_po_number FROM purchase_orders WHERE id = ?",
      [poId]
    );
    const po = poRows[0];
    if (!po) return;

    const res = await fetch(`${RPA_BOT_URL}/rpa/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        function_id: 2,
        data: {
          po_id: po.po_number,
          customer_id: String(po.customer_id),
          amount: String(amount),
          date: paidAt.toISOString().slice(0, 10),
          po_jda: po.jda_po_number ?? "",
        },
      }),
    });

    if (res.ok) {
      const { job_id } = await res.json();
      await exec("UPDATE payments SET jda_job_id = ? WHERE id = ?", [job_id, paymentId]);
    }
  } catch {
    // Fire-and-forget — failure is non-blocking; user can retry from the UI
  }
}

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

    let overpay_handling: "keep_as_credit" | "refund_to_customer" | undefined;
    let customer_id: number | undefined;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      amount = Number(form.get("amount") || 0);
      const pa = form.get("paid_at");
      paid_at = pa ? new Date(String(pa)) : new Date();
      method = String(form.get("method") || "transfer");
      reference = (form.get("reference") as string) || undefined;
      notes = (form.get("notes") as string) || undefined;
      const oph = form.get("overpay_handling");
      if (oph === "keep_as_credit" || oph === "refund_to_customer") {
        overpay_handling = oph;
      }
      customer_id = Number(form.get("customer_id") || 0) || undefined;
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
      overpay_handling = body.overpay_handling;
      customer_id = body.customer_id;
    }
    if (!amount || amount <= 0) return badRequest("amount ต้องมากกว่า 0");

    // Block payment if JDA PO number has not been confirmed yet
    const poCheck = await query<{ jda_po_number: string | null }>(
      "SELECT jda_po_number FROM purchase_orders WHERE id = ?",
      [Number(id)]
    );
    if (!poCheck[0]?.jda_po_number) {
      return badRequest("ยังไม่สามารถบันทึกการชำระเงินได้ เนื่องจากยังไม่ได้รับเลข PO จาก JDA กรุณารอให้ระบบ JDA ยืนยันก่อน");
    }

    const result = await recordPayment({
      po_id: Number(id),
      amount,
      paid_at,
      method,
      reference,
      notes,
      slip_path,
      recorded_by: auth.user.id,
      overpay_handling,
      customer_id,
    });

    // Auto-trigger RPA debt deduction in JDA (fire-and-forget)
    triggerPaymentRpa(result.payment_id, Number(id), amount, paid_at);

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
