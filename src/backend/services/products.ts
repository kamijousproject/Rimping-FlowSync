import { query } from "@/backend/db";

export type Product = {
  id: number;
  sku: string;
  description: string;
  current_price: number;
  dept: string | null;
  sub_dept: string | null;
  class: string | null;
  vendor_name: string | null;
};

export async function searchProducts(q: string, limit = 30): Promise<Product[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const cols = "id, sku, description, current_price, dept, sub_dept, class, vendor_name";

  // --- Exact / prefix SKU match (uses idx_sku index — always fast) ---
  const skuPrefix = `${trimmed}%`;
  const skuRows = await query<Product>(
    `SELECT ${cols} FROM products WHERE sku LIKE ? ORDER BY sku ASC LIMIT ?`,
    [skuPrefix, limit]
  );
  if (skuRows.length >= limit) return skuRows;

  // --- FULLTEXT search on (sku, description) for remaining slots ---
  const remaining = limit - skuRows.length;
  const skuIds = skuRows.map((r) => r.id);
  const ftTerm = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `+${w}*`)   // boolean mode: each word must match, prefix wildcard
    .join(" ");

  const excludeClause = skuIds.length
    ? `AND id NOT IN (${skuIds.map(() => "?").join(",")})`
    : "";

  const ftRows = await query<Product>(
    `SELECT ${cols},
            MATCH(sku, description) AGAINST (? IN BOOLEAN MODE) AS _score
     FROM products
     WHERE MATCH(sku, description) AGAINST (? IN BOOLEAN MODE)
       ${excludeClause}
     ORDER BY _score DESC
     LIMIT ?`,
    [ftTerm, ftTerm, ...skuIds, remaining]
  );

  return [...skuRows, ...ftRows];
}
