import { notFound } from "next/navigation";
import { getPo } from "@/backend/services/po";
import { getCustomer } from "@/backend/services/customers";
import { getOrCreateQuotation } from "@/backend/services/quotations";
import { getNonVatSkus } from "@/backend/services/inventory";
import { SalesDocument, QuotePaymentTerms } from "@/components/SalesDocument";
import { QuotationPrintBar } from "./QuotationPrintBar";
import { QuotationPageCount } from "./QuotationPageCount";
import { getUserById } from "@/backend/auth";

export const dynamic = "force-dynamic";

export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPo(Number(id));
  if (!data) notFound();
  const { po, items } = data;
  const [customer, quote, creator, nonVat] = await Promise.all([
    getCustomer(po.customer_id),
    getOrCreateQuotation(po.id),
    getUserById(po.created_by),
    getNonVatSkus(items.map((it) => it.product_name)),
  ]);

  const issuedAt = new Date(quote.generated_at);
  const validUntil = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="max-w-[820px] mx-auto">
      <QuotationPrintBar />
      <SalesDocument
        id="quotation-doc"
        title="ใบเสนอราคา"
        headerExtra={<QuotationPageCount />}
        meta={[
          ["เลขที่เอกสาร :", quote.quote_number],
          ["วันที่ออก :", issuedAt.toLocaleDateString("th-TH")],
          ["ยืนราคาถึง :", validUntil.toLocaleDateString("th-TH")],
          ["อ้างอิง :", po.po_number],
        ]}
        customer={{ ...customer, name: po.customer_name ?? customer?.name ?? "" }}
        contactName={creator?.full_name}
        items={items.map((it) => ({ ...it, vatable: !nonVat.has(it.product_name) }))}
        notes={po.notes}
        payment={<QuotePaymentTerms creditTerm={po.credit_term_days} />}
        signatures={[
          { label: "ผู้เสนอราคา (ผู้ขาย)", name: creator?.full_name },
          { label: "ผู้อนุมัติ (ผู้ขาย)" },
          { label: "ผู้สั่งซื้อ (ลูกค้า)" },
        ]}
      />
    </div>
  );
}
