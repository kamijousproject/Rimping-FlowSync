import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { setPoStatus, getPo } from "@/backend/services/po";

const ALLOWED = [
  "draft",
  "confirmed",
  "packed",
  "checked",
  "delivered",
  "received",
  "cancelled",
];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.status || !ALLOWED.includes(body.status))
    return badRequest("status ไม่ถูกต้อง");
  try {
    await setPoStatus(Number(id), body.status);
    const updated = await getPo(Number(id));
    if (!updated) return badRequest("ไม่พบ PO");
    return NextResponse.json(updated.po);
  } catch (e) {
    return serverError(e);
  }
}
