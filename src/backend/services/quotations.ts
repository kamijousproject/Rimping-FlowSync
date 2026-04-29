import { query, exec } from "../db";

export type Quotation = {
  id: number;
  quote_number: string;
  po_id: number;
  generated_at: Date;
};

async function generateQuoteNumber(): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM quotations WHERE quote_number LIKE ?",
    [`QT${ym}-%`]
  );
  const n = Number(rows[0]?.c || 0) + 1;
  return `QT${ym}-${String(n).padStart(4, "0")}`;
}

/**
 * Returns the quotation for a PO; lazily creates one with a running number
 * the first time it's requested. Subsequent calls return the same quote.
 */
export async function getOrCreateQuotation(poId: number): Promise<Quotation> {
  const existing = await query<Quotation>(
    "SELECT * FROM quotations WHERE po_id = ?",
    [poId]
  );
  if (existing[0]) return existing[0];

  // Retry on rare unique collision when two requests race
  for (let attempt = 0; attempt < 3; attempt++) {
    const quote_number = await generateQuoteNumber();
    try {
      await exec(
        "INSERT INTO quotations (quote_number, po_id) VALUES (?, ?)",
        [quote_number, poId]
      );
      const rows = await query<Quotation>(
        "SELECT * FROM quotations WHERE po_id = ?",
        [poId]
      );
      return rows[0];
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code !== "ER_DUP_ENTRY") throw e;
      // someone else inserted first — read again
      const again = await query<Quotation>(
        "SELECT * FROM quotations WHERE po_id = ?",
        [poId]
      );
      if (again[0]) return again[0];
    }
  }
  throw new Error("ไม่สามารถสร้างเลขที่ใบเสนอราคาได้");
}
