import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../../../_helpers";
import { getPaymentById } from "@/backend/services/payments";
import { query, exec } from "@/backend/db";
import type { PurchaseOrder } from "@/backend/services/po";

const RPA_BOT_URL = process.env.RPA_BOT_URL ?? "http://localhost:8001";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  const { id, paymentId } = await ctx.params;
  const poId = Number(id);
  const pmId = Number(paymentId);

  const payment = await getPaymentById(pmId);
  if (!payment || payment.po_id !== poId) return badRequest("ไม่พบรายการชำระเงิน");
  if (payment.jda_synced_at) return NextResponse.json({ already_synced: true });

  const poRows = await query<PurchaseOrder>(
    "SELECT po_number, customer_id, jda_po_number FROM purchase_orders WHERE id = ?",
    [poId]
  );
  const po = poRows[0];
  if (!po) return badRequest("ไม่พบ PO");

  try {
    const res = await fetch(`${RPA_BOT_URL}/rpa/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        function_id: 2,
        data: {
          po_id: po.po_number,
          customer_id: String(po.customer_id),
          amount: String(payment.amount),
          date: new Date(payment.paid_at).toISOString().slice(0, 10),
          po_jda: po.jda_po_number ?? "",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return serverError(new Error(`RPA bot error: ${errText}`));
    }

    const { job_id } = await res.json();
    await exec("UPDATE payments SET jda_job_id = ? WHERE id = ?", [job_id, pmId]);

    return NextResponse.json({ job_id });
  } catch (e) {
    return serverError(e);
  }
}
