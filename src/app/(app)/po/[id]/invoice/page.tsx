import { notFound } from "next/navigation";
import { getPo } from "@/backend/services/po";
import { getInvoice } from "@/backend/services/payments";
import { fmtMoney } from "@/components/StatusBadge";
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

  return (
    <div className="max-w-[800px] mx-auto">
      <InvoicePrintBar />
      <div
        className="bg-white border border-border shadow rounded-lg p-10 print:shadow-none print:border-0 print:rounded-none"
        id="invoice-doc"
      >
        <div className="flex items-start justify-between border-b-2 border-brand-600 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-2xl">
              R
            </div>
            <div>
              <div className="text-2xl font-bold text-brand-800">
                Rimping
              </div>
              <div className="text-xs text-muted">
                FlowSync · ระบบขายแบบสินเชื่อ
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-brand-700">INVOICE</div>
            <div className="text-sm">
              เลขที่: <span className="font-mono">{invNo}</span>
            </div>
            <div className="text-xs text-muted">
              ออกเมื่อ {issuedAt.toLocaleString("th-TH")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <div className="text-xs text-muted">ลูกค้า</div>
            <div className="font-semibold">{po.customer_name}</div>
            <div className="text-xs text-muted mt-2">
              อ้างอิง PO: <span className="font-mono">{po.po_number}</span>
            </div>
            <div className="text-xs text-muted">
              เครดิต: {po.credit_term_days} วัน · กำหนดชำระ: {dueDate}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">ยอดเรียกเก็บ</div>
            <div className="text-3xl font-bold text-brand-700">
              {fmtMoney(amount)} ฿
            </div>
            <div className="text-xs text-muted mt-1">
              (ยอดคงค้าง PO: {fmtMoney(po.remaining_amount)} ฿)
            </div>
          </div>
        </div>

        <table className="w-full text-sm mt-6 border-collapse">
          <thead>
            <tr className="bg-brand-50 text-brand-800">
              <th className="text-left p-2 border border-brand-200">รายการ</th>
              <th className="text-right p-2 border border-brand-200 w-20">
                จำนวน
              </th>
              <th className="text-left p-2 border border-brand-200 w-20">
                หน่วย
              </th>
              <th className="text-right p-2 border border-brand-200 w-28">
                ราคา/หน่วย
              </th>
              <th className="text-right p-2 border border-brand-200 w-28">
                รวม
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
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
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="p-2 text-right border border-border">
                ยอดรวม PO
              </td>
              <td className="text-right p-2 border border-border">
                {fmtMoney(po.total)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="p-2 text-right border border-border">
                ชำระแล้ว
              </td>
              <td className="text-right p-2 border border-border text-brand-700">
                {fmtMoney(po.paid_amount)}
              </td>
            </tr>
            <tr className="bg-brand-50 font-bold">
              <td colSpan={4} className="p-2 text-right border border-brand-200">
                ยอดเรียกเก็บใน Invoice นี้
              </td>
              <td className="text-right p-2 border border-brand-200 text-brand-800 text-lg">
                {fmtMoney(amount)} ฿
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 text-xs text-muted">
          กรุณาชำระเงินตามยอดข้างต้น โดยอ้างอิงเลขที่ Invoice และ PO
          จากนั้นส่งสลิปการชำระเงินกลับมาที่บริษัทเพื่อบันทึกการชำระ
        </div>

        <div className="mt-12 grid grid-cols-2 gap-8 text-xs">
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              ผู้ออก Invoice
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              ผู้รับ / ผู้ชำระเงิน
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
