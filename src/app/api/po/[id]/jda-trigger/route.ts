import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { getPo } from "@/backend/services/po";
import { exec } from "@/backend/db";

const RPA_BOT_URL = process.env.RPA_BOT_URL ?? "http://localhost:8001";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  const { id } = await ctx.params;
  const poId = Number(id);

  const data = await getPo(poId);
  if (!data) return badRequest("ไม่พบ PO");
  const { po } = data;

  if (po.status !== "confirmed") return badRequest("PO ต้องอยู่ในสถานะ confirmed");
  if (po.jda_po_number) return NextResponse.json({ already_synced: true, jda_po_number: po.jda_po_number });

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

    if (!res.ok) {
      const errText = await res.text();
      return serverError(new Error(`RPA bot error: ${errText}`));
    }

    const { job_id } = await res.json();
    await exec("UPDATE purchase_orders SET jda_job_id = ? WHERE id = ?", [job_id, poId]);

    return NextResponse.json({ job_id });
  } catch (e) {
    return serverError(e);
  }
}
