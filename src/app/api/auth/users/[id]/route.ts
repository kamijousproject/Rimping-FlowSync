import { NextResponse } from "next/server";
import { z } from "zod";
import { exec, query } from "@/backend/db";
import { hashPassword } from "@/backend/auth";
import { requireRole, badRequest, serverError } from "../../../_helpers";

const PatchSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "super_admin"]).optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const uid = Number(id);

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success)
    return badRequest("ข้อมูลไม่ถูกต้อง");

  const { full_name, email, role, password } = parsed.data;

  if (password) {
    const hash = await hashPassword(password);
    await exec("UPDATE users SET password_hash=? WHERE id=?", [hash, uid]);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (full_name !== undefined) { fields.push("full_name=?"); values.push(full_name); }
  if (email !== undefined) { fields.push("email=?"); values.push(email); }
  if (role !== undefined) { fields.push("role=?"); values.push(role); }

  if (fields.length > 0) {
    values.push(uid);
    await exec(`UPDATE users SET ${fields.join(", ")} WHERE id=?`, values);
  }

  try {
    const rows = await query<{ id: number; full_name: string; username: string; email: string; role: string }>(
      "SELECT id, full_name, username, email, role FROM users WHERE id=?",
      [uid]
    );
    return NextResponse.json(rows[0] ?? {});
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const uid = Number(id);

  if (uid === auth.user.id)
    return badRequest("ไม่สามารถลบบัญชีของตัวเองได้");

  try {
    await exec("DELETE FROM users WHERE id=?", [uid]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
