import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { setPoStatus, getPo, type PurchaseOrder } from "@/backend/services/po";
import { exec } from "@/backend/db";

const RPA_BOT_URL = process.env.RPA_BOT_URL ?? "http://localhost:8001";

async function triggerRpaBot(po: PurchaseOrder) {
  try {
    const res = await fetch(`${RPA_BOT_URL}/rpa/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        function_id: 1,
        data: {
          po_id: po.po_number,
          fully_tax: po.tax_invoice_number ?? "",
          customer_id: String(po.customer_id),
          amount: String(po.total),
          date: new Date(po.created_at).toISOString().slice(0, 10),
        },
      }),
    });
    if (res.ok) {
      const { job_id } = await res.json();
      await exec("UPDATE purchase_orders SET jda_job_id = ? WHERE id = ?", [job_id, po.id]);
    }
  } catch {
    // Fire-and-forget — failure is non-blocking; user can retry from the UI
  }
}

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

    // Auto-trigger RPA bot when PO is marked received (fire-and-forget)
    if (body.status === "received" && !updated.po.jda_job_id) {
      triggerRpaBot(updated.po);
    }

    return NextResponse.json(updated.po);
  } catch (e) {
    return serverError(e);
  }
}
