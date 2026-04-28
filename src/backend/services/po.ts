import { query, exec, withTx } from "../db";
import { getCustomerOutstanding } from "./customers";

export type PoItemInput = {
  product_name: string;
  description?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
};

export type PoItem = PoItemInput & {
  id: number;
  po_id: number;
  line_total: number;
};

export type PurchaseOrder = {
  id: number;
  po_number: string;
  customer_id: number;
  customer_name?: string;
  status:
    | "draft"
    | "confirmed"
    | "packed"
    | "checked"
    | "delivered"
    | "received"
    | "cancelled";
  payment_status: "unpaid" | "partial" | "paid";
  credit_term_days: number;
  subtotal: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  signed_doc_path: string | null;
  signed_at: Date | null;
  due_date: Date | null;
  notes: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
};

const STATUS_ORDER: PurchaseOrder["status"][] = [
  "draft",
  "confirmed",
  "packed",
  "checked",
  "delivered",
  "received",
];

export function nextStatus(
  s: PurchaseOrder["status"]
): PurchaseOrder["status"] | null {
  if (s === "cancelled" || s === "received") return null;
  const i = STATUS_ORDER.indexOf(s);
  return i < 0 || i >= STATUS_ORDER.length - 1 ? null : STATUS_ORDER[i + 1];
}

export async function generatePoNumber(): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM purchase_orders WHERE po_number LIKE ?",
    [`PO${ym}-%`]
  );
  const n = Number(rows[0]?.c || 0) + 1;
  return `PO${ym}-${String(n).padStart(4, "0")}`;
}

export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM invoices WHERE invoice_number LIKE ?",
    [`INV${ym}-%`]
  );
  const n = Number(rows[0]?.c || 0) + 1;
  return `INV${ym}-${String(n).padStart(4, "0")}`;
}

export async function createPo(input: {
  customer_id: number;
  credit_term_days: number;
  notes?: string;
  items: PoItemInput[];
  created_by: number;
}): Promise<{ id: number; po_number: string; total: number }> {
  if (!input.items.length) throw new Error("PO must have at least 1 item");

  const subtotal = input.items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const total = subtotal;

  // Credit check
  const outstanding = await getCustomerOutstanding(input.customer_id);
  const cust = await query<{ credit_limit: number; name: string }>(
    "SELECT credit_limit, name FROM customers WHERE id=?",
    [input.customer_id]
  );
  if (!cust[0]) throw new Error("Customer not found");
  const limit = Number(cust[0].credit_limit);
  if (outstanding + total > limit) {
    throw new Error(
      `เกินวงเงินสินเชื่อ: ลูกค้ามีหนี้คงค้าง ${outstanding.toLocaleString()} + PO นี้ ${total.toLocaleString()} > วงเงิน ${limit.toLocaleString()}`
    );
  }

  const po_number = await generatePoNumber();

  return withTx(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO purchase_orders
        (po_number, customer_id, status, payment_status, credit_term_days,
         subtotal, total, paid_amount, remaining_amount, notes, created_by)
       VALUES (?, ?, 'draft', 'unpaid', ?, ?, ?, 0, ?, ?, ?)`,
      [
        po_number,
        input.customer_id,
        input.credit_term_days,
        subtotal,
        total,
        total,
        input.notes || null,
        input.created_by,
      ]
    );
    const poId = (r as { insertId: number }).insertId;

    for (const it of input.items) {
      const lineTotal = Number(it.quantity) * Number(it.unit_price);
      await conn.query(
        `INSERT INTO po_items
          (po_id, product_name, description, quantity, unit, unit_price, line_total)
         VALUES (?,?,?,?,?,?,?)`,
        [
          poId,
          it.product_name,
          it.description || null,
          it.quantity,
          it.unit || "pcs",
          it.unit_price,
          lineTotal,
        ]
      );
    }

    return { id: poId, po_number, total };
  });
}

export async function listPos(filter?: {
  customer_id?: number;
  status?: string;
  payment_status?: string;
}): Promise<PurchaseOrder[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter?.customer_id) {
    where.push("po.customer_id = ?");
    params.push(filter.customer_id);
  }
  if (filter?.status) {
    where.push("po.status = ?");
    params.push(filter.status);
  }
  if (filter?.payment_status) {
    where.push("po.payment_status = ?");
    params.push(filter.payment_status);
  }
  const sql = `SELECT po.*, c.name AS customer_name
               FROM purchase_orders po
               JOIN customers c ON c.id = po.customer_id
               ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY po.created_at DESC`;
  return query<PurchaseOrder>(sql, params);
}

export async function getPo(
  id: number
): Promise<{ po: PurchaseOrder; items: PoItem[] } | null> {
  const rows = await query<PurchaseOrder>(
    `SELECT po.*, c.name AS customer_name
     FROM purchase_orders po
     JOIN customers c ON c.id = po.customer_id
     WHERE po.id = ?`,
    [id]
  );
  if (!rows[0]) return null;
  const items = await query<PoItem>(
    "SELECT * FROM po_items WHERE po_id=? ORDER BY id",
    [id]
  );
  return { po: rows[0], items };
}

export async function setPoStatus(
  id: number,
  status: PurchaseOrder["status"]
) {
  // When moving to delivered/received, set due_date if not set
  if (status === "received" || status === "delivered") {
    await exec(
      `UPDATE purchase_orders
       SET status=?,
           due_date = DATE_ADD(CURDATE(), INTERVAL credit_term_days DAY),
           signed_at = CASE WHEN ?='received' THEN COALESCE(signed_at, NOW()) ELSE signed_at END
       WHERE id=?`,
      [status, status, id]
    );
  } else {
    await exec("UPDATE purchase_orders SET status=? WHERE id=?", [status, id]);
  }
}

export async function setSignedDoc(id: number, path: string) {
  await exec(
    "UPDATE purchase_orders SET signed_doc_path=?, signed_at=NOW(), status=CASE WHEN status IN ('delivered','checked','packed','confirmed') THEN 'received' ELSE status END WHERE id=?",
    [path, id]
  );
}
