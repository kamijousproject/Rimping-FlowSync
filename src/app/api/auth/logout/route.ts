import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/backend/auth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
