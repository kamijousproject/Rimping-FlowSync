import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { appendSignedDocs, removeSignedDoc, getPo } from "@/backend/services/po";
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

  // รองรับหลายไฟล์ (field name 'files' หรือ 'file')
  const files = form.getAll("files");
  const single = form.get("file");
  const allFiles = (files.length > 0 ? files : single ? [single] : []) as File[];

  if (allFiles.length === 0)
    return badRequest("ต้องแนบไฟล์อย่างน้อย 1 ไฟล์");
  for (const file of allFiles) {
    if (!(file instanceof File)) return badRequest("ไฟล์ไม่ถูกต้อง");
    if (!ACCEPTED_MIME.test(file.type))
      return badRequest(`ไฟล์ '${file.name}' ไม่รองรับ รองรับเฉพาะรูปภาพหรือ PDF`);
  }

  try {
    const paths = await Promise.all(
      allFiles.map((file) => saveUpload("signed", file))
    );
    await appendSignedDocs(Number(id), paths);
    const updated = await getPo(Number(id));
    if (!updated) return badRequest("ไม่พบ PO");
    return NextResponse.json({ ...updated.po, po: updated.po });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.path) return badRequest("ต้องระบุ path ที่ต้องการลบ");

  try {
    await removeSignedDoc(Number(id), body.path);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
