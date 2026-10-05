import type { PoolConnection } from "mysql2/promise";
import { query, exec, withTx } from "../db";
import { getCustomerOutstanding, getEffectiveCreditLimit } from "./customers";
import { getActiveCreditNotesForCustomer, applyCreditNoteToPo } from "./customer-credit-notes";

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
  batch_id: number | null;
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
  doc_number: string | null;
  doc_reference: string | null;
  jda_job_id: string | null;
  jda_po_number: string | null;
  jda_synced_at: Date | null;
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
  return (await generatePoNumbers(1))[0];
}

// เลข PO รันต่อกัน count ใบ (ใช้กับใบเสนอราคาแบบกลุ่ม) — ส่ง conn มาเพื่อ lock ภายใน transaction
async function generatePoNumbers(
  count: number,
  conn?: PoolConnection
): Promise<string[]> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const sql = "SELECT COUNT(*) AS c FROM purchase_orders WHERE po_number LIKE ?";
  const rows = conn
    ? ((await conn.query(`${sql} FOR UPDATE`, [`PO${ym}-%`]))[0] as { c: number }[])
    : await query<{ c: number }>(sql, [`PO${ym}-%`]);
  const base = Number(rows[0]?.c || 0);
  return Array.from(
    { length: count },
    (_, i) => `PO${ym}-${String(base + i + 1).padStart(4, "0")}`
  );
}

export function invoiceNumberFromPo(po_number: string): string {
  return po_number.replace(/^PO/, "INV").replace(/^QT/, "INV");
}

export type DocRef = { doc_number?: string | null; doc_reference?: string | null };

const cleanDocRef = (d?: DocRef) => ({
  doc_number: d?.doc_number?.trim() || null,
  doc_reference: d?.doc_reference?.trim() || null,
});

export async function createPo(input: {
  customer_id: number;
  credit_term_days: number;
  notes?: string;
  items: PoItemInput[];
  created_by: number;
} & DocRef): Promise<{ id: number; po_number: string; total: number }> {
  if (!input.items.length) throw new Error("PO must have at least 1 item");

  // ลูกค้ากลุ่ม (7-11) ต้องกรอกเลขที่เอกสาร + อ้างอิงเอง
  const doc = cleanDocRef(input);
  const [cust] = await query<{ group_id: number | null }>(
    "SELECT group_id FROM customers WHERE id = ?",
    [input.customer_id]
  );
  if (cust?.group_id && (!doc.doc_number || !doc.doc_reference))
    throw new Error("ลูกค้ากลุ่มต้องกรอกเลขที่เอกสารและอ้างอิง");

  const subtotal = input.items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const total = subtotal;

  // ไม่ตรวจวงเงินตอนสร้าง (สถานะ draft) — ตรวจ/หักวงเงินตอน confirm ใน setPoStatus()

  const po_number = await generatePoNumber();

  return withTx((conn) =>
    insertDraftPo(conn, { ...input, ...doc, po_number, subtotal, total })
  );
}

