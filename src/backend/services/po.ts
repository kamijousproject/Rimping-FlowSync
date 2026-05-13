import { query, exec, withTx } from "../db";
import { getCustomerOutstanding, getEffectiveCreditLimit } from "./customers";

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
  signed_doc_path: string | null;  // JSON array string or single path (legacy)
  signed_at: Date | null;
  tax_invoice_number: string | null;
  due_date: Date | null;
  fully_paid_at: Date | null;
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

export function invoiceNumberFromPo(po_number: string): string {
  return po_number.replace(/^PO/, "INV").replace(/^QT/, "INV");
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

  // Credit check (uses effective limit = base + active temp credit)
  const outstanding = await getCustomerOutstanding(input.customer_id);
  const { effective_limit, base_limit, temp_extra } = await getEffectiveCreditLimit(input.customer_id);
  if (!effective_limit && effective_limit !== 0) throw new Error("Customer not found");
  if (outstanding + total > effective_limit) {
    const limitDesc = temp_extra > 0
      ? `${base_limit.toLocaleString()} + วงเงินชั่วคราว ${temp_extra.toLocaleString()} = ${effective_limit.toLocaleString()}`
      : effective_limit.toLocaleString();
    throw new Error(
      `เกินวงเงินสินเชื่อ: ลูกค้ามีหนี้คงค้าง ${outstanding.toLocaleString()} + PO นี้ ${total.toLocaleString()} > วงเงิน ${limitDesc}`
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
  customer_name?: string;
  po_number?: string;
  status?: string;
  payment_status?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: string;
  max_amount?: string;
  page?: number;
  limit?: number;
}): Promise<{ pos: PurchaseOrder[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter?.customer_id) {
    where.push("po.customer_id = ?");
    params.push(filter.customer_id);
  }
  if (filter?.customer_name) {
    where.push("c.name LIKE ?");
    params.push(`%${filter.customer_name}%`);
  }
  if (filter?.po_number) {
    where.push("po.po_number LIKE ?");
    params.push(`%${filter.po_number}%`);
  }
  if (filter?.status) {
    where.push("po.status = ?");
    params.push(filter.status);
  }
  if (filter?.payment_status) {
    where.push("po.payment_status = ?");
    params.push(filter.payment_status);
  }
  if (filter?.start_date) {
    where.push("po.created_at >= ?");
    params.push(filter.start_date);
  }
  if (filter?.end_date) {
    where.push("po.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(filter.end_date);
  }
  if (filter?.min_amount) {
    where.push("po.total >= ?");
    params.push(filter.min_amount);
  }
  if (filter?.max_amount) {
    where.push("po.total <= ?");
    params.push(filter.max_amount);
  }

  const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

  // Count total (need JOIN if filtering by customer name)
  const needCustomerJoin = filter?.customer_name;
  const countSql = needCustomerJoin
    ? `SELECT COUNT(*) as total FROM purchase_orders po JOIN customers c ON c.id = po.customer_id ${whereClause}`
    : `SELECT COUNT(*) as total FROM purchase_orders po ${whereClause}`;
  const countResult = await query<{ total: number }>(countSql, params);
  const total = Number(countResult[0]?.total || 0);

  // Fetch paginated results
  const page = filter?.page || 1;
  const limit = filter?.limit || 10;
  const offset = (page - 1) * limit;

  const sql = `SELECT po.*, c.name AS customer_name
               FROM purchase_orders po
               JOIN customers c ON c.id = po.customer_id
               ${whereClause}
               ORDER BY po.created_at DESC
               LIMIT ? OFFSET ?`;
  const pos = await query<PurchaseOrder>(sql, [...params, limit, offset]);

  return { pos, total };
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
  status: PurchaseOrder["status"],
  opts?: { tax_invoice_number?: string; edited_by?: number }
) {
  const existing = await query<PurchaseOrder>("SELECT * FROM purchase_orders WHERE id=?", [id]);
  const before = existing[0];
  if (!before) throw new Error("ไม่พบ PO");

  if (status === "received" || status === "delivered") {
    await exec(
      `UPDATE purchase_orders
       SET status=?,
           tax_invoice_number = COALESCE(?, tax_invoice_number),
           due_date = DATE_ADD(CURDATE(), INTERVAL credit_term_days DAY),
           signed_at = CASE WHEN ?='received' THEN COALESCE(signed_at, NOW()) ELSE signed_at END
       WHERE id=?`,
      [status, opts?.tax_invoice_number ?? null, status, id]
    );
  } else {
    await exec("UPDATE purchase_orders SET status=? WHERE id=?", [status, id]);
  }

  if (opts?.edited_by) {
    const summaryParts: string[] = [`เปลี่ยนสถานะ: ${before.status} → ${status}`];
    if (opts.tax_invoice_number) summaryParts.push(`เลขใบกำกับภาษี: ${opts.tax_invoice_number}`);
    await exec(
      `INSERT INTO po_edit_logs (po_id, edited_by, summary, changes) VALUES (?,?,?,?)`,
      [
        id,
        opts.edited_by,
        summaryParts.join(", ").slice(0, 255),
        JSON.stringify({ before: { status: before.status, tax_invoice_number: before.tax_invoice_number }, after: { status, tax_invoice_number: opts.tax_invoice_number ?? before.tax_invoice_number } }),
      ]
    );
  }
}

export async function setTaxInvoiceNumber(
  id: number,
  tax_invoice_number: string,
  edited_by: number
): Promise<void> {
  const existing = await query<PurchaseOrder>("SELECT * FROM purchase_orders WHERE id=?", [id]);
  const before = existing[0];
  if (!before) throw new Error("ไม่พบ PO");
  await exec("UPDATE purchase_orders SET tax_invoice_number=? WHERE id=?", [tax_invoice_number, id]);
  await exec(
    `INSERT INTO po_edit_logs (po_id, edited_by, summary, changes) VALUES (?,?,?,?)`,
    [
      id,
      edited_by,
      `แก้ไขเลขใบกำกับภาษี: ${before.tax_invoice_number ?? "(ว่าง)"} → ${tax_invoice_number}`.slice(0, 255),
      JSON.stringify({ before: { tax_invoice_number: before.tax_invoice_number }, after: { tax_invoice_number } }),
    ]
  );
}

export type PoEditLog = {
  id: number;
  po_id: number;
  edited_by: number;
  editor_name: string;
  summary: string;
  changes: string;
  created_at: Date;
};

export async function listPoEditLogs(poId: number): Promise<PoEditLog[]> {
  return query<PoEditLog>(
    `SELECT l.*, u.full_name AS editor_name
     FROM po_edit_logs l
     JOIN users u ON u.id = l.edited_by
     WHERE l.po_id = ?
     ORDER BY l.created_at DESC`,
    [poId]
  );
}

/**
 * Edit a PO (notes, credit_term_days, items). Blocks if paid in full.
 * Recomputes subtotal/total/remaining_amount and performs credit check
 * against the new total. Writes an audit log with before/after snapshot.
 */
export async function updatePo(input: {
  id: number;
  credit_term_days: number;
  notes?: string | null;
  items: PoItemInput[];
  edited_by: number;
}): Promise<void> {
  if (!input.items.length) throw new Error("PO ต้องมีอย่างน้อย 1 รายการ");

  const existing = await getPo(input.id);
  if (!existing) throw new Error("ไม่พบ PO");
  if (existing.po.payment_status === "paid") {
    throw new Error("PO นี้ชำระครบแล้ว ไม่สามารถแก้ไขได้");
  }

  // Check if PO has credit notes (which reference po_items)
  const creditNotes = await query(
    "SELECT id FROM credit_notes WHERE po_id = ?",
    [input.id]
  );
  if (creditNotes.length > 0) {
    throw new Error("ไม่สามารถแก้ไข PO ที่มีใบลดหนี้แล้ว กรุณายกเลิกใบลดหนี้ก่อนแก้ไข");
  }

  const newSubtotal = input.items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const newTotal = newSubtotal;
  const paid = Number(existing.po.paid_amount);
  if (newTotal < paid) {
    throw new Error(
      `ยอด PO ใหม่ (${newTotal.toLocaleString()}) ต่ำกว่ายอดที่ชำระไปแล้ว (${paid.toLocaleString()})`
    );
  }
  const newRemaining = newTotal - paid;

  // Credit check: how much would outstanding become if we change this PO?
  const otherOutstanding =
    (await getCustomerOutstanding(existing.po.customer_id)) -
    Number(existing.po.remaining_amount);
  const { effective_limit: effLimit, base_limit: baseLimit, temp_extra: tempExtra } = await getEffectiveCreditLimit(existing.po.customer_id);
  if (effLimit !== undefined) {
    if (otherOutstanding + newRemaining > effLimit) {
      const limitDesc = tempExtra > 0
        ? `${baseLimit.toLocaleString()} + วงเงินชั่วคราว ${tempExtra.toLocaleString()} = ${effLimit.toLocaleString()}`
        : effLimit.toLocaleString();
      throw new Error(
        `เกินวงเงินสินเชื่อ: คงค้างอื่น ${otherOutstanding.toLocaleString()} + PO นี้ ${newRemaining.toLocaleString()} > วงเงิน ${limitDesc}`
      );
    }
  }

  // Compute summary & changes JSON
  const before = {
    credit_term_days: existing.po.credit_term_days,
    notes: existing.po.notes,
    subtotal: Number(existing.po.subtotal),
    total: Number(existing.po.total),
    items: existing.items.map((it) => ({
      product_name: it.product_name,
      description: it.description || "",
      quantity: Number(it.quantity),
      unit: it.unit,
      unit_price: Number(it.unit_price),
      line_total: Number(it.line_total),
    })),
  };
  const after = {
    credit_term_days: input.credit_term_days,
    notes: input.notes ?? null,
    subtotal: newSubtotal,
    total: newTotal,
    items: input.items.map((it) => ({
      product_name: it.product_name,
      description: it.description || "",
      quantity: Number(it.quantity),
      unit: it.unit || "pcs",
      unit_price: Number(it.unit_price),
      line_total: Number(it.quantity) * Number(it.unit_price),
    })),
  };
  const summaryParts: string[] = [];
  if (before.total !== after.total)
    summaryParts.push(
      `ยอดรวม ${before.total.toLocaleString()} → ${after.total.toLocaleString()}`
    );
  if (before.credit_term_days !== after.credit_term_days)
    summaryParts.push(
      `เครดิต ${before.credit_term_days}→${after.credit_term_days} วัน`
    );
  if (before.items.length !== after.items.length)
    summaryParts.push(
      `รายการ ${before.items.length}→${after.items.length} ชิ้น`
    );
  if ((before.notes || "") !== (after.notes || ""))
    summaryParts.push("แก้ไขหมายเหตุ");
  const summary = summaryParts.length
    ? summaryParts.join(", ")
    : "แก้ไขรายการสินค้า";

  await withTx(async (conn) => {
    await conn.query(
      `UPDATE purchase_orders
       SET credit_term_days=?, notes=?, subtotal=?, total=?, remaining_amount=?
       WHERE id=?`,
      [
        input.credit_term_days,
        input.notes ?? null,
        newSubtotal,
        newTotal,
        newRemaining,
        input.id,
      ]
    );
    await conn.query("DELETE FROM po_items WHERE po_id=?", [input.id]);
    for (const it of input.items) {
      const lineTotal = Number(it.quantity) * Number(it.unit_price);
      await conn.query(
        `INSERT INTO po_items
           (po_id, product_name, description, quantity, unit, unit_price, line_total)
         VALUES (?,?,?,?,?,?,?)`,
        [
          input.id,
          it.product_name,
          it.description || null,
          it.quantity,
          it.unit || "pcs",
          it.unit_price,
          lineTotal,
        ]
      );
    }
    await conn.query(
      `INSERT INTO po_edit_logs (po_id, edited_by, summary, changes)
       VALUES (?,?,?,?)`,
      [
        input.id,
        input.edited_by,
        summary.slice(0, 255),
        JSON.stringify({ before, after }),
      ]
    );
  });
}

/** Parse signed_doc_path: supports legacy single-path and new JSON array */
export function parseSignedDocs(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // legacy single path
  }
  return [raw];
}

export async function appendSignedDocs(id: number, newPaths: string[]) {
  const rows = await query<{ signed_doc_path: string | null }>(
    "SELECT signed_doc_path FROM purchase_orders WHERE id=?",
    [id]
  );
  const existing = parseSignedDocs(rows[0]?.signed_doc_path ?? null);
  const merged = [...existing, ...newPaths];
  await exec(
    "UPDATE purchase_orders SET signed_doc_path=?, signed_at=NOW(), status=CASE WHEN status IN ('delivered','checked','packed','confirmed') THEN 'received' ELSE status END WHERE id=?",
    [JSON.stringify(merged), id]
  );
}

export async function removeSignedDoc(id: number, pathToRemove: string) {
  const rows = await query<{ signed_doc_path: string | null }>(
    "SELECT signed_doc_path FROM purchase_orders WHERE id=?",
    [id]
  );
  const existing = parseSignedDocs(rows[0]?.signed_doc_path ?? null);
  const filtered = existing.filter((p) => p !== pathToRemove);
  await exec(
    "UPDATE purchase_orders SET signed_doc_path=? WHERE id=?",
    [filtered.length > 0 ? JSON.stringify(filtered) : null, id]
  );
}

export async function setSignedDoc(id: number, path: string) {
  await appendSignedDocs(id, [path]);
}
