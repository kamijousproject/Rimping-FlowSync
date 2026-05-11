import { NextResponse } from "next/server";
import { requireUser, serverError } from "../../_helpers";
import { getInvoiceWithLogs } from "@/backend/services/payments";

// GET /api/invoices/[id] - Get invoice with logs
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  const { id } = await ctx.params;
  const invoiceId = Number(id);

  try {
    const { invoice, logs, download_count } = await getInvoiceWithLogs(invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ invoice, logs, download_count });
  } catch (e) {
    return serverError(e);
  }
}
