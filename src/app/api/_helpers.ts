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
      res: NextResponse.json({ error: "ต้องล็อกอินก่อน" }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export function badRequest(msg: string, details?: unknown) {
  return NextResponse.json({ error: msg, details }, { status: 400 });
}

export function serverError(err: unknown) {
  const msg = err instanceof Error ? err.message : "Server error";
  return NextResponse.json({ error: msg }, { status: 500 });
}
