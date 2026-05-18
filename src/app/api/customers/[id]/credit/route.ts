import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, badRequest, serverError } from "../../../_helpers";
import {
  adjustCreditLimit,
  listCreditAdjustments,
  createTempCreditLimit,
  listTempCreditLimits,
  deactivateTempCreditLimit,
  getEffectiveCreditLimit,
  createCreditLimitRequest,
  listPendingCreditLimitRequests,
} from "@/backend/services/customers";
import { sendCreditLimitApprovalEmail } from "@/backend/services/email";
import { query } from "@/backend/db";

const AdjustSchema = z.object({
  action: z.literal("adjust"),
  delta: z.number().refine((v) => v !== 0, "delta ต้องไม่เป็น 0"),
  reason: z.string().optional(),
});

const TempSchema = z.object({
  action: z.literal("temp"),
  extra_amount: z.number().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

const DeactivateSchema = z.object({
  action: z.literal("deactivate_temp"),
  temp_id: z.number().int().positive(),
});

const Schema = z.discriminatedUnion("action", [AdjustSchema, TempSchema, DeactivateSchema]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const cid = Number(id);
  try {
    const [adjustments, temps, effective, pendingRequests] = await Promise.all([
      listCreditAdjustments(cid),
      listTempCreditLimits(cid),
      getEffectiveCreditLimit(cid),
      listPendingCreditLimitRequests(),
    ]);
    // Filter pending requests for this customer
    const customerPendingRequests = pendingRequests.filter(r => r.customer_id === cid);
    return NextResponse.json({ adjustments, temps, effective, pendingRequests: customerPendingRequests });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest("ข้อมูลไม่ถูกต้อง", parsed.error.issues);

  try {
    // Get customer info for email
    const custRows = await query<{ name: string; code: string; credit_limit: number }>(
      "SELECT name, code, credit_limit FROM customers WHERE id = ? LIMIT 1",
      [Number(id)]
    );
    const customer = custRows[0];
    if (!customer) return badRequest("ไม่พบลูกค้า");

    // ตรวจสอบ pending request (ใดๆ) สำหรับลูกค้านี้ ก่อนสร้างคำขอใหม่
    if (parsed.data.action === "adjust" && parsed.data.delta > 0 || parsed.data.action === "temp") {
      const allPending = await listPendingCreditLimitRequests();
      const pendingForCustomer = allPending.filter((r) => r.customer_id === Number(id));
      if (pendingForCustomer.length > 0) {
        const pendingType = pendingForCustomer[0].request_type === "permanent_increase"
          ? "เพิ่มวงเงินถาวร"
          : "วงเงินชั่วคราว";
        return badRequest(`มีคำขอ${pendingType}ที่รออนุมัติอยู่แล้ว กรุณารอให้ผู้จัดการอนุมัติก่อน`);
      }
    }

    if (parsed.data.action === "adjust") {
      // Only positive deltas (increases) need approval, decreases can be immediate
      if (parsed.data.delta > 0) {
        // Create approval request for increase
        const { id: requestId, approval_token } = await createCreditLimitRequest({
          request_type: "permanent_increase",
          customer_id: Number(id),
          amount: parsed.data.delta,
          reason: parsed.data.reason,
          requested_by: auth.user.id,
        });

        // Send email to manager
        await sendCreditLimitApprovalEmail(
          requestId,
          approval_token,
          customer.name,
          customer.code,
          "permanent_increase",
          parsed.data.delta,
          parsed.data.reason || null,
          auth.user.full_name || auth.user.email
        );

        return NextResponse.json({ 
          ok: true, 
          message: "ส่งคำขอเพิ่มวงเงินไปยังผู้จัดการแล้ว กรุณารอการอนุมัติ",
          request_id: requestId 
        }, { status: 201 });
      } else {
        // Decrease can be immediate
        const newLimit = await adjustCreditLimit(Number(id), parsed.data.delta, auth.user.id, parsed.data.reason);
        return NextResponse.json({ ok: true, new_limit: newLimit });
      }
    }
    if (parsed.data.action === "temp") {
      if (parsed.data.start_date >= parsed.data.end_date) {
        return badRequest("วันที่สิ้นสุดต้องหลังวันที่เริ่มต้น");
      }
      // ตรวจสอบ 20% cap
      const baseLimit = Number(customer.credit_limit ?? 0);
      const maxExtra = Math.floor(baseLimit * 0.2);
      if (parsed.data.extra_amount > maxExtra) {
        return badRequest(
          `วงเงินชั่วคราวต้องไม่เกิน 20% ของวงเงินตั้งต้น (สูงสุด ${maxExtra.toLocaleString("th-TH")} บาท)`
        );
      }

      // Create approval request for temporary credit
      const { id: requestId, approval_token } = await createCreditLimitRequest({
        request_type: "temporary",
        customer_id: Number(id),
        extra_amount: parsed.data.extra_amount,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        reason: parsed.data.reason,
        requested_by: auth.user.id,
      });

      // Send email to manager
      await sendCreditLimitApprovalEmail(
        requestId,
        approval_token,
        customer.name,
        customer.code,
        "temporary",
        parsed.data.extra_amount,
        parsed.data.reason || null,
        auth.user.full_name || auth.user.email
      );

      return NextResponse.json({ 
        ok: true, 
        message: "ส่งคำขอเพิ่มวงเงินชั่วคราวไปยังผู้จัดการแล้ว กรุณารอการอนุมัติ",
        request_id: requestId 
      }, { status: 201 });
    }
    if (parsed.data.action === "deactivate_temp") {
      await deactivateTempCreditLimit(parsed.data.temp_id, auth.user.id);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    return serverError(e);
  }
}
