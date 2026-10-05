import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { setPoDocRef } from "@/backend/services/po";

const Schema = z.object({
  doc_number: z.string().trim().min(1).max(64),
  doc_reference: z.string().trim().min(1).max(64),
});

// แก้เลขที่เอกสาร/อ้างอิงที่กรอกเอง (ลูกค้ากลุ่ม)
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest("กรุณากรอกเลขที่เอกสารและอ้างอิง");
  try {
    await setPoDocRef(Number(id), parsed.data, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
