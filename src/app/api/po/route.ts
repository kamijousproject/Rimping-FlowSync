import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "../_helpers";
import { createPo, listPos } from "@/backend/services/po";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  const customer_id = url.searchParams.get("customer_id");
  const status = url.searchParams.get("status");
  const payment_status = url.searchParams.get("payment_status");
  try {
    const pos = await listPos({
      customer_id: customer_id ? Number(customer_id) : undefined,
      status: status || undefined,
      payment_status: payment_status || undefined,
    });
    return NextResponse.json({ pos });
  } catch (e) {
    return serverError(e);
  }
}

const Schema = z.object({
  customer_id: z.coerce.number().int().positive(),
  credit_term_days: z.coerce.number().int().min(0).max(365),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        product_name: z.string().min(1),
        description: z.string().optional(),
        quantity: z.coerce.number().positive(),
        unit: z.string().optional(),
        unit_price: z.coerce.number().min(0),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest("ข้อมูลไม่ถูกต้อง", parsed.error.issues);
  try {
    const po = await createPo({ ...parsed.data, created_by: auth.user.id });
    return NextResponse.json(po, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
