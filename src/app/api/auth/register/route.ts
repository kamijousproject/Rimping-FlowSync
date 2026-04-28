import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByLogin } from "@/backend/auth";

const Schema = z.object({
  username: z.string().min(3).max(64),
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(["admin", "staff"]).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ข้อมูลไม่ครบ", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const exists =
    (await findUserByLogin(parsed.data.username)) ||
    (await findUserByLogin(parsed.data.email));
  if (exists) {
    return NextResponse.json(
      { error: "username หรือ email นี้ถูกใช้แล้ว" },
      { status: 409 }
    );
  }
  const id = await createUser(parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
