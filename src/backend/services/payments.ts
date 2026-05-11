import { query, exec, withTx } from "../db";
import { invoiceNumberFromPo } from "./po";

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

export async function listPayments(po_id: number): Promise<Payment[]> {
  return query<Payment>(
    "SELECT * FROM payments WHERE po_id=? ORDER BY paid_at DESC, id DESC",
    [po_id]
  );
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
}): Promise<{ payment_id: number; remaining: number; payment_status: string }> {
  return withTx(async (conn) => {
    const [poRows] = await conn.query(
      "SELECT total, paid_amount FROM purchase_orders WHERE id=? FOR UPDATE",
      [input.po_id]
    );
    const po = (poRows as { total: number; paid_amount: number }[])[0];
    if (!po) throw new Error("PO not found");

    const newPaid = Number(po.paid_amount) + Number(input.amount);
    const remaining = Number(po.total) - newPaid;
    if (input.amount <= 0) throw new Error("ยอดชำระต้องมากกว่า 0");
    if (newPaid > Number(po.total) + 0.01) {
      throw new Error(
        `ชำระเกินวงเงินคงค้างของ PO (วงเงินรวม=${po.total}, ถ้าชำระจะรวม ${newPaid})`
      );
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

    let payment_status: "unpaid" | "partial" | "paid" = "partial";
    if (remaining <= 0.01) payment_status = "paid";
    else if (newPaid <= 0.01) payment_status = "unpaid";

    await conn.query(
      `UPDATE purchase_orders
       SET paid_amount=?, remaining_amount=?, payment_status=?,
           fully_paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE fully_paid_at END
       WHERE id=?`,
      [newPaid, Math.max(remaining, 0), payment_status, payment_status, input.po_id]
    );

    return { payment_id, remaining: Math.max(remaining, 0), payment_status };
  });
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
