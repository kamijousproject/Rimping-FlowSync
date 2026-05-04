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
} from "@/backend/services/customers";

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
    const [adjustments, temps, effective] = await Promise.all([
      listCreditAdjustments(cid),
      listTempCreditLimits(cid),
      getEffectiveCreditLimit(cid),
    ]);
    return NextResponse.json({ adjustments, temps, effective });
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
    if (parsed.data.action === "adjust") {
      const newLimit = await adjustCreditLimit(Number(id), parsed.data.delta, auth.user.id, parsed.data.reason);
      return NextResponse.json({ ok: true, new_limit: newLimit });
    }
    if (parsed.data.action === "temp") {
      if (parsed.data.start_date >= parsed.data.end_date) {
        return badRequest("วันที่สิ้นสุดต้องหลังวันที่เริ่มต้น");
      }
      const tempId = await createTempCreditLimit({
        customer_id: Number(id),
        extra_amount: parsed.data.extra_amount,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        reason: parsed.data.reason,
        created_by: auth.user.id,
      });
      return NextResponse.json({ ok: true, id: tempId }, { status: 201 });
    }
    if (parsed.data.action === "deactivate_temp") {
      await deactivateTempCreditLimit(parsed.data.temp_id);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    return serverError(e);
  }
}
