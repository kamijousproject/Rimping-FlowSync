const r2 = (n: number) => Math.round(n * 100) / 100;
/** ถอด VAT: ราคารวม VAT × 100 ÷ 107 */
const exVat = (n: number) => r2((n * 100) / 107);

/**
 * แยก VAT ออกจากราคาขาย (ราคาใน PO เป็นราคาขายจริงเสมอ)
 * - vatable=true  (inventory.sc = 100): ราคารวม VAT แล้ว → ถอด VAT 7% ออก
 * - vatable=false (inventory.sc = 200): สินค้าไม่มี VAT → มูลค่าก่อนภาษี = ราคาเต็ม
 * ยอดภาษีคิดจากยอดรวมทั้งบิล (ไม่ใช่รวมรายบรรทัด) เพื่อไม่ให้ปัดเศษสะสม
 */
export function vatBreakdown<T extends { line_total: number; vatable: boolean }>(lines: T[]) {
  const rows = lines.map((l) => ({
    ...l,
    pre_tax: l.vatable ? exVat(Number(l.line_total)) : Number(l.line_total),
  }));
  const vatableGross = r2(lines.filter((l) => l.vatable).reduce((s, l) => s + Number(l.line_total), 0));
  const exempt = r2(lines.filter((l) => !l.vatable).reduce((s, l) => s + Number(l.line_total), 0));
  const vatBase = exVat(vatableGross);
  const vat = r2(vatableGross - vatBase);
  return { rows, vatBase, vat, exempt, total: r2(vatableGross + exempt) };
}
