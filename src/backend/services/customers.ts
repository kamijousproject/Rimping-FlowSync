import { query, exec, withTx } from "../db";
import { sendLineNotification } from "./notifications";

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
  billing_note_due_days: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CustomerWithCredit = Customer & {
  outstanding: number;
  credit_used: number;
  credit_available: number; // based on effective (base + temp) limit + credit notes
  effective_limit: number;  // base + active temp credit (if any today)
  temp_extra: number;       // 0 if no active temp credit
  credit_notes_balance: number; // available credit from overpayments
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
    COALESCE((
      SELECT SUM(ccn.amount - ccn.used_amount) 
      FROM customer_credit_notes ccn 
      WHERE ccn.customer_id = c.id 
        AND ccn.status = 'active' 
        AND (ccn.expires_at IS NULL OR ccn.expires_at >= CURDATE())
    ), 0) AS credit_notes_balance,
    (c.credit_limit + COALESCE((
      SELECT t.extra_amount FROM temp_credit_limits t
      WHERE t.customer_id = c.id AND t.is_active = 1
        AND CURDATE() BETWEEN t.start_date AND t.end_date
      ORDER BY t.extra_amount DESC LIMIT 1
    ), 0) - COALESCE(SUM(po.remaining_amount),0) + COALESCE((
      SELECT SUM(ccn.amount - ccn.used_amount) 
      FROM customer_credit_notes ccn 
      WHERE ccn.customer_id = c.id 
        AND ccn.status = 'active' 
        AND (ccn.expires_at IS NULL OR ccn.expires_at >= CURDATE())
    ), 0)) AS credit_available,
    COUNT(po.id) AS total_pos,
    SUM(CASE WHEN po.payment_status <> 'paid' AND po.status <> 'cancelled' THEN 1 ELSE 0 END) AS open_pos
  FROM customers c
  LEFT JOIN purchase_orders po
    ON po.customer_id = c.id AND po.status <> 'cancelled'`;

export async function listCustomers(search?: string): Promise<CustomerWithCredit[]> {
  const where = search
    ? `WHERE (c.name LIKE ? OR c.code LIKE ? OR c.contact_person LIKE ?)`
    : "";
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
  return query<CustomerWithCredit>(
    `${CUSTOMER_SELECT}
     ${where}
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    params
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
  billing_note_due_days?: number;
  notes?: string;
}): Promise<number> {
  const res = await exec(
    `INSERT INTO customers
       (code, name, contact_person, phone, email, tax_id, address,
        credit_limit, credit_score, credit_score_notes, default_credit_term_days, billing_note_due_days, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      input.billing_note_due_days ?? 5,
      input.notes || null,
    ]
  );
  
  const customerId = res.insertId;
  
  // ส่ง LINE notification เมื่อมีลูกค้าใหม่
  try {
    await sendLineNotification('new_customer', {
      id: customerId,
      code: input.code || `C${customerId.toString().padStart(3, '0')}`,
      name: input.name,
      phone: input.phone,
      credit_limit: input.credit_limit,
    });
  } catch (error) {
    console.error('Failed to send LINE notification for new customer:', error);
  }
  
  return customerId;
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
    billing_note_due_days: number;
    notes: string;
  }>
) {
  const fields = Object.keys(input);
  if (fields.length === 0) return;
  
  // ตรวจสอบว่ามีการแก้ไข credit_limit หรือไม่
  const hasCreditLimitChange = 'credit_limit' in input;
  let oldLimit = 0;
  let newLimit = 0;
  
  if (hasCreditLimitChange) {
    const [customers] = await query<any[]>(
      "SELECT credit_limit FROM customers WHERE id = ?",
      [id]
    );
    if (customers.length > 0) {
      oldLimit = customers[0].credit_limit;
      newLimit = input.credit_limit!;
    }
  }
  
  const set = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (input as Record<string, unknown>)[f]);
  await exec(`UPDATE customers SET ${set} WHERE id = ?`, [...values, id]);
  
  // ส่ง LINE notification เมื่อแก้ไขวงเงิน
  if (hasCreditLimitChange && oldLimit !== newLimit) {
    try {
      const [customers] = await query<any[]>(
        "SELECT name, code FROM customers WHERE id = ?",
        [id]
      );
      
      if (customers.length > 0) {
        await sendLineNotification('credit_limit_change', {
          customer_id: id,
          customer_name: customers[0].name,
          customer_code: customers[0].code,
          old_limit: oldLimit,
          new_limit: newLimit,
          updated_by: 'System', // ควรดึงจาก session จริงๆ
        });
      }
    } catch (error) {
      console.error('Failed to send LINE notification for credit limit change:', error);
    }
  }
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

export async function listCustomerEditLogs(
  customerId: number, 
  page: number = 1, 
  limit: number = 10
): Promise<{ logs: CustomerEditLog[]; total: number }> {
  const offset = (page - 1) * limit;
  
  // Get total count
  const countResult = await query<{ total: number }>(
    "SELECT COUNT(*) as total FROM customer_edit_logs WHERE customer_id = ?",
    [customerId]
  );
  const total = Number(countResult[0]?.total || 0);
  
  // Get logs with pagination
  const logs = await query<CustomerEditLog>(
    `SELECT l.*, u.full_name AS editor_name
     FROM customer_edit_logs l
     JOIN users u ON u.id = l.edited_by
     WHERE l.customer_id = ?
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [customerId, limit, offset]
  );
  
  return { logs, total };
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
    billing_note_due_days: number;
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
      "SELECT id, credit_limit, name, code FROM customers WHERE id = ? FOR UPDATE",
      [customerId]
    )) as unknown as [{id: number; credit_limit: number; name: string; code: string}[]];
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

    // ส่ง LINE notification เมื่อแก้ไขวงเงิน
    try {
      const [users] = await conn.query(
        "SELECT full_name FROM users WHERE id = ?",
        [adjustedBy]
      ) as unknown as [{full_name: string}[]];
      
      await sendLineNotification('credit_limit_change', {
        customer_id: customerId,
        customer_name: cust.name,
        customer_code: cust.code,
        old_limit: Number(cust.credit_limit),
        new_limit: newLimit,
        updated_by: users[0]?.full_name || 'Unknown',
      });
    } catch (error) {
      console.error('Failed to send LINE notification for credit limit adjustment:', error);
    }

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
     WHERE t.customer_id = ? AND t.is_active = 1
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
  // ตรวจสอบว่ามีวงเงินชั่วคราวที่ active อยู่แล้วหรือไม่
  const existingTemps = await query<any[]>(
    `SELECT id, extra_amount, start_date, end_date 
     FROM temp_credit_limits 
     WHERE customer_id = ? AND is_active = 1 
     AND start_date <= CURDATE() AND end_date >= CURDATE()`,
    [input.customer_id]
  );
  
  if (existingTemps && existingTemps.length > 0) {
    const existing = existingTemps[0] as any;
    throw new Error(`ลูกค้ามีวงเงินชั่วคราวที่ยังใช้งานอยู่: +${Number(existing.extra_amount).toLocaleString()} บาท (${existing.start_date} ถึง ${existing.end_date}) ต้องยกเลิกอันเก่าก่อน`);
  }

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

  // ส่ง LINE notification เมื่อขอเพิ่มวงเงินชั่วคราว
  try {
    const customers = await query<any[]>(
      "SELECT name, code, credit_limit FROM customers WHERE id = ?",
      [input.customer_id]
    );
    
    if (customers && customers.length > 0) {
      const users = await query<any[]>(
        "SELECT full_name FROM users WHERE id = ?",
        [input.created_by]
      );
      
      const customer = customers[0] as any;
      
      await sendLineNotification('temporary_credit_increase', {
        customer_id: input.customer_id,
        customer_name: customer.name,
        customer_code: customer.code,
        old_limit: customer.credit_limit,
        extra_amount: input.extra_amount,
        new_limit: customer.credit_limit + input.extra_amount,
        start_date: input.start_date,
        end_date: input.end_date,
        reason: input.reason || '',
        requested_by: (users && users.length > 0) ? (users[0] as any)?.full_name || 'Unknown' : 'Unknown',
      });
    }
  } catch (error) {
    console.error('Failed to send LINE notification for temporary credit limit:', error);
  }

  return res.insertId;
}

