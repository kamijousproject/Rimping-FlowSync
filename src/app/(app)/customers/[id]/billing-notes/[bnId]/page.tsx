import { notFound } from "next/navigation";
import Image from "next/image";
import { getBillingNote } from "@/backend/services/billing-notes";
import { getCustomer } from "@/backend/services/customers";
import { fmtMoney } from "@/components/StatusBadge";
import { BillingNotePrintBar } from "./BillingNotePrintBar";

export const dynamic = "force-dynamic";

export default async function BillingNotePrintPage({
  params,
}: {
  params: Promise<{ id: string; bnId: string }>;
}) {
  const { id, bnId } = await params;
  const [bn, customer] = await Promise.all([
    getBillingNote(Number(bnId)),
    getCustomer(Number(id)),
  ]);
  if (!bn || !customer) notFound();

  const total = bn.items.reduce((s, it) => s + Number(it.amount), 0);

  return (
    <div className="max-w-[820px] mx-auto">
      <BillingNotePrintBar customerId={Number(id)} />

      <div className="bg-white border border-border shadow rounded-lg p-10 print:shadow-none print:border-0 print:rounded-none print:p-8">
        {/* Header: logo + seller info */}
        <div className="flex items-start justify-between pb-3 border-b-2 border-brand-600">
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
              <Image
                src="/logo.svg"
                alt="Rimping"
                width={48}
                height={48}
                style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }}
              />
            </div>
            <div className="text-xs leading-relaxed">
              <div className="text-base font-bold text-brand-800">
                บริษัท ตันตราภัณฑ์ซุปเปอร์มาร์เก็ต (1994) จำกัด
              </div>
              <div>199/8 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100</div>
              <div>Tel. 063-535-0299 or 093-130-0295 (คุณยา)</div>
              <div>Email: Dararat@rimping.com, Foodservice@rimping.com</div>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mt-4 mb-3">
          <div className="text-2xl font-bold text-brand-800">
            ใบวางบิล (Billing Note)
          </div>
        </div>

        {/* Customer + Doc info */}
        <div className="grid grid-cols-[1fr_auto] gap-6 text-xs border border-border rounded p-3">
          <div className="space-y-0.5">
            <div className="flex gap-2">
              <span className="text-muted shrink-0 w-24">ผู้ซื้อ / Customer</span>
              <span className="font-semibold">{customer.name}</span>
            </div>
            {customer.address && (
              <div className="flex gap-2">
                <span className="text-muted shrink-0 w-24">ที่อยู่ / Address</span>
                <span className="whitespace-pre-wrap">{customer.address}</span>
              </div>
            )}
            {customer.tax_id && (
              <div className="flex gap-2">
                <span className="text-muted shrink-0 w-24">เลขผู้เสียภาษี</span>
                <span className="font-mono">{customer.tax_id}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex gap-2">
                <span className="text-muted shrink-0 w-24">โทร.</span>
                <span>{customer.phone}</span>
              </div>
            )}
          </div>
          <div className="text-right space-y-0.5 min-w-[200px]">
            <div>
              <span className="text-muted">เลขที่</span>{" "}
              <span className="font-mono font-semibold">{bn.bn_number}</span>
            </div>
            <div>
              <span className="text-muted">วันที่ / Date</span>{" "}
              {new Date(bn.issued_date).toLocaleDateString("th-TH")}
            </div>
            {bn.due_date && (
              <div>
                <span className="text-muted">กำหนดชำระ</span>{" "}
                {new Date(bn.due_date).toLocaleDateString("th-TH")}
              </div>
            )}
            <div>
              <span className="text-muted">เลขที่ลูกค้า</span>{" "}
              <span className="font-mono">
                {customer.code || `C${String(customer.id).padStart(6, "0")}`}
              </span>
            </div>
          </div>
        </div>



        {/* Items table */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-50 text-xs text-muted">
                <th className="text-center p-2 w-8">#</th>
                <th className="text-left p-2">วันที่ออก Quotation / เลข Quotation</th>
                <th className="text-left p-2">เลขที่บิล</th>
                <th className="text-center p-2">จำนวน/บิล</th>
                <th className="text-right p-2">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {bn.items.map((it, idx) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="text-center p-2 text-muted text-xs">{idx + 1}</td>
                  <td className="p-2">
                    <div className="font-medium">{it.po_number}</div>
                    <div className="text-xs text-muted">
                      {new Date(it.po_date).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </td>
                  <td className="p-2 font-mono text-sm">
                    {it.tax_invoice_number || <span className="text-muted">—</span>}
                  </td>
                  <td className="text-center p-2">1</td>
                  <td className="text-right p-2 font-medium">{fmtMoney(it.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td colSpan={4} className="text-right p-2">ยอดรวมทั้งหมด</td>
                <td className="text-right p-2 text-brand-700 text-lg">{fmtMoney(total)} ฿</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {bn.notes && (
          <div className="text-sm mt-3">
            <span className="text-muted">หมายเหตุ:</span>{" "}
            <span className="whitespace-pre-wrap">{bn.notes}</span>
          </div>
        )}

        {/* Payment + signatures */}
        <div className="mt-4 grid grid-cols-2 gap-6 text-[11px] items-stretch">
          {/* Left: payment info + approver signature */}
          <div className="space-y-4">
            <div className="border border-border rounded p-3">
              <div className="font-semibold text-brand-800 mb-2">วิธีชำระเงิน / Payment Method</div>
              <div className="space-y-0.5">
                <div>โอนเงินเข้าบัญชีธนาคาร</div>
                <div>ชื่อบัญชี ธนาคารกรุงเทพ สาขาท่าแพ-เชียงใหม่</div>
                <div>เลขที่บัญชี : <span className="font-mono">251-5-01738-8</span> ประเภทบัญชี ออมทรัพย์</div>
                <div className="mt-1">Bangkok Bank : Account No. : 251-5-01738-8</div>
                <div>Account Name:</div>
                <div>TRNTRAPHAN SUPPERMARKET (1944) CO., LTD.</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] mb-1">ลงชื่อ ………………………………………………</div>
              <div className="text-[10px] text-muted">
                {bn.creator_name ? `( ${bn.creator_name} )` : ""}
              </div>
              <div className="text-[11px] mt-1">ผู้อนุมัติ / Sale FoodService / วันที่ ……/……/……</div>
            </div>
          </div>

          {/* Right: maker + receiver signatures */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="text-[11px] mb-6">ลงชื่อ ………………………………………………</div>
              <div className="text-[10px] text-muted">
                {bn.creator_name ? `( ${bn.creator_name} )` : ""}
              </div>
              <div className="text-[11px] mt-1">ผู้จัดทำเอกสารวางบิล / วันที่ ……/……/……</div>
            </div>
            <div>
              <div className="text-[11px] mb-6">ลงชื่อ ………………………………………………</div>
              <div className="text-[10px] text-muted">(………………………………………………)</div>
              <div className="text-[11px] mt-1">ผู้รับเอกสารใบวางบิล / วันที่ ………………………</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
