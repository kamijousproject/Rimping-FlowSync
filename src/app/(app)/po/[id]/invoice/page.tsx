import { notFound } from "next/navigation";
import Image from "next/image";
import { getPo } from "@/backend/services/po";
import { getCustomer } from "@/backend/services/customers";
import { getInvoice } from "@/backend/services/payments";
import { fmtMoney } from "@/components/StatusBadge";
import { bahtText } from "@/lib/bahtText";
import { InvoicePrintBar } from "./InvoicePrintBar";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inv?: string }>;
}) {
  const { id } = await params;
  const { inv } = await searchParams;
  const data = await getPo(Number(id));
  if (!data) notFound();
  const { po, items } = data;
  const customer = await getCustomer(po.customer_id);

  const invoice = inv ? await getInvoice(Number(inv)) : null;
  const invNo =
    invoice?.invoice_number ||
    `INV-${po.po_number.replace("PO", "")}-PREVIEW`;
  const amount = Number(invoice?.amount ?? po.remaining_amount);
  const issuedAt = invoice?.generated_at
    ? new Date(invoice.generated_at)
    : new Date();
  const dueDate = po.due_date
    ? new Date(po.due_date).toLocaleDateString("th-TH")
    : "-";

  // VAT 7% breakdown (assume PO total is VAT inclusive)
  const grandTotal = Number(po.total);
  const subtotal = +(grandTotal / 1.07).toFixed(2);
  const vat = +(grandTotal - subtotal).toFixed(2);

  const poDate = new Date(po.created_at).toLocaleDateString("th-TH");

  return (
    <div className="max-w-[820px] mx-auto">
      <InvoicePrintBar />
      <div
        className="bg-white border border-border shadow rounded-lg p-10 print:shadow-none print:border-0 print:rounded-none print:p-8"
        id="invoice-doc"
      >
        {/* Header: logo + seller info */}
        <div className="flex items-start justify-between pb-3 border-b-2 border-brand-600">
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
              <Image
                src="/logo.svg"
                alt="Rimping"
                width={48}
                height={48}
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
              <div>
                199/8 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100
              </div>
              <div>Tel. 063-535-0299 or 093-130-0295 (คุณยา)</div>
              <div>
                Email: Dararat@rimping.com, Foodservice@rimping.com
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mt-4 mb-3">
          <div className="text-2xl font-bold text-brand-800">
            ใบวางบิล / ใบแจ้งหนี้ (Invoice)
          </div>
        </div>

        {/* Customer + Doc info */}
        <div className="grid grid-cols-[1fr_auto] gap-6 text-xs border border-border rounded p-3">
          <div className="space-y-0.5">
            <div className="flex gap-2">
              <span className="text-muted shrink-0 w-20">ผู้ซื้อ /</span>
              <span className="font-semibold">{po.customer_name}</span>
            </div>
            {customer?.address && (
              <div className="flex gap-2">
                <span className="text-muted shrink-0 w-20">
                  ที่อยู่ / Address
                </span>
                <span className="whitespace-pre-wrap">
                  {customer.address}
                </span>
              </div>
            )}
            {customer?.tax_id && (
              <div className="flex gap-2">
                <span className="text-muted shrink-0 w-20">
                  เลขผู้เสียภาษี
                </span>
                <span className="font-mono">{customer.tax_id}</span>
              </div>
            )}
            {customer?.phone && (
              <div className="flex gap-2">
                <span className="text-muted shrink-0 w-20">โทร.</span>
                <span>{customer.phone}</span>
              </div>
            )}
          </div>
          <div className="text-right space-y-0.5 min-w-[220px]">
            <div>
              <span className="text-muted">เลขที่ / No.</span>{" "}
              <span className="font-mono font-semibold">{invNo}</span>
            </div>
            <div>
              <span className="text-muted">วันที่ / Date</span>{" "}
              {issuedAt.toLocaleDateString("th-TH")}
            </div>
            <div>
              <span className="text-muted">เลขที่ลูกค้า</span>{" "}
              <span className="font-mono">
                {customer?.code || `C${String(po.customer_id).padStart(6, "0")}`}
              </span>
            </div>
            <div>
              <span className="text-muted">อ้างอิง PO</span>{" "}
              <span className="font-mono">{po.po_number}</span>
            </div>
            <div>
              <span className="text-muted">กำหนดชำระ</span> {dueDate}
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-xs mt-4 border-collapse">
          <thead>
            <tr className="bg-brand-50 text-brand-800">
              <th className="p-2 border border-brand-200 w-10">
                ที่
                <div className="text-[10px] font-normal">Item</div>
              </th>
              <th className="text-left p-2 border border-brand-200">
                วันที่ซื้อสินค้า / และรายละเอียด
              </th>
              <th className="p-2 border border-brand-200 w-16">
                จำนวน
                <div className="text-[10px] font-normal">Qty</div>
              </th>
              <th className="p-2 border border-brand-200 w-28">
                เลขที่บิล
                <div className="text-[10px] font-normal">Invoice NO.</div>
              </th>
              <th className="text-right p-2 border border-brand-200 w-28">
                จำนวนเงิน / Amount
                <div className="text-[10px] font-normal">บาท / Baht</div>
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
                  <div>
                    <span className="text-muted mr-2">{poDate}</span>
                    <span className="font-medium">{it.product_name}</span>
                  </div>
                  {it.description && (
                    <div className="text-[11px] text-muted">
                      {it.description}
                    </div>
                  )}
                </td>
                <td className="text-center p-2 border border-border">
                  {Number(it.quantity)} {it.unit}
                </td>
                <td className="text-center p-2 border border-border font-mono">
                  {po.po_number}
                </td>
                <td className="text-right p-2 border border-border font-medium">
                  {fmtMoney(it.line_total)}
                </td>
              </tr>
            ))}
            {/* Filler rows */}
            {items.length < 8 &&
              Array.from({ length: 8 - items.length }).map((_, i) => (
                <tr key={`pad-${i}`} className="h-7">
                  <td className="border border-border" />
                  <td className="border border-border" />
                  <td className="border border-border" />
                  <td className="border border-border" />
                  <td className="border border-border" />
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                rowSpan={4}
                className="border border-border align-top p-2 text-[11px]"
              >
                <div className="font-semibold text-brand-800">
                  ตัวอักษร / In Letter
                </div>
                <div className="italic mt-1">({bahtText(grandTotal)})</div>
              </td>
              <td className="p-2 border border-border text-right text-muted">
                รวมเงิน / Total
              </td>
              <td className="text-right p-2 border border-border">
                {fmtMoney(subtotal)}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-border text-right text-muted">
                ภาษีมูลค่าเพิ่ม 7%
              </td>
              <td className="text-right p-2 border border-border">
                {fmtMoney(vat)}
              </td>
            </tr>
            <tr className="bg-brand-50 font-bold">
              <td className="p-2 border border-brand-200 text-right">
                รวมสุทธิ / Grand Total
              </td>
              <td className="text-right p-2 border border-brand-200 text-brand-800 text-base">
                {fmtMoney(grandTotal)}
              </td>
            </tr>
            {invoice && Number(po.paid_amount) > 0 && (
              <tr>
                <td className="p-2 border border-border text-right text-muted">
                  ชำระแล้ว
                </td>
                <td className="text-right p-2 border border-border text-brand-700">
                  {fmtMoney(po.paid_amount)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* Show invoice-specific amount if it differs from grand total */}
        {invoice && Math.abs(amount - grandTotal) > 0.01 && (
          <div className="mt-2 text-right text-xs">
            <span className="text-muted">ยอดเรียกเก็บใน Invoice นี้: </span>
            <span className="font-bold text-brand-800">
              {fmtMoney(amount)} ฿
            </span>
          </div>
        )}

        {/* Payment + signatures */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-[11px]">
          <div className="border border-border rounded p-3">
            <div className="font-semibold text-brand-800 mb-1">
              วิธีชำระเงิน / Payment Method
            </div>
            <div className="flex gap-3 items-start">
              <div className="flex-1">
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
              <div className="shrink-0 text-center">
                <Image
                  src="/payment-qr.png"
                  alt="QR PromptPay"
                  width={80}
                  height={80}
                  className="border border-border rounded"
                />
                <div className="text-[9px] text-muted mt-0.5">สแกนชำระเงิน</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-center">
              <div className="border-t border-foreground pt-1 text-[11px]">
                ลงชื่อ ผู้จัดทำเอกสารวางบิล
              </div>
              <div className="text-muted text-[10px]">
                วันที่ ………/………/…………
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-foreground pt-1 text-[11px]">
                ลงชื่อ ผู้อนุมัติ
              </div>
              <div className="text-muted text-[10px]">
                Sale FoodService · วันที่ ………/………/…………
              </div>
            </div>
          </div>
        </div>

        {/* Receiver signature */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-[11px]">
          <div />
          <div className="text-center">
            <div className="border-t border-foreground pt-1">
              ลงชื่อ ผู้รับเอกสารใบวางบิล
            </div>
            <div className="text-muted text-[10px]">
              วันที่ ………/………/…………
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
