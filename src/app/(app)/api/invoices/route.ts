import { NextResponse } from "next/server";
import { query } from "@/backend/db";
import { getCurrentUser } from "@/backend/auth";

export type InvoiceWithDetails = {
  id: number;
  po_id: number;
  po_number: string;
  tax_invoice_number: string;
  customer_id: number;
  customer_code: string;
  customer_name: string;
  amount: number;
  po_date: string;
  generated_at: string;
  generated_by: number;
  generator_name: string;
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    
    // Filters
    const customerId = searchParams.get("customer_id");
    const customerName = searchParams.get("customer_name");
    const taxInvoiceNumber = searchParams.get("tax_invoice_number");
    const minAmount = searchParams.get("min_amount");
    const maxAmount = searchParams.get("max_amount");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    
    const offset = (page - 1) * limit;
    
    // Build WHERE conditions
    // ไม่แสดงรายการที่ชำระครบแล้ว
    const conditions: string[] = ["po.tax_invoice_number IS NOT NULL", "po.payment_status != 'paid'"];
    const params: any[] = [];
    
    if (customerId) {
      conditions.push("po.customer_id = ?");
      params.push(customerId);
    }
    
    if (customerName) {
      conditions.push("c.name LIKE ?");
      params.push(`%${customerName}%`);
    }
    
    if (taxInvoiceNumber) {
      conditions.push("po.tax_invoice_number LIKE ?");
      params.push(`%${taxInvoiceNumber}%`);
    }
    
    if (minAmount) {
      conditions.push("po.total >= ?");
      params.push(minAmount);
    }
    
    if (maxAmount) {
      conditions.push("po.total <= ?");
      params.push(maxAmount);
    }
    
    if (dateFrom) {
      conditions.push("po.created_at >= ?");
      params.push(dateFrom);
    }
    
    if (dateTo) {
      conditions.push("po.created_at <= ?");
      params.push(dateTo);
    }
    
    const whereClause = conditions.join(" AND ");
    
    // Count total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM purchase_orders po
      JOIN customers c ON po.customer_id = c.id
      WHERE ${whereClause}
    `;
    const [countResult] = await query<{ total: number }>(countQuery, params);
    const total = countResult?.total || 0;
    
    // Fetch invoices
    const dataQuery = `
      SELECT 
        po.id,
        po.id as po_id,
        po.po_number,
        po.tax_invoice_number,
        po.customer_id,
        c.code as customer_code,
        c.name as customer_name,
        po.total as amount,
        po.created_at as po_date,
        po.created_at as generated_at,
        po.created_by as generated_by,
        u.full_name as generator_name
      FROM purchase_orders po
      JOIN customers c ON po.customer_id = c.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE ${whereClause}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const invoices = await query<InvoiceWithDetails>(dataQuery, [...params, limit, offset]);
    
    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