export async function deactivateTempCreditLimit(id: number, deactivatedBy?: number): Promise<void> {
  // ดึงข้อมูล temp credit limit ก่อนยกเลิก
  const tempLimits = await query<any[]>(
    `SELECT t.*, c.name as customer_name, c.code as customer_code, c.credit_limit
     FROM temp_credit_limits t
     JOIN customers c ON t.customer_id = c.id
     WHERE t.id = ? AND t.is_active = 1`,
    [id]
  );
  
  if (!tempLimits || tempLimits.length === 0) {
    throw new Error("ไม่พบวงเงินชั่วคราวที่ต้องการยกเลิก หรือถูกยกเลิกไปแล้ว");
  }
  
  const tempLimit = tempLimits[0] as any;
  
  // ยกเลิกวงเงินชั่วคราว
  await exec("UPDATE temp_credit_limits SET is_active = 0 WHERE id = ?", [id]);
  
  // บันทึก audit log
  if (deactivatedBy) {
    await exec(
      `INSERT INTO customer_edit_logs (customer_id, edited_by, summary, changes)
       VALUES (?,?,?,?)`,
      [
        tempLimit.customer_id,
        deactivatedBy,
        `ยกเลิกวงเงินชั่วคราว +${Number(tempLimit.extra_amount).toLocaleString()} บาท`,
        JSON.stringify({ 
          type: "temp_credit_limit_deactivate", 
          temp_id: id,
          extra_amount: tempLimit.extra_amount,
          deactivated_at: new Date().toISOString()
        }),
      ]
    );
  }

  // ส่ง LINE notification เมื่อยกเลิกวงเงินชั่วคราว
  try {
    if (deactivatedBy) {
      const users = await query<any[]>(
        "SELECT full_name FROM users WHERE id = ?",
        [deactivatedBy]
      );
      
      await sendLineNotification('temporary_credit_deactivate', {
        customer_id: tempLimit.customer_id,
        customer_name: tempLimit.customer_name,
        customer_code: tempLimit.customer_code,
        extra_amount: tempLimit.extra_amount,
        base_limit: tempLimit.credit_limit,
        deactivated_by: (users && users.length > 0) ? (users[0] as any)?.full_name || 'Unknown' : 'Unknown',
        deactivated_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to send LINE notification for temp credit deactivation:', error);
  }
}

export async function deleteCustomer(id: number): Promise<void> {
  return withTx(async (conn) => {
    // ดึงข้อมูลลูกค้าก่อนลบเพื่อส่ง notification
    const [customers] = await conn.query(
      "SELECT code, name, contact_person FROM customers WHERE id = ?",
      [id]
    );
    const customer = (customers as any[])[0];
    if (!customer) {
      throw new Error("ไม่พบข้อมูลลูกค้า");
    }

    // ตรวจสอบว่ามี PO ที่ยังไม่ได้ชำระหรือไม่
    const [unpaidPos] = await conn.query(
      "SELECT COUNT(*) as count FROM purchase_orders WHERE customer_id = ? AND payment_status != 'paid'",
      [id]
    );
    
    if ((unpaidPos as any[])[0].count > 0) {
      throw new Error("ไม่สามารถลบลูกค้าได้ เนื่องจากมี Purchase Order ที่ยังไม่ได้ชำระเงิน กรุณาชำระเงินให้ครบทุก PO ก่อน");
    }

    // ถ้า PO ทั้งหมดชำระครบแล้ว สามารถลบลูกค้าได้

    // ลบข้อมูลที่เกี่ยวข้องทั้งหมด
    try {
      await conn.query("DELETE FROM temp_credit_limits WHERE customer_id = ?", [id]);
    } catch (e) {
      console.error('Error deleting temp_credit_limits:', e);
      throw e;
    }
    
    try {
      await conn.query("DELETE FROM credit_limit_adjustments WHERE customer_id = ?", [id]);
    } catch (e) {
      console.error('Error deleting credit_limit_adjustments:', e);
      throw e;
    }
    
    try {
      await conn.query("DELETE FROM customer_edit_logs WHERE customer_id = ?", [id]);
    } catch (e) {
      console.error('Error deleting customer_edit_logs:', e);
      throw e;
    }
    
    try {
      await conn.query("DELETE FROM customer_files WHERE customer_id = ?", [id]);
    } catch (e) {
      console.error('Error deleting customer_files:', e);
      throw e;
    }
    
    // ลบ PO ที่ชำระครบแล้วก่อน ถึงจะลบลูกค้าได้ (foreign key constraint)
    try {
      await conn.query("DELETE FROM purchase_orders WHERE customer_id = ? AND payment_status = 'paid'", [id]);
    } catch (e) {
      console.error('Error deleting purchase_orders:', e);
      throw e;
    }
    
    // ลบลูกค้า
    try {
      await conn.query("DELETE FROM customers WHERE id = ?", [id]);
    } catch (e) {
      console.error('Error deleting customers:', e);
      throw e;
    }

    // ส่ง LINE notification ว่าลบลูกค้าสำเร็จ
    try {
      await sendLineNotification('customer_deleted', {
        customer_id: id,
        customer_name: customer.name,
        customer_code: customer.code,
        contact_person: customer.contact_person,
        deleted_by: 'System', // สามารถส่ง user ที่ลบได้ถ้ามี context
        deleted_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to send LINE notification for customer deletion:', error);
    }
  });
}

/** Credit limit approval requests */

export type CreditLimitRequest = {
  id: number;
  request_type: "permanent_increase" | "temporary";
  customer_id: number;
  amount: number | null;
  extra_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requested_by: number;
  approved_by: number | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  approval_token: string;
  created_at: Date;
  // joined fields
  customer_name?: string;
  customer_code?: string;
  requester_name?: string;
  approver_name?: string;
};

function generateApprovalToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function createCreditLimitRequest(input: {
  request_type: "permanent_increase" | "temporary";
  customer_id: number;
  amount?: number;  // for permanent_increase
  extra_amount?: number;  // for temporary
  start_date?: string;
  end_date?: string;
  reason?: string;
  requested_by: number;
}): Promise<{ id: number; approval_token: string }> {
  const token = generateApprovalToken();
  
  // Validate based on request type
  if (input.request_type === "permanent_increase" && (!input.amount || input.amount <= 0)) {
    throw new Error("จำนวนวงเงินที่ขอเพิ่มต้องมากกว่า 0");
  }
  if (input.request_type === "temporary") {
    if (!input.extra_amount || input.extra_amount <= 0) throw new Error("จำนวนวงเงินชั่วคราวต้องมากกว่า 0");
    if (!input.start_date || !input.end_date) throw new Error("ต้องระบุวันที่เริ่มต้นและสิ้นสุด");
    if (input.start_date >= input.end_date) throw new Error("วันที่สิ้นสุดต้องหลังวันที่เริ่มต้น");
  }

  const result = await exec(
    `INSERT INTO credit_limit_requests
       (request_type, customer_id, amount, extra_amount, start_date, end_date, reason, requested_by, approval_token)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      input.request_type,
      input.customer_id,
      input.amount || null,
      input.extra_amount || null,
      input.start_date || null,
      input.end_date || null,
      input.reason || null,
      input.requested_by,
      token,
    ]
  );

  return { id: result.insertId, approval_token: token };
}

export async function getCreditLimitRequestByToken(token: string): Promise<CreditLimitRequest | null> {
  const rows = await query<CreditLimitRequest & {
    customer_name: string;
    customer_code: string;
    requester_name: string;
    approver_name: string | null;
  }>(
    `SELECT r.*, c.name as customer_name, c.code as customer_code,
            u1.full_name as requester_name, u2.full_name as approver_name
     FROM credit_limit_requests r
     JOIN customers c ON c.id = r.customer_id
     JOIN users u1 ON u1.id = r.requested_by
     LEFT JOIN users u2 ON u2.id = r.approved_by
     WHERE r.approval_token = ?`,
    [token]
  );
  return rows[0] ?? null;
}

export async function listPendingCreditLimitRequests(): Promise<CreditLimitRequest[]> {
  return query<CreditLimitRequest & {
    customer_name: string;
    customer_code: string;
    requester_name: string;
  }>(
    `SELECT r.*, c.name as customer_name, c.code as customer_code,
            u1.full_name as requester_name
     FROM credit_limit_requests r
     JOIN customers c ON c.id = r.customer_id
     JOIN users u1 ON u1.id = r.requested_by
     WHERE r.status = 'pending'
     ORDER BY r.created_at DESC`
  );
}

export async function approveCreditLimitRequest(
  token: string,
  approvedBy: number
): Promise<{ success: boolean; message: string }> {
  return withTx(async (conn) => {
    // Get request
    const [rows] = await conn.query(
      `SELECT * FROM credit_limit_requests WHERE approval_token = ? AND status = 'pending'`,
      [token]
    ) as unknown as [CreditLimitRequest[]];
    
    const request = rows[0];
    if (!request) throw new Error("ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว");

    // Validate approvedBy exists in users; fallback to requested_by if not found
    const [approverRows] = await conn.query(
      "SELECT id FROM users WHERE id = ?",
      [approvedBy]
    ) as unknown as [{ id: number }[]];
    const resolvedApprovedBy = approverRows.length > 0 ? approvedBy : request.requested_by;

    const [custRows] = await conn.query(
      "SELECT credit_limit FROM customers WHERE id = ?",
      [request.customer_id]
    ) as unknown as [{ credit_limit: number }[]];
    const currentLimit = Number(custRows[0]?.credit_limit ?? 0);

    if (request.request_type === "permanent_increase") {
      // Apply permanent increase
      const newLimit = currentLimit + Number(request.amount);
      await conn.query(
        "UPDATE customers SET credit_limit = ? WHERE id = ?",
        [newLimit, request.customer_id]
      );
      await conn.query(
        `INSERT INTO credit_limit_adjustments (customer_id, adjusted_by, delta, new_limit, reason)
         VALUES (?,?,?,?,?)`,
        [request.customer_id, resolvedApprovedBy, request.amount, newLimit, `อนุมัติคำขอ: ${request.reason || '-'}`]
      );
    } else {
      // Apply temporary credit
      const [tempRes] = await conn.query(
        `INSERT INTO temp_credit_limits
           (customer_id, extra_amount, start_date, end_date, reason, created_by, request_id)
         VALUES (?,?,?,?,?,?,?)`,
        [
          request.customer_id,
          request.extra_amount,
          request.start_date,
          request.end_date,
          request.reason,
          resolvedApprovedBy,
          request.id,
        ]
      );
    }

    // Update request status
    await conn.query(
      `UPDATE credit_limit_requests
       SET status = 'approved', approved_by = ?, approved_at = NOW()
       WHERE id = ?`,
      [resolvedApprovedBy, request.id]
    );

    // Audit log
    const summaryText = request.request_type === "permanent_increase"
      ? `อนุมัติเพิ่มวงเงินถาวร +${Number(request.amount).toLocaleString()} บาท`
      : `อนุมัติวงเงินชั่วคราว +${Number(request.extra_amount).toLocaleString()} บาท (${request.start_date} ถึง ${request.end_date})`;
    await conn.query(
      `INSERT INTO customer_edit_logs (customer_id, edited_by, summary, changes) VALUES (?,?,?,?)`,
      [request.customer_id, resolvedApprovedBy, summaryText, JSON.stringify({ type: "credit_request_approved", request_id: request.id })]
    );

    // LINE notification
    try {
      const [custInfo] = await conn.query(
        "SELECT name, code, credit_limit FROM customers WHERE id = ?",
        [request.customer_id]
      ) as unknown as [{ name: string; code: string; credit_limit: number }[]];
      const [approverInfo] = await conn.query(
        "SELECT full_name FROM users WHERE id = ?",
        [resolvedApprovedBy]
      ) as unknown as [{ full_name: string }[]];
      const c = custInfo[0];
      if (c) {
        await sendLineNotification("credit_limit_change", {
          customer_id: request.customer_id,
          customer_name: c.name,
          customer_code: c.code,
          old_limit: currentLimit,
          new_limit: request.request_type === "permanent_increase" ? currentLimit + Number(request.amount) : currentLimit,
          updated_by: approverInfo[0]?.full_name || "ผู้จัดการ",
        });
      }
    } catch (e) {
      console.error("Failed to send LINE notification after approval:", e);
    }

    return { success: true, message: "อนุมัติคำขอสำเร็จ" };
  });
}

export async function rejectCreditLimitRequest(
  token: string,
  rejectedBy: number,
  rejectionReason?: string
): Promise<{ success: boolean; message: string }> {
  return withTx(async (conn) => {
    // Get request to resolve valid user id
    const [rows] = await conn.query(
      `SELECT requested_by FROM credit_limit_requests WHERE approval_token = ? AND status = 'pending'`,
      [token]
    ) as unknown as [{ requested_by: number }[]];
    if (rows.length === 0) throw new Error("ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว");

    // Validate rejectedBy exists; fallback to requested_by
    const [approverRows] = await conn.query(
      "SELECT id FROM users WHERE id = ?",
      [rejectedBy]
    ) as unknown as [{ id: number }[]];
    const resolvedRejectedBy = approverRows.length > 0 ? rejectedBy : rows[0].requested_by;

    const [result] = await conn.query(
      `UPDATE credit_limit_requests
       SET status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_reason = ?
       WHERE approval_token = ? AND status = 'pending'`,
      [resolvedRejectedBy, rejectionReason || null, token]
    ) as unknown as [{ affectedRows: number }];

    if ((result as any).affectedRows === 0) {
      throw new Error("ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว");
    }

    return { success: true, message: "ปฏิเสธคำขอสำเร็จ" };
  });
}

// ─── Credit Usage History ────────────────────────────────────────────────────

export type CreditHistoryPoint = {
  date: string;        // "YYYY-MM-DD"
  outstanding: number;
  creditLimit: number;
};

/**
 * Reconstructs the outstanding-debt and credit-limit timeline for a customer
 * over the last `months` months.  Events (PO created, payment, CCN usage,
 * credit-limit adjustment, temp-credit start/end) become data points; the
 * outstanding is a running total, and the credit limit is the effective value
 * (base + any active temp grant) at each event date.
 */
export async function getCreditUsageHistory(
  customerId: number,
  months: number = 12
): Promise<CreditHistoryPoint[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const fromStr = from.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Current base credit limit
  const custRows = await query<{ credit_limit: number }>(
    "SELECT credit_limit FROM customers WHERE id = ?",
    [customerId]
  );
  const currentBaseLimit = Number(custRows[0]?.credit_limit ?? 0);

  // All credit-limit adjustments (ascending) and temp-credit periods
  const adjustments = await query<{ created_at: Date; delta: number; new_limit: number }>(
    "SELECT created_at, delta, new_limit FROM credit_limit_adjustments WHERE customer_id = ? ORDER BY created_at ASC",
    [customerId]
  );
  const tempCredits = await query<{ extra_amount: number; start_date: string; end_date: string }>(
    "SELECT extra_amount, DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date, DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date FROM temp_credit_limits WHERE customer_id = ? AND is_active = 1 ORDER BY start_date ASC",
    [customerId]
  );

  // Reconstruct base credit limit at fromStr by reversing adjustments after fromStr
  let baseLimitAtFrom = currentBaseLimit;
  for (const adj of [...adjustments].reverse()) {
    if (new Date(adj.created_at).toISOString().slice(0, 10) >= fromStr) {
      baseLimitAtFrom -= Number(adj.delta);
    }
  }
  baseLimitAtFrom = Math.max(0, baseLimitAtFrom);

  // Helper: temp extra active at a given date string
  const getTempExtra = (dateStr: string): number => {
    for (const t of tempCredits) {
      const sd = String(t.start_date).slice(0, 10);
      const ed = String(t.end_date).slice(0, 10);
      if (dateStr >= sd && dateStr <= ed) return Number(t.extra_amount);
    }
    return 0;
  };

  // Outstanding at fromStr:
  // For each non-cancelled PO created before fromStr, take total minus all
  // payments and CCN usages that happened before fromStr.
  const preRows = await query<{ val: number }>(`
    SELECT COALESCE(SUM(
      po.total
      - COALESCE((SELECT SUM(p.amount)    FROM payments p WHERE p.po_id = po.id AND DATE(p.paid_at) < ?), 0)
      - COALESCE((
          SELECT SUM(ccnu.amount_used)
          FROM customer_credit_note_usages ccnu
          JOIN customer_credit_notes ccn ON ccn.id = ccnu.ccn_id
          WHERE ccnu.po_id = po.id AND ccnu.usage_type = 'applied_to_po' AND DATE(ccnu.created_at) < ?
        ), 0)
    ), 0) AS val
    FROM purchase_orders po
    WHERE po.customer_id = ? AND po.status <> 'cancelled' AND DATE(po.created_at) < ?
  `, [fromStr, fromStr, customerId, fromStr]);
  const outstandingAtFrom = Math.max(0, Number(preRows[0]?.val ?? 0));

  // Events within [fromStr, todayStr] that change outstanding or the limit
  const poRows = await query<{ date: string; amount: number }>(`
    SELECT DATE_FORMAT(created_at,'%Y-%m-%d') AS date, total AS amount
    FROM purchase_orders
    WHERE customer_id = ? AND status <> 'cancelled' AND DATE(created_at) >= ?
    ORDER BY created_at
  `, [customerId, fromStr]);

  const payRows = await query<{ date: string; amount: number }>(`
    SELECT DATE_FORMAT(p.paid_at,'%Y-%m-%d') AS date, p.amount AS amount
    FROM payments p
    JOIN purchase_orders po ON po.id = p.po_id
    WHERE po.customer_id = ? AND po.status <> 'cancelled' AND DATE(p.paid_at) >= ?
    ORDER BY p.paid_at
  `, [customerId, fromStr]);

  const ccnRows = await query<{ date: string; amount: number }>(`
    SELECT DATE_FORMAT(ccnu.created_at,'%Y-%m-%d') AS date, ccnu.amount_used AS amount
    FROM customer_credit_note_usages ccnu
    JOIN customer_credit_notes ccn ON ccn.id = ccnu.ccn_id
    WHERE ccn.customer_id = ? AND ccnu.usage_type = 'applied_to_po' AND DATE(ccnu.created_at) >= ?
    ORDER BY ccnu.created_at
  `, [customerId, fromStr]);

  const adjRows = await query<{ date: string; new_limit: number }>(`
    SELECT DATE_FORMAT(created_at,'%Y-%m-%d') AS date, new_limit
    FROM credit_limit_adjustments
    WHERE customer_id = ? AND DATE(created_at) >= ?
    ORDER BY created_at
  `, [customerId, fromStr]);

  // Boundary dates where temp credit starts or expires (day after end)
  const tempBoundaries = tempCredits.flatMap((t) => {
    const dates: string[] = [];
    const sd = String(t.start_date).slice(0, 10);
    if (sd >= fromStr && sd <= todayStr) dates.push(sd);
    const end = new Date(String(t.end_date).slice(0, 10));
    end.setDate(end.getDate() + 1);
    const ed1 = end.toISOString().slice(0, 10);
    if (ed1 >= fromStr && ed1 <= todayStr) dates.push(ed1);
    return dates;
  });

  type Event =
    | { date: string; kind: "po" | "pay" | "ccn"; amount: number }
    | { date: string; kind: "adj"; newLimit: number }
    | { date: string; kind: "boundary" };

  const events: Event[] = [
    ...poRows.map((e) => ({ date: String(e.date), kind: "po" as const, amount: Number(e.amount) })),
    ...payRows.map((e) => ({ date: String(e.date), kind: "pay" as const, amount: Number(e.amount) })),
    ...ccnRows.map((e) => ({ date: String(e.date), kind: "ccn" as const, amount: Number(e.amount) })),
    ...adjRows.map((e) => ({ date: String(e.date), kind: "adj" as const, newLimit: Number(e.new_limit) })),
    ...tempBoundaries.map((d) => ({ date: d, kind: "boundary" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Walk events and build data points
  const points: CreditHistoryPoint[] = [
    { date: fromStr, outstanding: outstandingAtFrom, creditLimit: baseLimitAtFrom + getTempExtra(fromStr) },
  ];
  let outstanding = outstandingAtFrom;
  let baseLimit = baseLimitAtFrom;

  for (const ev of events) {
    if (ev.kind === "adj") {
      baseLimit = ev.newLimit;
    } else if (ev.kind === "po") {
      outstanding += ev.amount;
    } else if (ev.kind === "pay" || ev.kind === "ccn") {
      outstanding = Math.max(0, outstanding - ev.amount);
    }
    // boundary events don't change outstanding/limit — they just force a point
    points.push({ date: ev.date, outstanding, creditLimit: baseLimit + getTempExtra(ev.date) });
  }

  // Ensure we have today's point
  if (points[points.length - 1]?.date !== todayStr) {
    points.push({ date: todayStr, outstanding, creditLimit: baseLimit + getTempExtra(todayStr) });
  }

  // Deduplicate by date — keep last entry per date (most recent state of that day)
  const deduped = new Map<string, CreditHistoryPoint>();
  for (const p of points) deduped.set(p.date, p);

  return [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date));
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
