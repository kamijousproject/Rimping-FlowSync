import { notFound } from "next/navigation";
import { getPo } from "@/backend/services/po";
import { getCustomer } from "@/backend/services/customers";
import { getPaymentById, getOrCreateReceiptNumber } from "@/backend/services/payments";
import { getUserById } from "@/backend/auth";
import { fmtMoney } from "@/components/StatusBadge";
import { RimpingLogo } from "@/components/RimpingLogo";
import { bahtText } from "@/lib/bahtText";
import { COMPANY, PAYMENT_METHOD_LABEL, taxInvoiceDate, thDate } from "@/lib/company";
import { billingParty } from "@/lib/billing";
import { InvoicePrintBar } from "../../invoice/InvoicePrintBar";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}

/** ใบเสร็จรับเงิน (สลิป 80mm) — 1 ใบต่อการชำระ 1 ครั้ง */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
  const [data, payment] = await Promise.all([
    getPo(Number(id)),
    getPaymentById(Number(paymentId)),
  ]);
  if (!data || !payment || payment.po_id !== data.po.id) notFound();
  const { po, items } = data;

  const [receiptNo, customer, receiver] = await Promise.all([
    getOrCreateReceiptNumber(payment.id),
    getCustomer(po.customer_id),
    getUserById(payment.recorded_by),
  ]);
  const amount = Number(payment.amount);
  const buyer = billingParty({ ...customer, name: po.customer_name ?? customer?.name ?? "" });

  return (
    <div className="max-w-[340px] mx-auto">
      {/* สลิป 80mm: override ขนาดกระดาษ A4 จาก globals.css */}
      <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } #receipt-doc { width: 74mm; } }`}</style>
      <InvoicePrintBar />
      <div
        id="receipt-doc"
        className="bg-white border border-border shadow rounded-lg p-5 text-[12px] leading-relaxed print:shadow-none print:border-0 print:rounded-none print:p-0"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <RimpingLogo size={64} />
          <div className="font-semibold mt-1">{COMPANY.name}</div>
          <div className="text-[11px]">{COMPANY.address}</div>
          <div className="text-[11px]">
            เลขผู้เสียภาษี {COMPANY.taxId} ({COMPANY.branch})
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-4">
          <div className="text-base font-bold">ใบเสร็จรับเงิน</div>
          <div className="text-[10px] tracking-[0.2em] text-muted">RECEIPT</div>
        </div>

        <div className="bg-brand-50 rounded-xl text-center py-3 mt-2">
          <div className="text-brand-700 text-[11px]">รับชำระแล้ว</div>
          <div className="text-2xl font-bold text-brand-800">฿{fmtMoney(amount)}</div>
          <div className="text-[11px] text-muted">{bahtText(amount)}</div>
          <div className="font-semibold mt-1">
            {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}
          </div>
        </div>

        <div className="space-y-0.5 mt-3">
          <Row label="เลขที่ใบเสร็จ" value={receiptNo} />
          <Row label="วันที่รับชำระ" value={thDate(payment.paid_at)} />
          <Row label="อ้างอิงใบกำกับภาษี" value={po.tax_invoice_number || "-"} />
          <Row
            label="วันที่ใบกำกับภาษี"
            value={po.tax_invoice_number ? thDate(taxInvoiceDate(po)) : "-"}
          />
          <Row label="อ้างอิงคำสั่งซื้อ" value={po.po_number} />
        </div>

        <div className="bg-gray-50 rounded-lg px-3 py-2 mt-3">
          <div className="text-[11px] text-muted">ได้รับเงินจาก</div>
          <div className="font-semibold">{buyer.name}</div>
          {buyer.tax_id && (
            <div className="text-[11px] text-muted">
              {buyer.branch ? `${buyer.branch} · ` : ""}เลขผู้เสียภาษี {buyer.tax_id}
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="text-[11px] text-muted">รายการ</div>
          {items.map((it) => (
            <div key={it.id} className="flex justify-between gap-3 py-0.5">
              <div className="min-w-0">
                <div className="font-semibold">{it.description || it.product_name}</div>
                <div className="text-[11px] text-muted">
                  {Number(it.quantity)} {it.unit} × {fmtMoney(it.unit_price)}
                </div>
              </div>
              <div className="shrink-0">{fmtMoney(it.line_total)}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-2 pt-2 space-y-1">
          <div className="flex justify-between px-1">
            <span>ยอดตามเอกสาร</span>
            <span>{fmtMoney(po.total)}</span>
          </div>
          <div className="flex justify-between bg-brand-50 rounded px-1 py-1 text-sm font-bold text-brand-800">
            <span>รับชำระครั้งนี้</span>
            <span>{fmtMoney(amount)}</span>
          </div>
          <div className="text-[11px] text-muted px-1">ราคารวมภาษีมูลค่าเพิ่มแล้ว</div>
        </div>

        <div className="mt-8 text-center">
          <div className="border-t border-foreground mx-6" />
          <div className="font-semibold mt-1">{receiver?.full_name ?? ""}</div>
          <div className="text-[11px] text-muted">ผู้รับเงิน</div>
        </div>

        <div className="mt-5 text-center">
          <div className="font-semibold">ขอบคุณที่ใช้บริการ</div>
          <div className="text-[10px] text-muted">ออกเอกสารโดยระบบ FlowSync</div>
        </div>
      </div>
    </div>
  );
}
