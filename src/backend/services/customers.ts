import { query, exec } from "../db";

export type Customer = {
  id: number;
  code: string | null;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  address: string | null;
  credit_limit: number;
  credit_score: number | null;
  credit_score_notes: string | null;
  default_credit_term_days: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CustomerWithCredit = Customer & {
  outstanding: number; // total remaining (unpaid) across all PO
  credit_used: number; // outstanding (alias)
  credit_available: number; // credit_limit - outstanding
  total_pos: number;
  open_pos: number;
};

export async function listCustomers(): Promise<CustomerWithCredit[]> {
  return query<CustomerWithCredit>(
    `SELECT c.*,
       COALESCE(SUM(po.remaining_amount),0) AS outstanding,
       COALESCE(SUM(po.remaining_amount),0) AS credit_used,
       (c.credit_limit - COALESCE(SUM(po.remaining_amount),0)) AS credit_available,
       COUNT(po.id) AS total_pos,
       SUM(CASE WHEN po.payment_status <> 'paid' AND po.status <> 'cancelled' THEN 1 ELSE 0 END) AS open_pos
     FROM customers c
     LEFT JOIN purchase_orders po
       ON po.customer_id = c.id AND po.status <> 'cancelled'
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );
}

export async function getCustomer(id: number): Promise<CustomerWithCredit | null> {
  const rows = await query<CustomerWithCredit>(
    `SELECT c.*,
       COALESCE(SUM(po.remaining_amount),0) AS outstanding,
       COALESCE(SUM(po.remaining_amount),0) AS credit_used,
       (c.credit_limit - COALESCE(SUM(po.remaining_amount),0)) AS credit_available,
       COUNT(po.id) AS total_pos,
       SUM(CASE WHEN po.payment_status <> 'paid' AND po.status <> 'cancelled' THEN 1 ELSE 0 END) AS open_pos
     FROM customers c
     LEFT JOIN purchase_orders po
       ON po.customer_id = c.id AND po.status <> 'cancelled'
     WHERE c.id = ?
     GROUP BY c.id`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createCustomer(input: {
  code?: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  address?: string;
  credit_limit: number;
  credit_score?: number | null;
  credit_score_notes?: string | null;
  default_credit_term_days?: number;
  notes?: string;
}): Promise<number> {
  const res = await exec(
    `INSERT INTO customers
       (code, name, contact_person, phone, email, tax_id, address,
        credit_limit, credit_score, credit_score_notes, default_credit_term_days, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.code || null,
      input.name,
      input.contact_person || null,
      input.phone || null,
      input.email || null,
      input.tax_id || null,
      input.address || null,
      input.credit_limit,
      input.credit_score ?? null,
      input.credit_score_notes ?? null,
      input.default_credit_term_days ?? 30,
      input.notes || null,
    ]
  );
  return res.insertId;
}

export async function updateCustomer(
  id: number,
  input: Partial<{
    code: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
    tax_id: string;
    address: string;
    credit_limit: number;
    credit_score: number | null;
    credit_score_notes: string | null;
    default_credit_term_days: number;
    notes: string;
  }>
) {
  const fields = Object.keys(input);
  if (fields.length === 0) return;
  const set = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (input as Record<string, unknown>)[f]);
  await exec(`UPDATE customers SET ${set} WHERE id = ?`, [...values, id]);
}

export async function getCustomerOutstanding(id: number): Promise<number> {
  const rows = await query<{ s: number }>(
    `SELECT COALESCE(SUM(remaining_amount),0) AS s
     FROM purchase_orders
     WHERE customer_id = ? AND status <> 'cancelled'`,
    [id]
  );
  return Number(rows[0]?.s ?? 0);
}
