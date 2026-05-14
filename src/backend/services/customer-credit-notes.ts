import { query, withTx } from "@/backend/db";

export type CustomerCreditNote = {
  id: number;
  ccn_number: string;
  customer_id: number;
  po_id: number;
  payment_id: number;
  amount: number;
  status: "active" | "used" | "refunded" | "expired";
  usage_type: "keep_as_credit" | "refund_to_customer";
  used_amount: number;
  refunded_at: string | null;
  notes: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  creator_name?: string;
  po_number?: string;
  remaining?: number; // calculated: amount - used_amount
};

export type CustomerCreditNoteUsage = {
  id: number;
  ccn_id: number;
  po_id: number | null;
  amount_used: number;
  usage_type: "applied_to_po" | "refunded";
  notes: string | null;
  created_by: number;
  created_at: string;
  performer_name?: string;
  po_number?: string;
};

async function generateCcnNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `CCN${yy}${mm}-`;
  const [row] = await query<{ last: string | null }>(
    `SELECT MAX(ccn_number) AS last FROM customer_credit_notes WHERE ccn_number LIKE ?`,
    [`${prefix}%`]
  );
  const lastSeq = row?.last ? parseInt(row.last.split("-")[1] || "0", 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

export type CreateCustomerCreditNoteInput = {
  customer_id: number;
  po_id: number;
  payment_id: number;
  amount: number;
  usage_type: "keep_as_credit" | "refund_to_customer";
  notes?: string;
  created_by: number;
  expires_at?: string | null;
};

export async function createCustomerCreditNote(
  input: CreateCustomerCreditNoteInput
): Promise<CustomerCreditNote> {
  const ccn_number = await generateCcnNumber();

  return withTx(async (conn) => {
    const [res] = await conn.query(
      `INSERT INTO customer_credit_notes 
         (ccn_number, customer_id, po_id, payment_id, amount, status, usage_type, notes, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ccn_number,
        input.customer_id,
        input.po_id,
        input.payment_id,
        input.amount,
        input.usage_type === "refund_to_customer" ? "refunded" : "active",
        input.usage_type,
        input.notes || null,
        input.created_by,
        input.expires_at || null,
      ]
    );
    const ccnId = (res as { insertId: number }).insertId;

    // If refund, create usage log and set refunded_at
    if (input.usage_type === "refund_to_customer") {
      await conn.query(
        `UPDATE customer_credit_notes SET refunded_at = NOW() WHERE id = ?`,
        [ccnId]
      );
      await conn.query(
        `INSERT INTO customer_credit_note_usages 
           (ccn_id, po_id, amount_used, usage_type, notes, created_by)
         VALUES (?, NULL, ?, 'refunded', ?, ?)`,
        [ccnId, input.amount, "โอนคืนลูกค้า", input.created_by]
      );
    }

    const [ccn] = await query<CustomerCreditNote>(
      `SELECT ccn.*, u.full_name AS creator_name, po.po_number
       FROM customer_credit_notes ccn
       LEFT JOIN users u ON u.id = ccn.created_by
       LEFT JOIN purchase_orders po ON po.id = ccn.po_id
       WHERE ccn.id = ?`,
      [ccnId]
    );
    return ccn;
  });
}

export async function listCustomerCreditNotes(
  customer_id: number
): Promise<CustomerCreditNote[]> {
  const notes = await query<CustomerCreditNote & { creator_name: string; po_number: string }>(
    `SELECT ccn.*, u.full_name AS creator_name, po.po_number
     FROM customer_credit_notes ccn
     LEFT JOIN users u ON u.id = ccn.created_by
     LEFT JOIN purchase_orders po ON po.id = ccn.po_id
     WHERE ccn.customer_id = ?
     ORDER BY ccn.created_at DESC`,
    [customer_id]
  );
  return notes.map((n) => ({
    ...n,
    remaining: Number(n.amount) - Number(n.used_amount),
  }));
}

export async function getActiveCreditNotesForCustomer(
  customer_id: number
): Promise<CustomerCreditNote[]> {
  const notes = await query<CustomerCreditNote & { creator_name: string; po_number: string }>(
    `SELECT ccn.*, u.full_name AS creator_name, po.po_number
     FROM customer_credit_notes ccn
     LEFT JOIN users u ON u.id = ccn.created_by
     LEFT JOIN purchase_orders po ON po.id = ccn.po_id
     WHERE ccn.customer_id = ? 
       AND ccn.status = 'active'
       AND (ccn.expires_at IS NULL OR ccn.expires_at >= CURDATE())
     ORDER BY ccn.created_at ASC`,
    [customer_id]
  );
  return notes.map((n) => ({
    ...n,
    remaining: Number(n.amount) - Number(n.used_amount),
  }));
}

export async function getCreditNoteUsagesForPo(po_id: number): Promise<(CustomerCreditNoteUsage & { ccn_number: string })[]> {
  return query(
    `SELECT ccnu.*, ccn.ccn_number
     FROM customer_credit_note_usages ccnu
     JOIN customer_credit_notes ccn ON ccn.id = ccnu.ccn_id
     WHERE ccnu.po_id = ?
     ORDER BY ccnu.created_at DESC`,
    [po_id]
  );
}

export async function getCustomerCreditNote(
  id: number
): Promise<(CustomerCreditNote & { usages: CustomerCreditNoteUsage[] }) | null> {
  const [ccn] = await query<CustomerCreditNote & { creator_name: string; po_number: string }>(
    `SELECT ccn.*, u.full_name AS creator_name, po.po_number
     FROM customer_credit_notes ccn
     LEFT JOIN users u ON u.id = ccn.created_by
     LEFT JOIN purchase_orders po ON po.id = ccn.po_id
     WHERE ccn.id = ?`,
    [id]
  );
  if (!ccn) return null;

  const usages = await query<CustomerCreditNoteUsage & { performer_name: string; po_number: string }>(
    `SELECT ccnu.*, u.full_name AS performer_name, po.po_number
     FROM customer_credit_note_usages ccnu
     LEFT JOIN users u ON u.id = ccnu.created_by
     LEFT JOIN purchase_orders po ON po.id = ccnu.po_id
     WHERE ccnu.ccn_id = ?
     ORDER BY ccnu.created_at DESC`,
    [id]
  );

  return {
    ...ccn,
    remaining: Number(ccn.amount) - Number(ccn.used_amount),
    usages,
  };
}

// Apply credit note to a PO (use some or all of the credit)
export async function applyCreditNoteToPo(
  ccn_id: number,
  po_id: number,
  amount_to_apply: number,
  created_by: number,
  notes?: string
): Promise<void> {
  return withTx(async (conn) => {
    // Check available credit
    const [ccn] = await conn.query(
      `SELECT amount, used_amount, status FROM customer_credit_notes WHERE id = ? FOR UPDATE`,
      [ccn_id]
    );
    const creditNote = (ccn as { amount: number; used_amount: number; status: string }[])[0];
    if (!creditNote) throw new Error("ไม่พบเครดิตโน๊ต");
    if (creditNote.status !== "active") throw new Error("เครดิตโน๊ตนี้ไม่สามารถใช้งานได้");

    const available = Number(creditNote.amount) - Number(creditNote.used_amount);
    if (amount_to_apply > available) {
      throw new Error(`เครดิตโน๊ตไม่พอ (เหลือ ${available} บาท)`);
    }

    // Create usage record
    await conn.query(
      `INSERT INTO customer_credit_note_usages 
         (ccn_id, po_id, amount_used, usage_type, notes, created_by)
       VALUES (?, ?, ?, 'applied_to_po', ?, ?)`,
      [ccn_id, po_id, amount_to_apply, notes || null, created_by]
    );

    // Update used_amount and status
    const newUsed = Number(creditNote.used_amount) + amount_to_apply;
    const newStatus = newUsed >= Number(creditNote.amount) ? "used" : "active";
    await conn.query(
      `UPDATE customer_credit_notes SET used_amount = ?, status = ? WHERE id = ?`,
      [newUsed, newStatus, ccn_id]
    );
  });
}

// Mark credit note as refunded (manual refund outside system)
export async function refundCreditNote(
  ccn_id: number,
  refunded_by: number,
  notes?: string
): Promise<void> {
  return withTx(async (conn) => {
    const [ccn] = await conn.query(
      `SELECT amount, used_amount, status FROM customer_credit_notes WHERE id = ? FOR UPDATE`,
      [ccn_id]
    );
    const creditNote = (ccn as { amount: number; used_amount: number; status: string }[])[0];
    if (!creditNote) throw new Error("ไม่พบเครดิตโน๊ต");
    if (creditNote.status === "refunded") throw new Error("เครดิตโน๊ตนี้ถูกโอนคืนไปแล้ว");
    if (creditNote.status === "used") throw new Error("เครดิตโน๊ตนี้ถูกใช้งานไปแล้ว");

    const remaining = Number(creditNote.amount) - Number(creditNote.used_amount);
    if (remaining <= 0) throw new Error("ไม่มียอดคงเหลือให้โอนคืน");

    // Create usage record for refund
    await conn.query(
      `INSERT INTO customer_credit_note_usages 
         (ccn_id, po_id, amount_used, usage_type, notes, created_by)
       VALUES (?, NULL, ?, 'refunded', ?, ?)`,
      [ccn_id, remaining, notes || "โอนคืนลูกค้า", refunded_by]
    );

    // Update status to refunded
    await conn.query(
      `UPDATE customer_credit_notes 
       SET status = 'refunded', refunded_at = NOW(), used_amount = amount 
       WHERE id = ?`,
      [ccn_id]
    );
  });
}

// Get total available credit for a customer
export async function getCustomerAvailableCredit(customer_id: number): Promise<number> {
  const [row] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount - used_amount), 0) AS total
     FROM customer_credit_notes
     WHERE customer_id = ? 
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at >= CURDATE())`,
    [customer_id]
  );
  return Number(row?.total || 0);
}
