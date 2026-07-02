import { query } from "@/backend/db";

export type Product = {
  id: number;
  sku: string;
  upc: string | null;
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

  const cols = "id, sku, upc, description, current_price, dept, sub_dept, class, vendor_name";

  // Dedupe across the three passes (SKU → UPC → FULLTEXT), preserving priority order.
  const found = new Map<number, Product>();
  const add = (rows: Product[]) => {
    for (const r of rows) if (!found.has(r.id)) found.set(r.id, r);
  };

  // --- Exact / prefix SKU match (uses idx_sku index — always fast) ---
  const skuPrefix = `${trimmed}%`;
  add(
    await query<Product>(
      `SELECT ${cols} FROM products WHERE sku LIKE ? ORDER BY sku ASC LIMIT ?`,
      [skuPrefix, limit]
    )
  );
  if (found.size >= limit) return [...found.values()].slice(0, limit);

  // --- Prefix UPC (barcode) match (uses idx_upc index) ---
  {
    const foundIds = [...found.keys()];
    const excludeClause = foundIds.length
      ? `AND id NOT IN (${foundIds.map(() => "?").join(",")})`
      : "";
    add(
      await query<Product>(
        `SELECT ${cols} FROM products
         WHERE upc LIKE ? ${excludeClause}
         ORDER BY upc ASC LIMIT ?`,
        [skuPrefix, ...foundIds, limit - found.size]
      )
    );
    if (found.size >= limit) return [...found.values()].slice(0, limit);
  }

  // --- FULLTEXT search on (sku, description) for remaining slots ---
  const remaining = limit - found.size;
  const foundIds = [...found.keys()];
  const ftTerm = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `+${w}*`)   // boolean mode: each word must match, prefix wildcard
    .join(" ");

  const excludeClause = foundIds.length
    ? `AND id NOT IN (${foundIds.map(() => "?").join(",")})`
    : "";

  add(
    await query<Product>(
      `SELECT ${cols},
              MATCH(sku, description) AGAINST (? IN BOOLEAN MODE) AS _score
       FROM products
       WHERE MATCH(sku, description) AGAINST (? IN BOOLEAN MODE)
         ${excludeClause}
       ORDER BY _score DESC
       LIMIT ?`,
      [ftTerm, ftTerm, ...foundIds, remaining]
    )
  );

  return [...found.values()];
}
