import { query, exec, withTx } from "../db";
import { invoiceNumberFromPo } from "./po";
import { getCustomer, getCustomerOutstanding, getEffectiveCreditLimit } from "./customers";

export type Payment = {
  id: number;
  po_id: number;
  amount: number;
  paid_at: Date;
  method: string;
  reference: string | null;
  slip_path: string | null;
  notes: string | null;
  recorded_by: number;
  created_at: Date;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  po_id: number;
  amount: number;
  generated_at: Date;
  generated_by: number;
  download_count: number;
};

export async function listPayments(po_id: number): Promise<(Payment & { is_overpayment: boolean })[]> {
  return query(
    `SELECT p.*, CASE WHEN ccn.id IS NOT NULL THEN 1 ELSE 0 END AS is_overpayment
     FROM payments p
     LEFT JOIN customer_credit_notes ccn ON ccn.payment_id = p.id
     WHERE p.po_id=?
     ORDER BY p.paid_at DESC, p.id DESC`,
    [po_id]
  ) as Promise<(Payment & { is_overpayment: boolean })[]>;
}

export async function getPaymentById(id: number): Promise<Payment | null> {
  const rows = await query<Payment>("SELECT * FROM payments WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function listAllPaymentsForCustomer(
  customer_id: number
): Promise<(Payment & { po_number: string })[]> {
  return query(
    `SELECT p.*, po.po_number
     FROM payments p
     JOIN purchase_orders po ON po.id = p.po_id
     WHERE po.customer_id = ?
     ORDER BY p.paid_at DESC, p.id DESC`,
    [customer_id]
  );
}

export async function recordPayment(input: {
  po_id: number;
  amount: number;
  paid_at: Date;
  method?: string;
  reference?: string;
  slip_path?: string;
  notes?: string;
  recorded_by: number;
  overpay_handling?: "keep_as_credit" | "refund_to_customer"; // วิธีจัดการเงินที่ชำระเกิน
  customer_id?: number; // ต้องส่งมาเมื่อมี overpay_handling
}): Promise<{ 
  payment_id: number; 
  remaining: number; 
  payment_status: string; 
  overpayment?: number;
  credit_note_id?: number;
}> {
  return withTx(async (conn) => {
    const [poRows] = await conn.query(
      "SELECT customer_id, total, paid_amount FROM purchase_orders WHERE id=? FOR UPDATE",
      [input.po_id]
    );
    const po = (poRows as { customer_id: number; total: number; paid_amount: number }[])[0];
    if (!po) throw new Error("PO not found");

    const newPaid = Number(po.paid_amount) + Number(input.amount);
    const remaining = Number(po.total) - newPaid;
    if (input.amount <= 0) throw new Error("ยอดชำระต้องมากกว่า 0");

    // Check for overpayment
    const overpayment = newPaid > Number(po.total) ? newPaid - Number(po.total) : 0;
    
    if (overpayment > 0) {
      if (!input.overpay_handling) {
        throw new Error(
          `ชำระเกินวงเงินคงค้าง ${overpayment.toLocaleString()} บาท กรุณาระบุวิธีจัดการเงินที่เกิน`
        );
      }
      if (!input.customer_id) {
        throw new Error("ต้องระบุ customer_id เมื่อมีการชำระเกิน");
      }
    }

    const [r] = await conn.query(
      `INSERT INTO payments
         (po_id, amount, paid_at, method, reference, slip_path, notes, recorded_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        input.po_id,
        input.amount,
        input.paid_at,
        input.method || "transfer",
        input.reference || null,
        input.slip_path || null,
        input.notes || null,
        input.recorded_by,
      ]
    );
    const payment_id = (r as { insertId: number }).insertId;

    // Calculate payment status (capped at paid, even with overpayment)
    let payment_status: "unpaid" | "partial" | "paid" = "partial";
    if (remaining <= 0.01 || newPaid >= Number(po.total)) payment_status = "paid";
    else if (newPaid <= 0.01) payment_status = "unpaid";

    // Update PO - remaining can go negative if overpaid (tracked separately via credit note)
    const actualRemaining = Math.max(remaining, 0);
    await conn.query(
      `UPDATE purchase_orders
       SET paid_amount=?, remaining_amount=?, payment_status=?,
           fully_paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE fully_paid_at END
       WHERE id=?`,
      [newPaid, actualRemaining, payment_status, payment_status, input.po_id]
    );

    // Create customer credit note for overpayment
    let credit_note_id: number | undefined;
    if (overpayment > 0 && input.overpay_handling) {
      const ccnNumber = await generateCcnNumber(conn);
      const [ccnRes] = await conn.query(
        `INSERT INTO customer_credit_notes 
           (ccn_number, customer_id, po_id, payment_id, amount, status, usage_type, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ccnNumber,
          input.customer_id || po.customer_id,
          input.po_id,
          payment_id,
          overpayment,
          input.overpay_handling === "refund_to_customer" ? "refunded" : "active",
          input.overpay_handling,
          input.overpay_handling === "refund_to_customer" 
            ? "โอนคืนลูกค้าจากการชำระเกิน" 
            : "เก็บเป็นเครดิตจากการชำระเกิน",
          input.recorded_by,
        ]
      );
      credit_note_id = (ccnRes as { insertId: number }).insertId;

      // If refund, create usage log
      if (input.overpay_handling === "refund_to_customer") {
        await conn.query(
          `UPDATE customer_credit_notes SET refunded_at = NOW() WHERE id = ?`,
          [credit_note_id]
        );
        await conn.query(
          `INSERT INTO customer_credit_note_usages 
             (ccn_id, po_id, amount_used, usage_type, notes, created_by)
           VALUES (?, NULL, ?, 'refunded', ?, ?)`,
          [credit_note_id, overpayment, "โอนคืนลูกค้า", input.recorded_by]
        );
      }
    }

    return { 
      payment_id, 
      remaining: actualRemaining, 
      payment_status,
      overpayment: overpayment > 0 ? overpayment : undefined,
      credit_note_id 
    };
  });
}

