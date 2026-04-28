import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { setSignedDoc, getPo } from "@/backend/services/po";
import { saveUpload } from "@/backend/upload";

export const runtime = "nodejs";

const ACCEPTED_MIME = /^(image\/|application\/pdf$)/;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("body ต้องเป็น multipart/form-data");
  }
  const file = form.get("file");
  if (!(file instanceof File))
    return badRequest("ต้องแนบไฟล์ field 'file'");
  if (!ACCEPTED_MIME.test(file.type))
    return badRequest("รองรับเฉพาะรูปภาพหรือ PDF");
  try {
    const path = await saveUpload("signed", file);
    await setSignedDoc(Number(id), path);
    const updated = await getPo(Number(id));
    if (!updated) return badRequest("ไม่พบ PO");
    return NextResponse.json({ ...updated.po, po: updated.po });
  } catch (e) {
    return serverError(e);
  }
}
