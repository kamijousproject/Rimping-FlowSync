import { NextResponse } from "next/server";
import { requireUser, requireRole, serverError } from "../../../_helpers";
import {
  listCustomerFiles,
  addCustomerFile,
  deleteCustomerFile,
} from "@/backend/services/customers";
import { saveUpload } from "@/backend/upload";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const files = await listCustomerFiles(Number(id));
    return NextResponse.json({ files });
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
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ error: "ไม่มีไฟล์" }, { status: 400 });
    }
    const saved: number[] = [];
    for (const file of files) {
      const filePath = await saveUpload("customer-files", file);
      const fileId = await addCustomerFile({
        customer_id: Number(id),
        original_name: file.name,
        file_path: filePath,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        uploaded_by: auth.user.id,
      });
      saved.push(fileId);
    }
    return NextResponse.json({ ids: saved }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  req: Request,
  _ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const { fileId } = await req.json().catch(() => ({}));
  if (!fileId) return NextResponse.json({ error: "ต้องระบุ fileId" }, { status: 400 });
  try {
    await deleteCustomerFile(Number(fileId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
