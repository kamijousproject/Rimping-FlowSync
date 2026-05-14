import { NextResponse } from "next/server";
import { z } from "zod";
import { exec, query } from "@/backend/db";
import { requireRole, badRequest, serverError } from "../../../../_helpers";

const GrantSchema = z.object({
  days: z.number().int().min(1).max(365),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;

  const { id } = await ctx.params;
  const uid = Number(id);

  if (uid === auth.user.id)
    return badRequest("ไม่สามารถให้สิทธิ์ชั่วคราวกับตัวเองได้");

  const body = await req.json().catch(() => null);
  const parsed = GrantSchema.safeParse(body);
  if (!parsed.success) return badRequest("ข้อมูลไม่ถูกต้อง");

  const { days } = parsed.data;

  const users = await query<{ id: number; role: string }>(
    "SELECT id, role FROM users WHERE id=? LIMIT 1",
    [uid]
  );
  if (!users.length) return badRequest("ไม่พบผู้ใช้");
  if (users[0].role === "super_admin")
    return badRequest("ผู้ใช้นี้เป็น super_admin อยู่แล้ว");

  try {
    await exec(
      "DELETE FROM temp_role_grants WHERE user_id=?",
      [uid]
    );
    await exec(
      `INSERT INTO temp_role_grants (user_id, granted_role, granted_by, expires_at)
       VALUES (?, 'super_admin', ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [uid, auth.user.id, days]
    );

    const rows = await query<{ expires_at: string }>(
      "SELECT expires_at FROM temp_role_grants WHERE user_id=? LIMIT 1",
      [uid]
    );
    return NextResponse.json({ ok: true, expires_at: rows[0]?.expires_at });
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

  try {
    await exec("DELETE FROM temp_role_grants WHERE user_id=?", [uid]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
