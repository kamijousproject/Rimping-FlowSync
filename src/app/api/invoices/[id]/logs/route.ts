import { NextResponse } from "next/server";
import { requireUser, serverError } from "../../../_helpers";
import { logInvoiceAction, getInvoiceLogs, getInvoice } from "@/backend/services/payments";

// POST /api/invoices/[id]/logs - Log an action (download, print, view)
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  const { id } = await ctx.params;
  const invoiceId = Number(id);

  try {
    const body = await req.json().catch(() => ({}));
    const { action = "viewed" } = body;

    // Validate invoice exists
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get client info
    const headers = req.headers;
    const userAgent = headers.get("user-agent") || undefined;
    // In production, you might want to get the real IP from x-forwarded-for
    const ipAddress = headers.get("x-forwarded-for") || headers.get("x-real-ip") || undefined;

    // Log the action
    await logInvoiceAction(
      invoiceId,
      action,
      auth.user.id,
      auth.user.full_name || auth.user.username,
      ipAddress || undefined,
      userAgent || undefined
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return serverError(e);
  }
}

// GET /api/invoices/[id]/logs - Get logs for an invoice
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  const { id } = await ctx.params;
  const invoiceId = Number(id);

  try {
    const logs = await getInvoiceLogs(invoiceId);
    return NextResponse.json({ logs });
  } catch (e) {
    return serverError(e);
  }
}
