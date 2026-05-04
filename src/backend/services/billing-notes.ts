import { query, exec, withTx } from "../db";

export type BillingNote = {
  id: number;
  bn_number: string;
  customer_id: number;
  customer_name?: string;
  issued_date: string;
  due_date: string | null;
  notes: string | null;
  created_by: number;
  creator_name?: string;
  created_at: string;
  total_amount?: number;
};

export type BillingNoteItem = {
  id: number;
  billing_note_id: number;
  po_id: number;
  po_number: string;
  po_date: string;
  tax_invoice_number: string | null;
  amount: number;
};

export type CreateBillingNoteInput = {
  customer_id: number;
  issued_date: string;
  due_date?: string;
  notes?: string;
  created_by: number;
  items: {
    po_id: number;
    po_number: string;
    po_date: string;
    tax_invoice_number: string | null;
    amount: number;
  }[];
};

async function generateBnNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `BN${yy}${mm}-`;
  const rows = await query<{ bn_number: string }>(
    `SELECT bn_number FROM billing_notes WHERE bn_number LIKE ? ORDER BY bn_number DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const last = rows[0]?.bn_number;
  const seq = last ? parseInt(last.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function listBillingNotes(customer_id: number): Promise<BillingNote[]> {
  return query<BillingNote>(
    `SELECT bn.*, c.name AS customer_name, u.full_name AS creator_name,
       COALESCE((SELECT SUM(bni.amount) FROM billing_note_items bni WHERE bni.billing_note_id = bn.id), 0) AS total_amount
     FROM billing_notes bn
     JOIN customers c ON c.id = bn.customer_id
     JOIN users u ON u.id = bn.created_by
     WHERE bn.customer_id = ?
     ORDER BY bn.created_at DESC`,
    [customer_id]
  );
}

export async function getBillingNote(id: number): Promise<(BillingNote & { items: BillingNoteItem[] }) | null> {
  const rows = await query<BillingNote>(
    `SELECT bn.*, c.name AS customer_name, u.full_name AS creator_name,
       COALESCE((SELECT SUM(bni.amount) FROM billing_note_items bni WHERE bni.billing_note_id = bn.id), 0) AS total_amount
     FROM billing_notes bn
     JOIN customers c ON c.id = bn.customer_id
     JOIN users u ON u.id = bn.created_by
     WHERE bn.id = ?`,
    [id]
  );
  if (!rows[0]) return null;
  const items = await query<BillingNoteItem>(
    `SELECT * FROM billing_note_items WHERE billing_note_id = ? ORDER BY id`,
    [id]
  );
  return { ...rows[0], items };
}

export async function createBillingNote(input: CreateBillingNoteInput): Promise<number> {
  if (!input.items.length) throw new Error("ต้องมี PO อย่างน้อย 1 ใบ");
  const bn_number = await generateBnNumber();
  return withTx(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO billing_notes (bn_number, customer_id, issued_date, due_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [bn_number, input.customer_id, input.issued_date, input.due_date || null, input.notes || null, input.created_by]
    ) as unknown as [{ insertId: number }];
    const bnId = r.insertId;
    for (const it of input.items) {
      await conn.query(
        `INSERT INTO billing_note_items (billing_note_id, po_id, po_number, po_date, tax_invoice_number, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bnId, it.po_id, it.po_number, it.po_date, it.tax_invoice_number || null, it.amount]
      );
    }
    return bnId;
  });
}
