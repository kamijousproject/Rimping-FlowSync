import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireRole, badRequest, serverError } from "../_helpers";
import { createCustomerGroup, listCustomerGroups } from "@/backend/services/customer-groups";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  try {
    const groups = await listCustomerGroups();
    return NextResponse.json({ groups });
  } catch (e) {
    return serverError(e);
  }
}

const Schema = z.object({
  name: z.string().trim().min(1),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest("ข้อมูลไม่ถูกต้อง", parsed.error.issues);
  try {
    const id = await createCustomerGroup(parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
