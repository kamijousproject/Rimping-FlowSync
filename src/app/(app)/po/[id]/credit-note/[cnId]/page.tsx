import { notFound } from "next/navigation";
import Image from "next/image";
import { getPo } from "@/backend/services/po";
import { getCustomer } from "@/backend/services/customers";
import { getCreditNote } from "@/backend/services/credit-notes";
import { fmtMoney } from "@/components/StatusBadge";
import { bahtText } from "@/lib/bahtText";
import { CreditNotePrintBar } from "./CreditNotePrintBar";

export const dynamic = "force-dynamic";

export default async function CreditNotePage({
  params,
}: {
  params: Promise<{ id: string; cnId: string }>;
}) {
  const { id, cnId } = await params;
  const [data, cn] = await Promise.all([
    getPo(Number(id)),
    getCreditNote(Number(cnId)),
  ]);
  if (!data || !cn) notFound();
  const { po } = data;
  const customer = await getCustomer(po.customer_id);

  const issuedAt = new Date(cn.created_at);

  return (
    <div className="max-w-[820px] mx-auto">
      <CreditNotePrintBar />

      <div
        className="bg-white border border-border shadow rounded-lg p-10 print:shadow-none print:border-0 print:rounded-none print:p-8"
        id="cn-doc"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-orange-500 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
              <Image
                src="/logo.svg"
                alt="Rimping"
                width={40}
                height={40}
                style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }}
              />
            </div>
            <div className="text-xs leading-relaxed">
              <div className="text-base font-bold text-brand-800">
                บริษัท ตันตราภัณฑ์ซุปเปอร์มาร์เก็ต (1994) จำกัด
              </div>
              <div className="text-muted">Trntraphan Suppermarket (1944) Co., Ltd.</div>
              <div className="mt-1">199/8 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100</div>
              <div>Tel. 063-535-0299, 093-130-0295 (คุณยา)</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-orange-600">ใบลดหนี้</div>
            <div className="text-sm text-muted">Credit Note</div>
            <div className="text-sm mt-2">
              เลขที่: <span className="font-mono font-semibold">{cn.cn_number}</span>
            </div>
            <div className="text-xs text-muted">
              วันที่: {issuedAt.toLocaleDateString("th-TH")}
            </div>
            <div className="text-xs text-muted">
              อ้างอิง PO: <span className="font-mono">{po.po_number}</span>
            </div>
          </div>
        </div>

        {/* Customer block */}
        <div className="grid grid-cols-2 gap-6 mt-6 text-sm">
          <div className="border border-border rounded p-3">
            <div className="text-xs text-muted mb-1">ผู้ซื้อ / Customer</div>
            <div className="font-semibold">{po.customer_name}</div>
            {customer?.contact_person && (
              <div className="text-xs">ผู้ติดต่อ: {customer.contact_person}</div>
            )}
            {customer?.address && (
              <div className="text-xs mt-1 whitespace-pre-wrap">{customer.address}</div>
            )}
            {customer?.tax_id && (
              <div className="text-xs mt-1">เลขประจำตัวผู้เสียภาษี: {customer.tax_id}</div>
            )}
          </div>
          <div className="border border-border rounded p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">เลขที่ใบกำกับภาษีอ้างอิง:</span>
              <span className="font-mono">{po.tax_invoice_number || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">วันที่ออกใบลดหนี้:</span>
              <span>{issuedAt.toLocaleDateString("th-TH")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">ผู้จัดทำ:</span>
              <span>{cn.creator_name || "-"}</span>
            </div>
          </div>
        </div>

        {cn.reason && (
          <div className="mt-4 text-sm">
            <span className="text-muted">เหตุผล: </span>{cn.reason}
          </div>
        )}

        {/* Items table */}
        <table className="w-full text-sm mt-6 border-collapse">
          <thead>
            <tr className="bg-orange-50 text-orange-800 text-xs">
              <th className="p-2 border border-orange-200 w-10">ลำดับ</th>
              <th className="text-left p-2 border border-orange-200">รายการสินค้า / Description</th>
              <th className="text-right p-2 border border-orange-200 w-16">จำนวน</th>
              <th className="text-left p-2 border border-orange-200 w-14">หน่วย</th>
              <th className="text-right p-2 border border-orange-200 w-28">ราคาเดิม/หน่วย</th>
              <th className="text-right p-2 border border-orange-200 w-28">ราคาใหม่/หน่วย</th>
              <th className="text-right p-2 border border-orange-200 w-28">ส่วนต่าง</th>
            </tr>
          </thead>
          <tbody>
            {cn.items.map((it, idx) => (
              <tr key={it.id}>
                <td className="text-center p-2 border border-border">{idx + 1}</td>
                <td className="p-2 border border-border">
                  <div className="font-medium">{it.product_name}</div>
                  {it.description && (
                    <div className="text-xs text-muted">{it.description}</div>
                  )}
                </td>
                <td className="text-right p-2 border border-border">{Number(it.quantity)}</td>
                <td className="p-2 border border-border">{it.unit}</td>
                <td className="text-right p-2 border border-border text-muted line-through">
                  {fmtMoney(it.original_price)}
                </td>
                <td className="text-right p-2 border border-border text-brand-700 font-medium">
                  {fmtMoney(it.new_price)}
                </td>
                <td className="text-right p-2 border border-border text-orange-700 font-semibold">
                  -{fmtMoney(it.diff_amount)}
                </td>
              </tr>
            ))}
            {cn.items.length < 5 &&
              Array.from({ length: 5 - cn.items.length }).map((_, i) => (
                <tr key={`pad-${i}`} className="h-8">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="border border-border" />
                  ))}
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr className="bg-orange-50 font-bold">
              <td colSpan={5} className="p-2 text-right border border-orange-200">
                ยอดที่ลดทั้งสิ้น / Total Reduction
              </td>
              <td colSpan={2} className="text-right p-2 border border-orange-200 text-orange-700 text-lg">
                -{fmtMoney(cn.total_diff)} ฿
              </td>
            </tr>
            <tr>
              <td colSpan={7} className="p-2 text-center border border-border italic text-xs">
                ({bahtText(cn.total_diff)})
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Summary box */}
        <div className="mt-4 flex justify-end">
          <div className="border border-orange-200 rounded p-3 text-xs w-72 space-y-1 bg-orange-50">
            <div className="flex justify-between">
              <span className="text-muted">ราคารวมเดิม</span>
              <span>{fmtMoney(cn.total_original)} บ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">ราคารวมใหม่</span>
              <span className="text-brand-700 font-semibold">{fmtMoney(cn.total_new)} บ</span>
            </div>
            <div className="flex justify-between border-t border-orange-200 pt-1 font-bold text-orange-700">
              <span>ส่วนลดที่ได้รับคืน</span>
              <span>-{fmtMoney(cn.total_diff)} บ</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-12 text-xs">
          <div className="text-center">
            <div className="text-xs mb-2">ลงชื่อ ผู้ออกใบลดหนี้</div>
            <div className="h-10 flex items-end justify-center">
              {cn.creator_name && (
                <span className="font-semibold text-sm">{cn.creator_name}</span>
              )}
            </div>
            <div className="border-t border-foreground mt-1" />
            <div className="text-muted mt-2">วันที่ ………/………/…………</div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-2">ลงชื่อ ผู้รับใบลดหนี้ / ลูกค้า</div>
            <div className="h-10" />
            <div className="border-t border-foreground mt-1" />
            <div className="text-muted mt-2">วันที่ ………/………/…………</div>
          </div>
        </div>
      </div>
    </div>
  );
}
