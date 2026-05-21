import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../../../_helpers";
import { getPaymentById } from "@/backend/services/payments";
import { exec } from "@/backend/db";

const RPA_BOT_URL = process.env.RPA_BOT_URL ?? "http://localhost:8001";

export async function GET(
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

  if (payment.jda_synced_at) {
    return NextResponse.json({ status: "success" });
  }

  if (!payment.jda_job_id) {
    return NextResponse.json({ status: "not_triggered" });
  }

  try {
    const res = await fetch(`${RPA_BOT_URL}/rpa/jobs/${payment.jda_job_id}`);
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
        "UPDATE payments SET jda_synced_at = NOW() WHERE id = ?",
        [pmId]
      );
      return NextResponse.json({ status: "success", progress: 100 });
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
