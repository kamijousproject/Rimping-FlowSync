import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { getPo } from "@/backend/services/po";
import { exec } from "@/backend/db";

const RPA_BOT_URL = process.env.RPA_BOT_URL ?? "http://localhost:8001";

export async function GET(
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

  // Already resolved — return stored value immediately
  if (po.jda_po_number) {
    return NextResponse.json({ status: "success", jda_po_number: po.jda_po_number });
  }

  if (!po.jda_job_id) {
    return NextResponse.json({ status: "not_triggered" });
  }

  try {
    const res = await fetch(`${RPA_BOT_URL}/rpa/jobs/${po.jda_job_id}`);
    if (!res.ok) {
      return NextResponse.json({ status: "error", message: `RPA bot HTTP ${res.status}` });
    }

    const body: {
      status: string;
      value: string;
      step?: string;
      step_label?: string;
      progress?: number;
      remaining_seconds?: number;
    } = await res.json();

    if (body.status === "success") {
      await exec(
        "UPDATE purchase_orders SET jda_po_number = ?, jda_synced_at = NOW() WHERE id = ?",
        [body.value, poId]
      );
      return NextResponse.json({ status: "success", jda_po_number: body.value, progress: 100 });
    }

    return NextResponse.json({
      status: "pending",
      step: body.step,
      step_label: body.step_label,
      progress: body.progress,
      remaining_seconds: body.remaining_seconds,
    });
  } catch (e) {
    return serverError(e);
  }
}
