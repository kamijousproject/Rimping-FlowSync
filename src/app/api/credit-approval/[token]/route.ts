import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCreditLimitRequestByToken,
  approveCreditLimitRequest,
  rejectCreditLimitRequest,
} from "@/backend/services/customers";
import { badRequest, serverError } from "../../_helpers";

const ApproveSchema = z.object({
  action: z.literal("approve"),
  approved_by: z.number().int().positive(),
});

const RejectSchema = z.object({
  action: z.literal("reject"),
  rejected_by: z.number().int().positive(),
  reason: z.string().optional(),
});

const ActionSchema = z.discriminatedUnion("action", [ApproveSchema, RejectSchema]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;
    const request = await getCreditLimitRequestByToken(token);
    
    if (!request) {
      return NextResponse.json(
        { error: "ไม่พบคำขอหรือลิงก์หมดอายุแล้ว" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ request });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = ActionSchema.safeParse(body);
    
    if (!parsed.success) {
      return badRequest("ข้อมูลไม่ถูกต้อง", parsed.error.issues);
    }
    
    if (parsed.data.action === "approve") {
      const result = await approveCreditLimitRequest(token, parsed.data.approved_by);
      return NextResponse.json(result);
    } else {
      const result = await rejectCreditLimitRequest(token, parsed.data.rejected_by, parsed.data.reason);
      return NextResponse.json(result);
    }
  } catch (e) {
    return serverError(e);
  }
}