async function insertDraftPo(
  conn: PoolConnection,
  input: {
    po_number: string;
    customer_id: number;
    credit_term_days: number;
    notes?: string;
    items: PoItemInput[];
    created_by: number;
    subtotal: number;
    total: number;
    log_note?: string;
    batch_id?: number;
    doc_number?: string | null;
    doc_reference?: string | null;
  }
): Promise<{ id: number; po_number: string; total: number }> {
  const { po_number, subtotal, total } = input;
  const [r] = await conn.query(
    `INSERT INTO purchase_orders
      (po_number, doc_number, doc_reference, customer_id, batch_id, status, payment_status,
       credit_term_days, subtotal, total, paid_amount, remaining_amount, notes, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', 'unpaid', ?, ?, ?, 0, ?, ?, ?)`,
    [
      po_number,
      input.doc_number ?? null,
      input.doc_reference ?? null,
      input.customer_id,
      input.batch_id ?? null,
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

  await conn.query(
    `INSERT INTO po_edit_logs (po_id, edited_by, summary, changes) VALUES (?,?,?,?)`,
    [
      poId,
      input.created_by,
      `เปิด PO ใหม่: ${po_number} (${input.items.length} รายการ, รวม ${total.toLocaleString()} บาท)${input.log_note ?? ""}`,
      JSON.stringify({ type: "create", po_number, total, items: input.items.length }),
    ]
  );

  return { id: poId, po_number, total };
}

// ใบเสนอราคาแบบกลุ่ม: สินค้าชุดเดียวกัน สร้าง 1 ใบต่อ 1 ร้าน เลขรันต่อกัน (สถานะ draft ไม่ตรวจวงเงิน)
export async function createGroupPos(input: {
  group_id: number;
  customer_ids: number[];
  /** เลขที่เอกสาร/อ้างอิง รายร้าน (key = customer_id) — บังคับกรอกทุกร้าน */
  docs: Record<number, DocRef>;
  notes?: string;
  items: PoItemInput[];
  created_by: number;
}): Promise<{ id: number; po_number: string; customer_id: number; total: number }[]> {
  if (!input.items.length) throw new Error("PO must have at least 1 item");
  const ids = [...new Set(input.customer_ids)];
  if (!ids.length) throw new Error("กรุณาเลือกร้านอย่างน้อย 1 ร้าน");
  const docs = new Map(ids.map((id) => [id, cleanDocRef(input.docs[id])]));
  if ([...docs.values()].some((d) => !d.doc_number || !d.doc_reference))
    throw new Error("กรุณากรอกเลขที่เอกสารและอ้างอิงให้ครบทุกร้าน");

  const subtotal = input.items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const total = subtotal;

  return withTx(async (conn) => {
    const [custRows] = await conn.query(
      `SELECT c.id, c.default_credit_term_days, g.name AS group_name
       FROM customers c JOIN customer_groups g ON g.id = c.group_id
       WHERE c.group_id = ? AND c.id IN (?)
       ORDER BY c.id`,
      [input.group_id, ids]
    );
    const customers = custRows as { id: number; default_credit_term_days: number | null; group_name: string }[];
    if (customers.length !== ids.length)
      throw new Error("มีร้านที่ไม่ได้อยู่ในกลุ่มลูกค้านี้");

    const numbers = await generatePoNumbers(customers.length, conn);
    const [b] = await conn.query(
      "INSERT INTO po_batches (group_id, created_by) VALUES (?, ?)",
      [input.group_id, input.created_by]
    );
    const batchId = (b as { insertId: number }).insertId;
    const logNote = ` [ใบเสนอราคากลุ่ม ${customers[0].group_name}: ${numbers[0]}–${numbers[numbers.length - 1]}]`;
    const created = [];
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      const po = await insertDraftPo(conn, {
        po_number: numbers[i],
        customer_id: c.id,
        credit_term_days: c.default_credit_term_days ?? 30,
        notes: input.notes,
        items: input.items,
        created_by: input.created_by,
        subtotal,
        total,
        log_note: logNote,
        batch_id: batchId,
        ...docs.get(c.id),
      });
      created.push({ ...po, customer_id: c.id });
    }
    return created;
  });
}

export type PoBatch = {
  id: number;
  group_id: number | null;
  group_name: string | null;
  created_at: Date;
  created_by_name: string | null;
  po_count: number;
  first_po: string;
  last_po: string;
  total: number;
  remaining: number;
  draft_count: number;
  cancelled_count: number;
};

// ชุดใบเสนอราคากลุ่ม (ใบที่สร้างพร้อมกัน) — หน้า /po แสดงเป็นก้อนเดียวแทน 50 แถว
export async function listPoBatches(): Promise<PoBatch[]> {
  return query<PoBatch>(
    `SELECT b.id, b.group_id, g.name AS group_name, b.created_at, u.full_name AS created_by_name,
            COUNT(po.id) AS po_count,
            MIN(po.po_number) AS first_po,
            MAX(po.po_number) AS last_po,
            COALESCE(SUM(CASE WHEN po.status <> 'cancelled' THEN po.total ELSE 0 END), 0) AS total,
            COALESCE(SUM(CASE WHEN po.status <> 'cancelled' THEN po.remaining_amount ELSE 0 END), 0) AS remaining,
            SUM(po.status = 'draft') AS draft_count,
            SUM(po.status = 'cancelled') AS cancelled_count
     FROM po_batches b
     JOIN purchase_orders po ON po.batch_id = b.id
     LEFT JOIN customer_groups g ON g.id = b.group_id
     LEFT JOIN users u ON u.id = b.created_by
     GROUP BY b.id
     ORDER BY b.created_at DESC`
  );
}

export async function listPos(filter?: {
  batch_id?: number;
  exclude_batched?: boolean;
  /** "none" = ลูกค้าเดี่ยว (ไม่มีกลุ่ม), ตัวเลข = group_id */
  group?: string;
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
  if (filter?.batch_id) {
    where.push("po.batch_id = ?");
    params.push(filter.batch_id);
  } else if (filter?.exclude_batched) {
    where.push("po.batch_id IS NULL");
  }
  if (filter?.customer_id) {
    where.push("po.customer_id = ?");
    params.push(filter.customer_id);
  }
  if (filter?.group === "none") {
    where.push("c.group_id IS NULL");
  } else if (filter?.group) {
    where.push("c.group_id = ?");
    params.push(Number(filter.group));
  }
  if (filter?.customer_name) {
    where.push("c.name LIKE ?");
    params.push(`%${filter.customer_name}%`);
  }
  if (filter?.po_number) {
    where.push("(po.po_number LIKE ? OR po.doc_number LIKE ? OR po.doc_reference LIKE ?)");
    params.push(`%${filter.po_number}%`, `%${filter.po_number}%`, `%${filter.po_number}%`);
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
  const needCustomerJoin = filter?.customer_name || filter?.group;
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
               ORDER BY ${filter?.batch_id ? "po.po_number ASC" : "po.created_at DESC, po.id DESC"}
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

/**
 * เรียกตอน Quotation ออกจากสถานะ draft (เช่น confirm) — ตรวจวงเงินลูกค้า
 * แล้วหักเครดิตโน๊ตที่มี (เก่าสุดก่อน) ออกจากยอดค้างของ PO นี้
 */
async function reserveCreditOnConfirm(po: PurchaseOrder, userId: number) {
  const { effective_limit, base_limit, temp_extra } = await getEffectiveCreditLimit(po.customer_id);
  const creditNotes = await getActiveCreditNotesForCustomer(po.customer_id);

  await withTx(async (conn) => {
    // lock ลูกค้า กัน confirm พร้อมกันหลายใบแล้วเกินวงเงิน
    await conn.query("SELECT id FROM customers WHERE id = ? FOR UPDATE", [po.customer_id]);

    const [outRows] = (await conn.query(
      `SELECT COALESCE(SUM(remaining_amount),0) AS s
       FROM purchase_orders
       WHERE customer_id = ? AND status NOT IN ('cancelled','draft') AND id <> ?`,
      [po.customer_id, po.id]
    )) as unknown as [{ s: number }[]];
    const outstanding = Number(outRows[0]?.s ?? 0);
    const [poRows] = (await conn.query(
      "SELECT remaining_amount FROM purchase_orders WHERE id = ? FOR UPDATE",
      [po.id]
    )) as unknown as [{ remaining_amount: number }[]];
    const remaining = Number(poRows[0]?.remaining_amount ?? 0);

    const creditNotesBalance = creditNotes.reduce((sum, cn) => sum + (cn.remaining || 0), 0);
    const totalAvailableCredit = effective_limit + creditNotesBalance;

    if (outstanding + remaining > totalAvailableCredit) {
      const limitDesc = temp_extra > 0
        ? `${base_limit.toLocaleString()} + วงเงินชั่วคราว ${temp_extra.toLocaleString()} + เครดิตโน๊ต ${creditNotesBalance.toLocaleString()} = ${totalAvailableCredit.toLocaleString()}`
        : `${effective_limit.toLocaleString()} + เครดิตโน๊ต ${creditNotesBalance.toLocaleString()} = ${totalAvailableCredit.toLocaleString()}`;
      throw new Error(
        `เกินวงเงินสินเชื่อ ไม่สามารถยืนยันได้: ลูกค้ามีหนี้คงค้าง ${outstanding.toLocaleString()} + ${po.po_number} ${remaining.toLocaleString()} > วงเงินรวม ${limitDesc}`
      );
    }

    // เคยใช้เครดิตโน๊ตกับ PO นี้แล้ว (เช่น draft เก่าก่อนเปลี่ยน flow) → ไม่ใช้ซ้ำ
    const [used] = (await conn.query(
      "SELECT COUNT(*) AS c FROM customer_credit_note_usages WHERE po_id = ?",
      [po.id]
    )) as unknown as [{ c: number }[]];
    if (Number(used[0]?.c) > 0) return;

    let remainingToCover = remaining;
    let creditNotesApplied = 0;
    for (const cn of creditNotes) {
      if (remainingToCover <= 0) break;
      const available = cn.remaining || 0;
      if (available <= 0) continue;
      const amountToApply = Math.min(available, remainingToCover);

      await conn.query(
        `INSERT INTO customer_credit_note_usages
           (ccn_id, po_id, amount_used, usage_type, notes, created_by)
         VALUES (?, ?, ?, 'applied_to_po', ?, ?)`,
        [cn.id, po.id, amountToApply, `ใช้เครดิตโน๊ต ${cn.ccn_number} กับ ${po.po_number}`, userId]
      );
      const newUsed = cn.used_amount + amountToApply;
      const newStatus = newUsed >= cn.amount ? "used" : "active";
      await conn.query(
        `UPDATE customer_credit_notes SET used_amount = ?, status = ? WHERE id = ?`,
        [newUsed, newStatus, cn.id]
      );
      remainingToCover -= amountToApply;
      creditNotesApplied += amountToApply;
    }

    if (creditNotesApplied > 0) {
      await conn.query(
        `UPDATE purchase_orders SET remaining_amount = remaining_amount - ? WHERE id = ?`,
        [creditNotesApplied, po.id]
      );
      await conn.query(
        `INSERT INTO po_edit_logs (po_id, edited_by, summary, changes) VALUES (?,?,?,?)`,
        [
          po.id,
          userId,
          `ใช้เครดิตโน๊ต ${creditNotesApplied.toLocaleString()} บาท ตอนยืนยัน`,
          JSON.stringify({ type: "credit_notes_applied", credit_notes_applied: creditNotesApplied }),
        ]
      );
    }
  });
}

export async function setPoStatus(
  id: number,
  status: PurchaseOrder["status"],
  opts?: { tax_invoice_number?: string; edited_by?: number }
) {
  const existing = await query<PurchaseOrder>("SELECT * FROM purchase_orders WHERE id=?", [id]);
  const before = existing[0];
  if (!before) throw new Error("ไม่พบ PO");

  // ออกจาก draft → เริ่มกินวงเงิน: ตรวจวงเงิน + ใช้เครดิตโน๊ตตอนนี้
  if (before.status === "draft" && status !== "draft" && status !== "cancelled") {
    await reserveCreditOnConfirm(before, opts?.edited_by ?? before.created_by);
  }

  if (status === "received" || status === "delivered") {
    await exec(
      `UPDATE purchase_orders
       SET status=?,
           tax_invoice_number = COALESCE(?, tax_invoice_number),
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

// แก้เลขที่เอกสาร/อ้างอิงที่กรอกเอง (ลูกค้ากลุ่ม)
export async function setPoDocRef(
  id: number,
  input: DocRef,
  edited_by: number
): Promise<void> {
  const existing = await query<PurchaseOrder>("SELECT * FROM purchase_orders WHERE id=?", [id]);
  const before = existing[0];
  if (!before) throw new Error("ไม่พบ PO");
  const doc = cleanDocRef(input);
  if (!doc.doc_number || !doc.doc_reference)
    throw new Error("กรุณากรอกเลขที่เอกสารและอ้างอิง");
  await exec("UPDATE purchase_orders SET doc_number=?, doc_reference=? WHERE id=?", [
    doc.doc_number,
    doc.doc_reference,
    id,
  ]);
  await exec(
    `INSERT INTO po_edit_logs (po_id, edited_by, summary, changes) VALUES (?,?,?,?)`,
    [
      id,
      edited_by,
      `แก้ไขเลขที่เอกสาร/อ้างอิง: ${before.doc_number ?? "(ว่าง)"} / ${before.doc_reference ?? "(ว่าง)"} → ${doc.doc_number} / ${doc.doc_reference}`.slice(0, 255),
      JSON.stringify({
        before: { doc_number: before.doc_number, doc_reference: before.doc_reference },
        after: doc,
      }),
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
  // draft ยังไม่กินวงเงิน — ไปตรวจตอน confirm
  if (existing.po.status !== "draft" && effLimit !== undefined) {
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
