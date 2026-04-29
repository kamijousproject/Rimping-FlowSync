import { notFound } from "next/navigation";
import Image from "next/image";
import { getPo } from "@/backend/services/po";
import { getCustomer } from "@/backend/services/customers";
import { getOrCreateQuotation } from "@/backend/services/quotations";
import { fmtMoney } from "@/components/StatusBadge";
import { bahtText } from "@/lib/bahtText";
import { QuotationPrintBar } from "./QuotationPrintBar";

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
  const customer = await getCustomer(po.customer_id);
  const quote = await getOrCreateQuotation(po.id);

  const quoteNo = quote.quote_number;
  const issuedAt = new Date(quote.generated_at);
  const total = Number(po.total);

  return (
    <div className="max-w-[820px] mx-auto">
      <QuotationPrintBar />
      <div
        className="bg-white border border-border shadow rounded-lg p-10 print:shadow-none print:border-0 print:rounded-none print:p-8"
        id="quotation-doc"
      >
        {/* Header: issuer + title */}
        <div className="flex items-start justify-between border-b-2 border-brand-600 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center shrink-0"
            >
              <Image
                src="/logo.svg"
                alt="Rimping"
                width={40}
                height={40}
                style={{
                  filter: "brightness(0) invert(1)",
                  objectFit: "contain",
                }}
              />
            </div>
            <div className="text-xs leading-relaxed">
              <div className="text-base font-bold text-brand-800">
                บริษัท ตันตราภัณฑ์ซุปเปอร์มาร์เก็ต (1994) จำกัด
              </div>
              <div className="text-muted">
                Trntraphan Suppermarket (1944) Co., Ltd.
              </div>
              <div className="mt-1">
                199/8 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100
              </div>
              <div>Tel. 063-535-0299, 093-130-0295 (คุณยา)</div>
              <div>Dararat@rimping.com, Foodservice@rimping.com</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-brand-700">QUOTATION</div>
            <div className="text-sm text-foreground">ใบเสนอราคา</div>
            <div className="text-sm mt-2">
              เลขที่: <span className="font-mono">{quoteNo}</span>
            </div>
            <div className="text-xs text-muted">
              วันที่: {issuedAt.toLocaleDateString("th-TH")}
            </div>
            <div className="text-xs text-muted">
              อ้างอิง PO:{" "}
              <span className="font-mono">{po.po_number}</span>
            </div>
          </div>
        </div>

        {/* Customer + Payment block */}
        <div className="grid grid-cols-2 gap-6 mt-6 text-sm">
          <div className="border border-border rounded p-3">
            <div className="text-xs text-muted mb-1">
              ผู้ซื้อ / Customer
            </div>
            <div className="font-semibold">{po.customer_name}</div>
            {customer?.contact_person && (
              <div className="text-xs">
                ผู้ติดต่อ: {customer.contact_person}
              </div>
            )}
            {customer?.address && (
              <div className="text-xs mt-1 whitespace-pre-wrap">
                {customer.address}
              </div>
            )}
            <div className="text-xs mt-1">
              {customer?.phone && <>โทร. {customer.phone}</>}
              {customer?.tax_id && (
                <span className="ml-2">เลขประจำตัวผู้เสียภาษี: {customer.tax_id}</span>
              )}
            </div>
          </div>
          <div className="border border-border rounded p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">การชำระ:</span>
              <span>เครดิต {po.credit_term_days} วัน</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">วันที่เสนอ:</span>
              <span>{issuedAt.toLocaleDateString("th-TH")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">ยืนราคาถึง:</span>
              <span>
                {new Date(
                  issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000
                ).toLocaleDateString("th-TH")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">สกุลเงิน:</span>
              <span>บาท (THB)</span>
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mt-6 border-collapse">
          <thead>
            <tr className="bg-brand-50 text-brand-800 text-xs">
              <th className="p-2 border border-brand-200 w-10">ลำดับ</th>
              <th className="text-left p-2 border border-brand-200">
                รายการสินค้า / Description
              </th>
              <th className="text-right p-2 border border-brand-200 w-20">
                จำนวน
              </th>
              <th className="text-left p-2 border border-brand-200 w-16">
                หน่วย
              </th>
              <th className="text-right p-2 border border-brand-200 w-24">
                ราคา/หน่วย
              </th>
              <th className="text-right p-2 border border-brand-200 w-28">
                จำนวนเงิน
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id}>
                <td className="text-center p-2 border border-border">
                  {idx + 1}
                </td>
                <td className="p-2 border border-border">
                  <div className="font-medium">{it.product_name}</div>
                  {it.description && (
                    <div className="text-xs text-muted">{it.description}</div>
                  )}
                </td>
                <td className="text-right p-2 border border-border">
                  {Number(it.quantity)}
                </td>
                <td className="p-2 border border-border">{it.unit}</td>
                <td className="text-right p-2 border border-border">
                  {fmtMoney(it.unit_price)}
                </td>
                <td className="text-right p-2 border border-border font-medium">
                  {fmtMoney(it.line_total)}
                </td>
              </tr>
            ))}
            {/* Filler rows for visual consistency when few items */}
            {items.length < 5 &&
              Array.from({ length: 5 - items.length }).map((_, i) => (
                <tr key={`pad-${i}`} className="h-8">
                  <td className="border border-border" />
                  <td className="border border-border" />
                  <td className="border border-border" />
                  <td className="border border-border" />
                  <td className="border border-border" />
                  <td className="border border-border" />
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr className="bg-brand-50 font-bold">
              <td
                colSpan={5}
                className="p-2 text-right border border-brand-200"
              >
                รวมสุทธิ / Grand Total
              </td>
              <td className="text-right p-2 border border-brand-200 text-brand-800 text-lg">
                {fmtMoney(total)} ฿
              </td>
            </tr>
            <tr>
              <td
                colSpan={6}
                className="p-2 text-center border border-border italic text-xs"
              >
                ({bahtText(total)})
              </td>
            </tr>
          </tfoot>
        </table>

        {po.notes && (
          <div className="mt-4 text-xs">
            <div className="font-semibold text-brand-800 mb-1">หมายเหตุ:</div>
            <div className="whitespace-pre-wrap border border-border rounded p-2">
              {po.notes}
            </div>
          </div>
        )}

        {/* Payment instructions */}
        <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div className="border border-border rounded p-3">
            <div className="font-semibold text-brand-800 mb-1">
              วิธีชำระเงิน / Payment Method
            </div>
            <div>โอนเงินเข้าบัญชีธนาคาร</div>
            <div className="mt-1">
              ชื่อบัญชี ธนาคารกรุงเทพ สาขาท่าแพ-เชียงใหม่
            </div>
            <div>
              เลขที่บัญชี:{" "}
              <span className="font-mono">251-5-01738-8</span>
            </div>
            <div>ประเภทบัญชี: ออมทรัพย์</div>
            <div className="mt-1 text-muted">
              Bangkok Bank · Account No. 251-5-01738-8
            </div>
            <div className="text-muted">
              Account Name: TRNTRAPHAN SUPPERMARKET (1944) CO., LTD.
            </div>
          </div>
          <div className="border border-border rounded p-3">
            <div className="font-semibold text-brand-800 mb-1">
              เงื่อนไข / Terms
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>ราคารวมภาษีมูลค่าเพิ่มแล้ว</li>
              <li>ยืนราคา 30 วันนับจากวันที่เสนอ</li>
              <li>เครดิต {po.credit_term_days} วันนับจากวันที่ส่งของ</li>
              <li>กรุณายืนยันการสั่งซื้อด้วยลายเซ็นในเอกสาร</li>
            </ul>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-12 text-xs">
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              ลงชื่อ ผู้เสนอราคา
            </div>
            <div className="text-muted mt-1">
              วันที่ ………/………/…………
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              ลงชื่อ ผู้สั่งซื้อ / ลูกค้า
            </div>
            <div className="text-muted mt-1">
              วันที่ ………/………/…………
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
