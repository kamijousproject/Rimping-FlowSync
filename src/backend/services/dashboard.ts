import { query } from "../db";

export type DashboardStats = {
  total_customers: number;
  total_debtors: number; // ลูกค้าที่มียอดคงค้าง > 0
  total_outstanding: number;
  total_credit_limit: number;
  total_credit_used: number;
  pos_by_status: Record<string, number>;
  pos_by_payment: Record<string, number>;
  overdue_count: number;
  overdue_amount: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [cust] = await query<{ total_customers: number; total_credit_limit: number }>(
    "SELECT COUNT(*) AS total_customers, COALESCE(SUM(credit_limit),0) AS total_credit_limit FROM customers"
  );
  const [deb] = await query<{ total_debtors: number }>(
    `SELECT COUNT(DISTINCT customer_id) AS total_debtors
     FROM purchase_orders
     WHERE status <> 'cancelled' AND remaining_amount > 0`
  );
  const [out] = await query<{ total_outstanding: number }>(
    "SELECT COALESCE(SUM(remaining_amount),0) AS total_outstanding FROM purchase_orders WHERE status <> 'cancelled'"
  );
  const statusRows = await query<{ status: string; c: number }>(
    "SELECT status, COUNT(*) AS c FROM purchase_orders GROUP BY status"
  );
  const payRows = await query<{ payment_status: string; c: number }>(
    "SELECT payment_status, COUNT(*) AS c FROM purchase_orders WHERE status <> 'cancelled' GROUP BY payment_status"
  );
  const [overdue] = await query<{ c: number; a: number }>(
    `SELECT COUNT(*) AS c, COALESCE(SUM(remaining_amount),0) AS a
     FROM purchase_orders
     WHERE status <> 'cancelled' AND payment_status <> 'paid'
       AND due_date IS NOT NULL AND due_date < CURDATE()`
  );

  const pos_by_status: Record<string, number> = {};
  for (const r of statusRows) pos_by_status[r.status] = Number(r.c);
  const pos_by_payment: Record<string, number> = {};
  for (const r of payRows) pos_by_payment[r.payment_status] = Number(r.c);

  return {
    total_customers: Number(cust?.total_customers || 0),
    total_debtors: Number(deb?.total_debtors || 0),
    total_outstanding: Number(out?.total_outstanding || 0),
    total_credit_limit: Number(cust?.total_credit_limit || 0),
    total_credit_used: Number(out?.total_outstanding || 0),
    pos_by_status,
    pos_by_payment,
    overdue_count: Number(overdue?.c || 0),
    overdue_amount: Number(overdue?.a || 0),
  };
}

export async function getRecentPos(limit = 10) {
  return query(
    `SELECT po.id, po.po_number, po.status, po.payment_status, po.total,
            po.remaining_amount, po.due_date, po.created_at,
            c.id AS customer_id, c.name AS customer_name
     FROM purchase_orders po
     JOIN customers c ON c.id = po.customer_id
     ORDER BY po.created_at DESC
     LIMIT ?`,
    [limit]
  );
}
