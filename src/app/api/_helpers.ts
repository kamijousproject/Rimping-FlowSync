import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "@/backend/auth";

export async function requireUser(): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; res: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export async function requireRole(
  ...roles: SessionUser["role"][]
): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; res: NextResponse }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!roles.includes(auth.user.role)) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "ไม่มีสิทธิ์ดำเนินการนี้ (ต้องเป็น super admin)" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user: auth.user };
}

export function badRequest(msg: string, details?: unknown) {
  return NextResponse.json({ error: msg, details }, { status: 400 });
}

export function serverError(err: unknown) {
  const msg = err instanceof Error ? err.message : "Server error";
  return NextResponse.json({ error: msg }, { status: 500 });
}
