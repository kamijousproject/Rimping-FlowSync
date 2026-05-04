import { query, withTx } from "@/backend/db";

export type CreditNote = {
  id: number;
  cn_number: string;
  po_id: number;
  customer_id: number;
  created_by: number;
  reason: string | null;
  total_original: number;
  total_new: number;
  total_diff: number;
  status: "active" | "voided";
  created_at: string;
  updated_at: string;
  creator_name?: string;
};

export type CreditNoteItem = {
  id: number;
  credit_note_id: number;
  po_item_id: number;
  product_name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  original_price: number;
  new_price: number;
  diff_amount: number;
};

export type CreditNoteLog = {
  id: number;
  credit_note_id: number;
  action: "created" | "updated" | "voided";
  performed_by: number;
  performer_name?: string;
  summary: string | null;
  changes: string | null;
  created_at: string;
};

async function generateCnNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `CN${yy}${mm}-`;
  const [row] = await query<{ last: string | null }>(
    `SELECT MAX(cn_number) AS last FROM credit_notes WHERE cn_number LIKE ?`,
    [`${prefix}%`]
  );
  const lastSeq = row?.last ? parseInt(row.last.split("-")[1] || "0", 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

export type CreateCreditNoteInput = {
  po_id: number;
  customer_id: number;
  created_by: number;
  reason?: string;
  items: {
    po_item_id: number;
    product_name: string;
    description?: string;
    quantity: number;
    unit?: string;
    original_price: number;
    new_price: number;
  }[];
};

export async function createCreditNote(input: CreateCreditNoteInput): Promise<CreditNote> {
  const [poRow] = await query<{ status: string }>(
    "SELECT status FROM purchase_orders WHERE id = ?",
    [input.po_id]
  );
  if (!poRow) throw new Error("ไม่พบ PO");
  if (poRow.status !== "received") throw new Error("สามารถสร้างใบลดหนี้ได้เฉพาะ PO ที่อยู่ใน status received เท่านั้น");

  const [existing] = await query<{ id: number }>(
    "SELECT id FROM credit_notes WHERE po_id = ? AND status = 'active' LIMIT 1",
    [input.po_id]
  );
  if (existing) throw new Error("PO นี้มีใบลดหนี้ที่ใช้งานอยู่แล้ว ไม่สามารถสร้างเพิ่มได้");

  const cn_number = await generateCnNumber();
  const totalOriginal = input.items.reduce((s, it) => s + it.original_price * it.quantity, 0);
  const totalNew = input.items.reduce((s, it) => s + it.new_price * it.quantity, 0);
  const totalDiff = +(totalOriginal - totalNew).toFixed(2);

  return withTx(async (conn) => {
    const [res] = await conn.query(
      `INSERT INTO credit_notes (cn_number, po_id, customer_id, created_by, reason, total_original, total_new, total_diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cn_number, input.po_id, input.customer_id, input.created_by,
       input.reason || null, totalOriginal, totalNew, totalDiff]
    );
    const cnId = (res as { insertId: number }).insertId;

    for (const it of input.items) {
      const diff = +((it.original_price - it.new_price) * it.quantity).toFixed(2);
      await conn.query(
        `INSERT INTO credit_note_items
           (credit_note_id, po_item_id, product_name, description, quantity, unit, original_price, new_price, diff_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cnId, it.po_item_id, it.product_name, it.description || null,
         it.quantity, it.unit || null, it.original_price, it.new_price, diff]
      );
    }

    await conn.query(
      `INSERT INTO credit_note_logs (credit_note_id, action, performed_by, summary)
       VALUES (?, 'created', ?, ?)`,
      [cnId, input.created_by, `สร้างใบลดหนี้ ${cn_number} ส่วนต่าง ${totalDiff} บาท`]
    );

    const [cn] = await query<CreditNote>("SELECT * FROM credit_notes WHERE id = ?", [cnId]);
    return cn;
  });
}

export async function listCreditNotes(po_id: number): Promise<(CreditNote & { items: CreditNoteItem[] })[]> {
  const notes = await query<CreditNote & { creator_name: string }>(
    `SELECT cn.*, u.full_name AS creator_name
     FROM credit_notes cn
     LEFT JOIN users u ON u.id = cn.created_by
     WHERE cn.po_id = ?
     ORDER BY cn.created_at DESC`,
    [po_id]
  );
  const result: (CreditNote & { items: CreditNoteItem[] })[] = [];
  for (const cn of notes) {
    const items = await query<CreditNoteItem>(
      "SELECT * FROM credit_note_items WHERE credit_note_id = ?",
      [cn.id]
    );
    result.push({ ...cn, items });
  }
  return result;
}

