import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/auth";
import { createBillingNote, listBillingNotes } from "@/backend/services/billing-notes";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const notes = await listBillingNotes(Number(id));
  return NextResponse.json({ billing_notes: notes });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  try {
    const bnId = await createBillingNote({
      customer_id: Number(id),
      issued_date: body.issued_date,
      due_date: body.due_date,
      notes: body.notes,
      created_by: user.id,
      items: body.items,
    });
    return NextResponse.json({ id: bnId }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
