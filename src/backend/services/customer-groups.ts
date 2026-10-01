import { query, exec } from "../db";

export type CustomerGroup = {
  id: number;
  name: string;
  notes: string | null;
  member_count: number;
  created_at: Date;
};

export async function listCustomerGroups(): Promise<CustomerGroup[]> {
  return query<CustomerGroup>(
    `SELECT g.*, (SELECT COUNT(*) FROM customers c WHERE c.group_id = g.id) AS member_count
     FROM customer_groups g
     ORDER BY g.name`
  );
}

export async function createCustomerGroup(input: {
  name: string;
  notes?: string;
}): Promise<number> {
  const dup = await query<{ id: number }>(
    "SELECT id FROM customer_groups WHERE name = ?",
    [input.name]
  );
  if (dup.length) throw new Error("มีชื่อกลุ่มลูกค้านี้อยู่แล้ว");
  const res = await exec(
    "INSERT INTO customer_groups (name, notes) VALUES (?, ?)",
    [input.name, input.notes || null]
  );
  return res.insertId;
}