export async function getCreditNote(id: number): Promise<(CreditNote & { items: CreditNoteItem[]; logs: CreditNoteLog[] }) | null> {
  const [cn] = await query<CreditNote & { creator_name: string }>(
    `SELECT cn.*, u.full_name AS creator_name
     FROM credit_notes cn
     LEFT JOIN users u ON u.id = cn.created_by
     WHERE cn.id = ?`,
    [id]
  );
  if (!cn) return null;
  const [items, logs] = await Promise.all([
    query<CreditNoteItem>("SELECT * FROM credit_note_items WHERE credit_note_id = ?", [id]),
    query<CreditNoteLog>(
      `SELECT cnl.*, u.full_name AS performer_name
       FROM credit_note_logs cnl
       LEFT JOIN users u ON u.id = cnl.performed_by
       WHERE cnl.credit_note_id = ?
       ORDER BY cnl.created_at DESC`,
      [id]
    ),
  ]);
  return { ...cn, items, logs };
}

export type UpdateCreditNoteInput = {
  reason?: string;
  items: {
    po_item_id: number;
    product_name: string;
    description?: string;
    quantity: number;
    unit?: string;
    original_price: number;
    new_price: number;
  }[];
  updated_by: number;
};

export async function updateCreditNote(id: number, input: UpdateCreditNoteInput): Promise<CreditNote> {
  const [existing] = await query<{ status: string; cn_number: string; total_diff: number; po_id: number }>(
    "SELECT status, cn_number, total_diff, po_id FROM credit_notes WHERE id = ?",
    [id]
  );
  if (!existing) throw new Error("ไม่พบใบลดหนี้");
  if (existing.status === "voided") throw new Error("ไม่สามารถแก้ไขใบลดหนี้ที่ถูกยกเลิกแล้ว");

  const totalOriginal = input.items.reduce((s, it) => s + it.original_price * it.quantity, 0);
  const totalNew = input.items.reduce((s, it) => s + it.new_price * it.quantity, 0);
  const totalDiff = +(totalOriginal - totalNew).toFixed(2);

  return withTx(async (conn) => {
    await conn.query("DELETE FROM credit_note_items WHERE credit_note_id = ?", [id]);
    for (const it of input.items) {
      const diff = +((it.original_price - it.new_price) * it.quantity).toFixed(2);
      await conn.query(
        `INSERT INTO credit_note_items
           (credit_note_id, po_item_id, product_name, description, quantity, unit, original_price, new_price, diff_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, it.po_item_id, it.product_name, it.description || null,
         it.quantity, it.unit || null, it.original_price, it.new_price, diff]
      );
    }
    await conn.query(
      `UPDATE credit_notes SET reason=?, total_original=?, total_new=?, total_diff=? WHERE id=?`,
      [input.reason || null, totalOriginal, totalNew, totalDiff, id]
    );
    await conn.query(
      `INSERT INTO credit_note_logs (credit_note_id, action, performed_by, summary)
       VALUES (?, 'updated', ?, ?)`,
      [id, input.updated_by, `แก้ไขใบลดหนี้ ${existing.cn_number} ส่วนต่างใหม่ ${totalDiff} บาท`]
    );
    const [cn] = await query<CreditNote>("SELECT * FROM credit_notes WHERE id = ?", [id]);
    return cn;
  });
}

export async function listCreditNoteLogs(po_id: number): Promise<(CreditNoteLog & { cn_number: string })[]> {
  return query<CreditNoteLog & { cn_number: string }>(
    `SELECT cnl.*, u.full_name AS performer_name, cn.cn_number
     FROM credit_note_logs cnl
     JOIN credit_notes cn ON cn.id = cnl.credit_note_id
     LEFT JOIN users u ON u.id = cnl.performed_by
     WHERE cn.po_id = ?
     ORDER BY cnl.created_at DESC`,
    [po_id]
  );
}

export async function voidCreditNote(id: number, performed_by: number): Promise<void> {
  const [existing] = await query<{ status: string; cn_number: string; total_diff: number; po_id: number }>(
    "SELECT status, cn_number, total_diff, po_id FROM credit_notes WHERE id = ?",
    [id]
  );
  if (!existing) throw new Error("ไม่พบใบลดหนี้");
  if (existing.status === "voided") throw new Error("ใบลดหนี้นี้ถูกยกเลิกไปแล้ว");

  await withTx(async (conn) => {
    await conn.query("UPDATE credit_notes SET status='voided' WHERE id=?", [id]);
    await conn.query(
      `INSERT INTO credit_note_logs (credit_note_id, action, performed_by, summary)
       VALUES (?, 'voided', ?, ?)`,
      [id, performed_by, `ยกเลิกใบลดหนี้ ${existing.cn_number}`]
    );
  });
}
