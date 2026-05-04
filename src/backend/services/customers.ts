import { query, exec, withTx } from "../db";

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
  outstanding: number;
  credit_used: number;
  credit_available: number; // based on effective (base + temp) limit
  effective_limit: number;  // base + active temp credit (if any today)
  temp_extra: number;       // 0 if no active temp credit
  total_pos: number;
  open_pos: number;
};

const CUSTOMER_SELECT = `
  SELECT c.*,
    COALESCE(SUM(po.remaining_amount),0) AS outstanding,
    COALESCE(SUM(po.remaining_amount),0) AS credit_used,
    COALESCE((
      SELECT t.extra_amount FROM temp_credit_limits t
      WHERE t.customer_id = c.id AND t.is_active = 1
        AND CURDATE() BETWEEN t.start_date AND t.end_date
      ORDER BY t.extra_amount DESC LIMIT 1
    ), 0) AS temp_extra,
    (c.credit_limit + COALESCE((
      SELECT t.extra_amount FROM temp_credit_limits t
      WHERE t.customer_id = c.id AND t.is_active = 1
        AND CURDATE() BETWEEN t.start_date AND t.end_date
      ORDER BY t.extra_amount DESC LIMIT 1
    ), 0)) AS effective_limit,
    (c.credit_limit + COALESCE((
      SELECT t.extra_amount FROM temp_credit_limits t
      WHERE t.customer_id = c.id AND t.is_active = 1
        AND CURDATE() BETWEEN t.start_date AND t.end_date
      ORDER BY t.extra_amount DESC LIMIT 1
    ), 0) - COALESCE(SUM(po.remaining_amount),0)) AS credit_available,
    COUNT(po.id) AS total_pos,
    SUM(CASE WHEN po.payment_status <> 'paid' AND po.status <> 'cancelled' THEN 1 ELSE 0 END) AS open_pos
  FROM customers c
  LEFT JOIN purchase_orders po
    ON po.customer_id = c.id AND po.status <> 'cancelled'`;

