import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "../../_helpers";
import { createGroupPos } from "@/backend/services/po";

const Schema = z.object({
  group_id: z.coerce.number().int().positive(),
  customer_ids: z.array(z.coerce.number().int().positive()).min(1),
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

// สร้างใบเสนอราคาแบบกลุ่ม — 1 ใบต่อ 1 ร้าน เลขรันต่อกัน
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest("ข้อมูลไม่ถูกต้อง", parsed.error.issues);
  try {
    const pos = await createGroupPos({ ...parsed.data, created_by: auth.user.id });
    return NextResponse.json({ pos }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
