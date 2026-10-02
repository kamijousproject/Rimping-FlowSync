// ผู้ซื้อที่แสดงบนเอกสาร (ใบเสนอราคา / ใบกำกับภาษี)
// ลูกค้ากลุ่มที่ตั้งข้อมูลนิติบุคคลไว้ (เช่น 7-11 → บจก.ซีพี ออลล์) ใช้ชื่อ/ที่อยู่/เลขภาษีของกลุ่ม
// และสาขา = รหัสร้านท้าย customers.code (711-23374 → สาขาที่ 23374)
export type BillingSource = {
  name: string;
  code?: string | null;
  address?: string | null;
  tax_id?: string | null;
  group_billing_name?: string | null;
  group_billing_address?: string | null;
  group_billing_tax_id?: string | null;
};

export function billingParty<T extends BillingSource>(c: T): T & { branch: string | null } {
  if (!c.group_billing_name) return { ...c, branch: null };
  const storeNo = c.code?.match(/(\d+)\s*$/)?.[1];
  return {
    ...c,
    name: c.group_billing_name,
    address: c.group_billing_address ?? null,
    tax_id: c.group_billing_tax_id ?? null,
    branch: storeNo ? `สาขาที่ ${storeNo}` : null,
  };
}
