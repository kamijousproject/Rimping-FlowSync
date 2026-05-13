import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireRole, badRequest, serverError } from "../_helpers";
import { createCustomer, listCustomers } from "@/backend/services/customers";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || undefined;
  try {
    const customers = await listCustomers(search);
    return NextResponse.json({ customers });
  } catch (e) {
    return serverError(e);
  }
}

const Schema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  tax_id: z.string().optional(),
  address: z.string().optional(),
  credit_limit: z.coerce.number().min(0),
  credit_score: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  credit_score_notes: z.string().nullable().optional(),
  default_credit_term_days: z.coerce.number().int().min(0).max(365).optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole("super_admin");
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest("ข้อมูลไม่ถูกต้อง", parsed.error.issues);
  try {
    const id = await createCustomer({
      ...parsed.data,
      email: parsed.data.email || undefined,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
