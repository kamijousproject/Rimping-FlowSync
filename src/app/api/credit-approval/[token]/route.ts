import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCreditLimitRequestByToken,
  approveCreditLimitRequest,
  rejectCreditLimitRequest,
} from "@/backend/services/customers";
import { badRequest, serverError } from "../../_helpers";

// Manager user ID used when approving/rejecting via email link (no session)
const MANAGER_USER_ID = parseInt(process.env.MANAGER_USER_ID || "1");

const ApproveSchema = z.object({
  action: z.literal("approve"),
});

const RejectSchema = z.object({
  action: z.literal("reject"),
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
      const result = await approveCreditLimitRequest(token, MANAGER_USER_ID);
      return NextResponse.json(result);
    } else {
      const result = await rejectCreditLimitRequest(token, MANAGER_USER_ID, parsed.data.reason);
      return NextResponse.json(result);
    }
  } catch (e) {
    return serverError(e);
  }
}
