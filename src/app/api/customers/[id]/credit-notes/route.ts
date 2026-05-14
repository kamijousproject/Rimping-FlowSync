import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../../_helpers";
import { listCustomerCreditNotes, getCustomerAvailableCredit } from "@/backend/services/customer-credit-notes";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { id } = await params;
  try {
    const creditNotes = await listCustomerCreditNotes(Number(id));
    const availableCredit = await getCustomerAvailableCredit(Number(id));
    return NextResponse.json({ 
      credit_notes: creditNotes,
      available_credit: availableCredit 
    });
  } catch (e) {
    return serverError(e);
  }
}
