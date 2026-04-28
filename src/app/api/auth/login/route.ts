import { NextResponse } from "next/server";
import {
  findUserByLogin,
  setSessionCookie,
  signSession,
  verifyPassword,
} from "@/backend/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.login || !body?.password) {
    return NextResponse.json(
      { error: "ต้องระบุ login และ password" },
      { status: 400 }
    );
  }
  const user = await findUserByLogin(String(body.login));
  if (!user || !(await verifyPassword(String(body.password), user.password_hash))) {
    return NextResponse.json(
      { error: "username หรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 }
    );
  }
  const token = await signSession({
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  });
  await setSessionCookie(token);
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  });
}
