// ข้อมูลผู้ขายที่ใช้บนใบส่งของ/ใบกำกับภาษี และใบเสร็จรับเงิน
export const COMPANY = {
  name: "บริษัท ตันตราภัณฑ์ซุปเปอร์มาร์เก็ต (1994) จำกัด",
  branch: "สำนักงานใหญ่",
  address: "199/8 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100",
  taxId: "0505537001981",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transfer: "โอนเงิน",
  cash: "เงินสด",
  cheque: "เช็ค",
  credit_card: "บัตรเครดิต",
};

/** วันที่แบบ 01/10/2569 */
export function thDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** วันที่ใบกำกับภาษี = วันที่สร้างเอกสาร (PO created_at) */
export function taxInvoiceDate(po: { created_at: Date | string }): Date {
  return new Date(po.created_at);
}