// Helper to generate CCN number within transaction
async function generateCcnNumber(conn: any): Promise<string> {
  const [rows] = await conn.query(
    `SELECT MAX(ccn_number) AS last FROM customer_credit_notes WHERE ccn_number LIKE ?`,
    [`CCN%`]
  );
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `CCN${yy}${mm}-`;
  const lastSeq = rows[0]?.last ? parseInt(rows[0].last.split("-")[1] || "0", 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function generateInvoice(input: {
  po_id: number;
  po_number: string;
  amount: number;
  generated_by: number;
  user_name?: string;
  ip_address?: string;
  user_agent?: string;
}): Promise<Invoice> {
  // Idempotent — return existing invoice if one already exists for this PO
  const existing = await query<Invoice>(
    "SELECT * FROM invoices WHERE po_id = ? ORDER BY id DESC LIMIT 1",
    [input.po_id]
  );
  if (existing[0]) return existing[0];

  const invoice_number = invoiceNumberFromPo(input.po_number);
  let invoiceId: number;
  try {
    const result = await exec(
      `INSERT INTO invoices (invoice_number, po_id, amount, generated_by)
       VALUES (?,?,?,?)`,
      [invoice_number, input.po_id, input.amount, input.generated_by]
    );
    invoiceId = (result as { insertId: number }).insertId;

    // อัปเดต due_date ของ PO = วันที่สร้าง invoice + credit_term_days ของลูกค้า
    const [poRows] = await query<{ customer_id: number }>(
      "SELECT customer_id FROM purchase_orders WHERE id = ?",
      [input.po_id]
    );
    if (poRows) {
      const customer = await getCustomer(poRows.customer_id);
      if (customer) {
        await exec(
          `UPDATE purchase_orders SET due_date = DATE_ADD(CURDATE(), INTERVAL ? DAY) WHERE id = ?`,
          [customer.default_credit_term_days, input.po_id]
        );
      }
    }

    // Log invoice creation
    await logInvoiceAction(
      invoiceId,
      "created",
      input.generated_by,
      input.user_name || "Unknown",
      input.ip_address,
      input.user_agent
    );
  } catch (e: unknown) {
    // If duplicate invoice_number, return whichever invoice exists for this po
    const code = (e as { code?: string }).code;
    if (code !== "ER_DUP_ENTRY") throw e;
    const fallback = await query<Invoice>(
      "SELECT * FROM invoices WHERE po_id = ? ORDER BY id DESC LIMIT 1",
      [input.po_id]
    );
    if (fallback[0]) return fallback[0];
    throw e;
  }
  const rows = await query<Invoice>(
    "SELECT * FROM invoices WHERE po_id = ? ORDER BY id DESC LIMIT 1",
    [input.po_id]
  );
  return rows[0];
}

export async function getInvoice(id: number): Promise<Invoice | null> {
  const rows = await query<Invoice>("SELECT * FROM invoices WHERE id=?", [id]);
  return rows[0] ?? null;
}

export async function updatePayment(
  paymentId: number,
  input: {
    amount?: number;
    paid_at?: Date;
    method?: string;
    reference?: string | null;
    notes?: string | null;
    slip_path?: string | null;
    edited_by: number;
  }
): Promise<Payment | null> {
  return withTx(async (conn) => {
    // Get current payment
    const [rows] = await conn.query("SELECT * FROM payments WHERE id = ?", [paymentId]) as unknown as [Payment[]];
    const current = rows[0];
    if (!current) throw new Error("ไม่พบรายการชำระเงิน");

    // Check if this payment created a credit note (overpayment)
    const [ccnRows] = await conn.query(
      "SELECT id FROM customer_credit_notes WHERE payment_id = ?",
      [paymentId]
    ) as unknown as [{ id: number }[]];
    if (ccnRows.length > 0) {
      throw new Error("ไม่สามารถแก้ไขรายการชำระเงินที่เกิดเครดิตโน๊ตจาก overpayment ได้ กรุณาติดต่อผู้ดูแลระบบ");
    }

    const poId = current.po_id;
    const oldAmount = Number(current.amount);
    const newAmount = input.amount ?? oldAmount;
    const amountDiff = newAmount - oldAmount;

    // Credit limit check: if reducing payment (amountDiff < 0), check if customer would exceed limit
    if (amountDiff < 0) {
      // Get current customer credit info
      const [poRow] = await conn.query("SELECT customer_id FROM purchase_orders WHERE id = ?", [poId]) as unknown as [{ customer_id: number }[]];
      const customerId = poRow[0]?.customer_id;
      
      if (customerId) {
        // Get current outstanding (excluding this PO's remaining since we're in transaction)
        const [outstandingRow] = await conn.query(
          `SELECT COALESCE(SUM(remaining_amount),0) as total 
           FROM purchase_orders 
           WHERE customer_id = ? AND status <> 'cancelled' AND id <> ?`,
          [customerId, poId]
        ) as unknown as [{ total: number }[]];
        
        const otherOutstanding = Number(outstandingRow[0]?.total || 0);
        
        // Get this PO's current remaining + amount change
        const [thisPoRow] = await conn.query(
          "SELECT remaining_amount FROM purchase_orders WHERE id = ?",
          [poId]
        ) as unknown as [{ remaining_amount: number }[]];
        const currentRemaining = Number(thisPoRow[0]?.remaining_amount);
        
        // New remaining after reducing payment
        const newRemaining = currentRemaining - amountDiff; // amountDiff is negative, so subtracting = adding
        
        // Total outstanding after edit
        const totalOutstanding = otherOutstanding + newRemaining;
        
        // Check against credit limit
        const { effective_limit, temp_extra } = await getEffectiveCreditLimit(customerId);
        
        if (totalOutstanding > effective_limit) {
          const limitDesc = temp_extra > 0
            ? `วงเงินหลัก + ชั่วคราว = ${effective_limit.toLocaleString()}`
            : `วงเงิน ${effective_limit.toLocaleString()}`;
          throw new Error(
            `ไม่สามารถแก้ไขได้: หากลดยอดชำระ ลูกหนี้คงค้างจะเป็น ${totalOutstanding.toLocaleString()} บาท เกิน${limitDesc} บาท`
          );
        }
      }
    }

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (input.amount !== undefined) {
      updates.push("amount = ?");
      values.push(input.amount);
    }
    if (input.paid_at !== undefined) {
      updates.push("paid_at = ?");
      values.push(input.paid_at);
    }
    if (input.method !== undefined) {
      updates.push("method = ?");
      values.push(input.method);
    }
    if (input.reference !== undefined) {
      updates.push("reference = ?");
      values.push(input.reference);
    }
    if (input.notes !== undefined) {
      updates.push("notes = ?");
      values.push(input.notes);
    }
    if (input.slip_path !== undefined) {
      updates.push("slip_path = ?");
      values.push(input.slip_path);
    }

    if (updates.length === 0) return current;

    values.push(paymentId);
    await conn.query(
      `UPDATE payments SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // Update PO amounts if payment amount changed
    if (amountDiff !== 0) {
      // Recalculate totals from actual payments to ensure consistency
      const [totalRow] = await conn.query(
        `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE po_id = ?`,
        [poId]
      ) as unknown as [{ total_paid: number }[]];
      
      const [poRow] = await conn.query(
        `SELECT total FROM purchase_orders WHERE id = ?`,
        [poId]
      ) as unknown as [{ total: number }[]];
      
      const totalPaid = Number(totalRow[0]?.total_paid || 0);
      const poTotal = Number(poRow[0]?.total || 0);
      const newRemaining = Math.max(poTotal - totalPaid, 0);
      
      let paymentStatus: "unpaid" | "partial" | "paid" = "partial";
      if (newRemaining <= 0.01 || totalPaid >= poTotal) paymentStatus = "paid";
      else if (totalPaid <= 0.01) paymentStatus = "unpaid";
      
      await conn.query(
        `UPDATE purchase_orders 
         SET paid_amount = ?,
             remaining_amount = ?,
             payment_status = ?
         WHERE id = ?`,
        [totalPaid, newRemaining, paymentStatus, poId]
      );
    }

    // Log the edit
    await conn.query(
      `INSERT INTO po_edit_logs (po_id, edited_by, summary, changes) VALUES (?,?,?,?)`,
      [
        poId,
        input.edited_by,
        `แก้ไขการชำระเงิน #${paymentId}: ยอด ${oldAmount.toLocaleString()} → ${newAmount.toLocaleString()} บาท`,
        JSON.stringify({
          type: "payment_edit",
          payment_id: paymentId,
          before: { amount: oldAmount },
          after: { amount: newAmount },
        }),
      ]
    );

    // Return updated payment
    const [updatedRows] = await conn.query("SELECT * FROM payments WHERE id = ?", [paymentId]) as unknown as [Payment[]];
    return updatedRows[0] ?? null;
  });
}

export async function deletePayment(
  paymentId: number,
  deletedBy: number
): Promise<void> {
  return withTx(async (conn) => {
    // Get current payment
    const [rows] = await conn.query("SELECT * FROM payments WHERE id = ?", [paymentId]) as unknown as [Payment[]];
    const payment = rows[0];
    if (!payment) throw new Error("ไม่พบรายการชำระเงิน");

    // Check if this payment created a credit note (overpayment)
    const [ccnRows] = await conn.query(
      "SELECT id FROM customer_credit_notes WHERE payment_id = ?",
      [paymentId]
    ) as unknown as [{ id: number }[]];
    if (ccnRows.length > 0) {
      throw new Error("ไม่สามารถลบรายการชำระเงินที่เกิดเครดิตโน๊ตจาก overpayment ได้ กรุณาติดต่อผู้ดูแลระบบ");
    }

    const poId = payment.po_id;
    const amount = Number(payment.amount);

    // Delete the payment first
    await conn.query("DELETE FROM payments WHERE id = ?", [paymentId]);

    // Recalculate totals from actual remaining payments to ensure consistency
    const [totalRow] = await conn.query(
      `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE po_id = ?`,
      [poId]
    ) as unknown as [{ total_paid: number }[]];
    
    const [poRow] = await conn.query(
      `SELECT total FROM purchase_orders WHERE id = ?`,
      [poId]
    ) as unknown as [{ total: number }[]];
    
    const totalPaid = Number(totalRow[0]?.total_paid || 0);
    const poTotal = Number(poRow[0]?.total || 0);
    const newRemaining = Math.max(poTotal - totalPaid, 0);
    
    let paymentStatus: "unpaid" | "partial" | "paid" = "partial";
    if (newRemaining <= 0.01 || totalPaid >= poTotal) paymentStatus = "paid";
    else if (totalPaid <= 0.01) paymentStatus = "unpaid";
    
    await conn.query(
      `UPDATE purchase_orders 
       SET paid_amount = ?,
           remaining_amount = ?,
           payment_status = ?
       WHERE id = ?`,
      [totalPaid, newRemaining, paymentStatus, poId]
    );

    // Log the deletion
    await conn.query(
      `INSERT INTO po_edit_logs (po_id, edited_by, summary, changes) VALUES (?,?,?,?)`,
      [
        poId,
        deletedBy,
        `ลบการชำระเงิน #${paymentId}: ยอด ${amount.toLocaleString()} บาท`,
        JSON.stringify({
          type: "payment_delete",
          payment_id: paymentId,
          amount: amount,
        }),
      ]
    );
  });
}

export type InvoiceLog = {
  id: number;
  invoice_id: number;
  action: "created" | "downloaded" | "printed" | "viewed";
  user_id: number;
  user_name: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
};

export async function logInvoiceAction(
  invoice_id: number,
  action: "created" | "downloaded" | "printed" | "viewed",
  user_id: number,
  user_name: string,
  ip_address?: string,
  user_agent?: string
): Promise<void> {
  await exec(
    `INSERT INTO invoice_logs (invoice_id, action, user_id, user_name, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [invoice_id, action, user_id, user_name, ip_address || null, user_agent || null]
  );

  // Update download count if action is downloaded
  if (action === "downloaded") {
    await exec(
      `UPDATE invoices SET download_count = download_count + 1 WHERE id = ?`,
      [invoice_id]
    );
  }
}

export async function getInvoiceLogs(invoice_id: number): Promise<InvoiceLog[]> {
  return query<InvoiceLog>(
    `SELECT * FROM invoice_logs WHERE invoice_id = ? ORDER BY created_at DESC`,
    [invoice_id]
  );
}

export async function getInvoiceWithLogs(
  id: number
): Promise<{ invoice: Invoice | null; logs: InvoiceLog[]; download_count: number }> {
  const invoice = await getInvoice(id);
  if (!invoice) {
    return { invoice: null, logs: [], download_count: 0 };
  }
  const logs = await getInvoiceLogs(id);
  return { invoice, logs, download_count: invoice.download_count || 0 };
}
