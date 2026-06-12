import { NextResponse } from "next/server";
import { query } from "@/backend/db";
import { requireUser, badRequest, serverError } from "../../../_helpers";

export type CustomerPo = {
  id: number;
  po_number: string;
  tax_invoice_number: string | null;
  total: number;
  payment_status: string;
  created_at: string;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  try {
    const { id } = await params;
    const customerId = parseInt(id);

    if (isNaN(customerId)) {
      return badRequest("Invalid customer ID");
    }

    const { searchParams } = new URL(req.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Filters
    const poNumber = searchParams.get("po_number");
    const taxInvoiceNumber = searchParams.get("tax_invoice_number");
    const minAmount = searchParams.get("min_amount");
    const maxAmount = searchParams.get("max_amount");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const status = searchParams.get("status");

    // Build WHERE conditions
    const conditions: string[] = ["po.customer_id = ?"];
    const paramsArray: unknown[] = [customerId];

    if (poNumber) {
      conditions.push("po.po_number LIKE ?");
      paramsArray.push(`%${poNumber}%`);
    }

    if (taxInvoiceNumber) {
      conditions.push("po.tax_invoice_number LIKE ?");
      paramsArray.push(`%${taxInvoiceNumber}%`);
    }

    if (minAmount) {
      conditions.push("po.total >= ?");
      paramsArray.push(minAmount);
    }

    if (maxAmount) {
      conditions.push("po.total <= ?");
      paramsArray.push(maxAmount);
    }

    if (dateFrom) {
      conditions.push("po.created_at >= ?");
      paramsArray.push(dateFrom);
    }

    if (dateTo) {
      conditions.push("po.created_at <= ?");
      paramsArray.push(dateTo);
    }

    if (status) {
      conditions.push("po.status = ?");
      paramsArray.push(status);
    }

    const whereClause = conditions.join(" AND ");

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM purchase_orders po
      WHERE ${whereClause}
    `;
    const [countResult] = await query<{ total: number }>(countQuery, paramsArray);
    const total = countResult?.total || 0;

    // Fetch POs
    const dataQuery = `
      SELECT
        po.id,
        po.po_number,
        po.tax_invoice_number,
        po.total,
        po.payment_status,
        po.created_at
      FROM purchase_orders po
      WHERE ${whereClause}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const pos = await query<CustomerPo>(dataQuery, [...paramsArray, limit, offset]);

    return NextResponse.json({
      pos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
