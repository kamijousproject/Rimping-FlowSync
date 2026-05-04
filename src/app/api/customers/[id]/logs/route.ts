import { NextResponse } from "next/server";
import { requireUser, serverError } from "../../../_helpers";
import { listCustomerEditLogs } from "@/backend/services/customers";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const logs = await listCustomerEditLogs(Number(id));
    return NextResponse.json({ logs });
  } catch (e) {
    return serverError(e);
  }
}
