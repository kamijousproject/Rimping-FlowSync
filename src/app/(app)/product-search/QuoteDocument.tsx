"use client";
import { SalesDocument, QuotePaymentTerms } from "@/components/SalesDocument";

export type QuoteDocItem = {
  product_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

export type QuoteDocCustomer = {
  name: string;
  contact_person: string | null;
  address: string | null;
  phone: string | null;
  tax_id: string | null;
};

/**
 * Printable ใบเสนอราคา rendered straight from in-memory form state — no PO and
 * no quotation row exists yet, so there is no document number to show. Carries
 * id="quotation-doc" to inherit the shared A4 print rules in globals.css.
 */
export function QuoteDocument({
  customer,
  items,
  nonVatSkus,
  notes,
  creditTerm,
  issuedAt,
  creatorName,
}: {
  customer: QuoteDocCustomer | null;
  items: QuoteDocItem[];
  nonVatSkus: Set<string>;
  notes: string;
  creditTerm: number;
  issuedAt: Date | null;
  creatorName: string | null;
}) {
  const validUntil = issuedAt
    ? new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <SalesDocument
      id="quotation-doc"
      title="ใบเสนอราคา"
      meta={[
        ["เลขที่เอกสาร :", "ยังไม่ออกเลขที่"],
        ["วันที่ออก :", issuedAt ? issuedAt.toLocaleDateString("th-TH") : "—"],
        ["ยืนราคาถึง :", validUntil ? validUntil.toLocaleDateString("th-TH") : "—"],
      ]}
      customer={customer ?? { name: "………………………………………………" }}
      contactName={creatorName}
      items={items.map((it, idx) => ({
        ...it,
        id: idx,
        line_total: Number(it.quantity || 0) * Number(it.unit_price || 0),
        vatable: !nonVatSkus.has(it.product_name),
      }))}
      notes={notes}
      payment={<QuotePaymentTerms creditTerm={creditTerm} />}
      signatures={[
        { label: "ผู้เสนอราคา (ผู้ขาย)", name: creatorName },
        { label: "ผู้อนุมัติ (ผู้ขาย)" },
        { label: "ผู้สั่งซื้อ (ลูกค้า)" },
      ]}
    />
  );
}