export async function listCustomers(): Promise<CustomerWithCredit[]> {
  return query<CustomerWithCredit>(
    `${CUSTOMER_SELECT}
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );
}

export async function getCustomer(id: number): Promise<CustomerWithCredit | null> {
  const rows = await query<CustomerWithCredit>(
    `${CUSTOMER_SELECT}
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

// ─── Customer Files ──────────────────────────────────────────────────────────

export type CustomerFile = {
  id: number;
  customer_id: number;
  original_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: number;
  uploader_name: string;
  created_at: Date;
};

export async function listCustomerFiles(customerId: number): Promise<CustomerFile[]> {
  return query<CustomerFile>(
    `SELECT f.*, u.full_name AS uploader_name
     FROM customer_files f
     JOIN users u ON u.id = f.uploaded_by
     WHERE f.customer_id = ?
     ORDER BY f.created_at DESC`,
    [customerId]
  );
}

export async function addCustomerFile(input: {
  customer_id: number;
  original_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: number;
}): Promise<number> {
  const res = await exec(
    `INSERT INTO customer_files
       (customer_id, original_name, file_path, mime_type, file_size, uploaded_by)
     VALUES (?,?,?,?,?,?)`,
    [input.customer_id, input.original_name, input.file_path, input.mime_type, input.file_size, input.uploaded_by]
  );
  return res.insertId;
}

export async function deleteCustomerFile(id: number): Promise<void> {
  await exec("DELETE FROM customer_files WHERE id = ?", [id]);
}

// ─── Customer Edit Logs ───────────────────────────────────────────────────────

export type CustomerEditLog = {
  id: number;
  customer_id: number;
  edited_by: number;
  editor_name: string;
  summary: string;
  changes: string;
  created_at: Date;
};

export async function listCustomerEditLogs(customerId: number): Promise<CustomerEditLog[]> {
  return query<CustomerEditLog>(
    `SELECT l.*, u.full_name AS editor_name
     FROM customer_edit_logs l
     JOIN users u ON u.id = l.edited_by
     WHERE l.customer_id = ?
     ORDER BY l.created_at DESC`,
    [customerId]
  );
}

/**
 * Update customer fields with audit log. Credit limit changes are NOT done here —
 * use adjustCreditLimit() instead.
 */
export async function updateCustomerWithLog(
  id: number,
  input: Partial<{
    code: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
    tax_id: string;
    address: string;
    credit_score: number | null;
    credit_score_notes: string | null;
    default_credit_term_days: number;
    notes: string;
  }>,
  editedBy: number
): Promise<void> {
  const existing = await query<Customer>(
    "SELECT * FROM customers WHERE id = ?",
    [id]
  );
  if (!existing[0]) throw new Error("ไม่พบลูกค้า");

  const before = existing[0];
  const fields = Object.keys(input) as (keyof typeof input)[];
  if (fields.length === 0) return;

  const set = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (input as Record<string, unknown>)[f]);
  await exec(`UPDATE customers SET ${set} WHERE id = ?`, [...values, id]);

  const summaryParts: string[] = [];
  if (input.name && input.name !== before.name)
    summaryParts.push(`ชื่อ: ${before.name} → ${input.name}`);
  if (input.phone !== undefined && input.phone !== before.phone)
    summaryParts.push("แก้ไขโทรศัพท์");
  if (input.email !== undefined && input.email !== before.email)
    summaryParts.push("แก้ไข Email");
  if (input.address !== undefined && input.address !== before.address)
    summaryParts.push("แก้ไขที่อยู่");
  if (input.credit_score !== undefined && input.credit_score !== before.credit_score)
    summaryParts.push(`Credit Score: ${before.credit_score ?? "—"} → ${input.credit_score ?? "—"}`);
  if (input.default_credit_term_days !== undefined && input.default_credit_term_days !== before.default_credit_term_days)
    summaryParts.push(`เครดิต: ${before.default_credit_term_days} → ${input.default_credit_term_days} วัน`);
  const summary = summaryParts.length ? summaryParts.join(", ") : "แก้ไขข้อมูลลูกค้า";

  const after = { ...before, ...input };
  await exec(
    `INSERT INTO customer_edit_logs (customer_id, edited_by, summary, changes)
     VALUES (?,?,?,?)`,
    [id, editedBy, summary.slice(0, 255), JSON.stringify({ before, after })]
  );
}

// ─── Credit Limit Adjustments ─────────────────────────────────────────────────

export type CreditLimitAdjustment = {
  id: number;
  customer_id: number;
  adjusted_by: number;
  adjuster_name: string;
  delta: number;
  new_limit: number;
  reason: string | null;
  created_at: Date;
};

export async function listCreditAdjustments(customerId: number): Promise<CreditLimitAdjustment[]> {
  return query<CreditLimitAdjustment>(
    `SELECT a.*, u.full_name AS adjuster_name
     FROM credit_limit_adjustments a
     JOIN users u ON u.id = a.adjusted_by
     WHERE a.customer_id = ?
     ORDER BY a.created_at DESC`,
    [customerId]
  );
}

export async function adjustCreditLimit(
  customerId: number,
  delta: number,
  adjustedBy: number,
  reason?: string
): Promise<number> {
  return withTx(async (conn) => {
    const [rows] = (await conn.query(
      "SELECT id, credit_limit, name FROM customers WHERE id = ? FOR UPDATE",
      [customerId]
    )) as unknown as [{id: number; credit_limit: number; name: string}[]];
    const cust = rows[0];
    if (!cust) throw new Error("ไม่พบลูกค้า");
    const newLimit = Number(cust.credit_limit) + delta;
    if (newLimit < 0) throw new Error("วงเงินใหม่ไม่สามารถเป็นลบได้");
    await conn.query("UPDATE customers SET credit_limit = ? WHERE id = ?", [newLimit, customerId]);
    await conn.query(
      `INSERT INTO credit_limit_adjustments (customer_id, adjusted_by, delta, new_limit, reason)
       VALUES (?,?,?,?,?)`,
      [customerId, adjustedBy, delta, newLimit, reason || null]
    );
    await conn.query(
      `INSERT INTO customer_edit_logs (customer_id, edited_by, summary, changes)
       VALUES (?,?,?,?)`,
      [
        customerId,
        adjustedBy,
        `ปรับวงเงิน ${delta >= 0 ? "+" : ""}${Number(delta).toLocaleString()} → ${Number(newLimit).toLocaleString()} บาท`,
        JSON.stringify({ type: "credit_limit_adjustment", delta, old_limit: Number(cust.credit_limit), new_limit: newLimit, reason: reason || null }),
      ]
    );
    return newLimit;
  });
}

// ─── Temporary Credit Limits ──────────────────────────────────────────────────

export type TempCreditLimit = {
  id: number;
  customer_id: number;
  extra_amount: number;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_by: number;
  creator_name: string;
  is_active: number;
  created_at: Date;
};

export async function listTempCreditLimits(customerId: number): Promise<TempCreditLimit[]> {
  return query<TempCreditLimit>(
    `SELECT t.*, u.full_name AS creator_name
     FROM temp_credit_limits t
     JOIN users u ON u.id = t.created_by
     WHERE t.customer_id = ?
     ORDER BY t.created_at DESC`,
    [customerId]
  );
}

/** Returns the active temp credit for today, or null */
export async function getActiveTempCredit(customerId: number): Promise<TempCreditLimit | null> {
  const rows = await query<TempCreditLimit>(
    `SELECT t.*, u.full_name AS creator_name
     FROM temp_credit_limits t
     JOIN users u ON u.id = t.created_by
     WHERE t.customer_id = ? AND t.is_active = 1
       AND CURDATE() BETWEEN t.start_date AND t.end_date
     ORDER BY t.extra_amount DESC
     LIMIT 1`,
    [customerId]
  );
  return rows[0] ?? null;
}

export async function createTempCreditLimit(input: {
  customer_id: number;
  extra_amount: number;
  start_date: string;
  end_date: string;
  reason?: string;
  created_by: number;
}): Promise<number> {
  const res = await exec(
    `INSERT INTO temp_credit_limits
       (customer_id, extra_amount, start_date, end_date, reason, created_by)
     VALUES (?,?,?,?,?,?)`,
    [input.customer_id, input.extra_amount, input.start_date, input.end_date, input.reason || null, input.created_by]
  );
  await exec(
    `INSERT INTO customer_edit_logs (customer_id, edited_by, summary, changes)
     VALUES (?,?,?,?)`,
    [
      input.customer_id,
      input.created_by,
      `อนุมัติวงเงินชั่วคราว +${Number(input.extra_amount).toLocaleString()} บาท (${input.start_date} ถึง ${input.end_date})`,
      JSON.stringify({ type: "temp_credit_limit", ...input }),
    ]
  );
  return res.insertId;
}

export async function deactivateTempCreditLimit(id: number): Promise<void> {
  await exec("UPDATE temp_credit_limits SET is_active = 0 WHERE id = ?", [id]);
}

/** Effective credit limit = base + active temp (if any) */
export async function getEffectiveCreditLimit(customerId: number): Promise<{
  base_limit: number;
  temp_extra: number;
  effective_limit: number;
  temp_credit: TempCreditLimit | null;
}> {
  const rows = await query<{ credit_limit: number }>(
    "SELECT credit_limit FROM customers WHERE id = ?",
    [customerId]
  );
  const base = Number(rows[0]?.credit_limit ?? 0);
  const temp = await getActiveTempCredit(customerId);
  const extra = temp ? Number(temp.extra_amount) : 0;
  return {
    base_limit: base,
    temp_extra: extra,
    effective_limit: base + extra,
    temp_credit: temp,
  };
}
