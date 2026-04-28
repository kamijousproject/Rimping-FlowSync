import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { setSignedDoc } from "@/backend/services/po";
import { saveUpload } from "@/backend/upload";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("ต้องแนบไฟล์ field 'file'");
    const path = await saveUpload("signed", file);
    await setSignedDoc(Number(id), path);
    return NextResponse.json({ ok: true, path });
  } catch (e) {
    return serverError(e);
  }
}
