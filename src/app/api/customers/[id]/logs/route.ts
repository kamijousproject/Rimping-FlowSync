import { NextResponse } from "next/server";
import { requireUser, serverError } from "../../../_helpers";
import { listCustomerEditLogs } from "@/backend/services/customers";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  
  // Get pagination parameters from URL
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(5, Number(searchParams.get('limit')) || 10));
  
  try {
    const result = await listCustomerEditLogs(Number(id), page, limit);
    return NextResponse.json(result);
  } catch (e) {
    return serverError(e);
  }
}
