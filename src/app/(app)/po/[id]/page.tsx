import Link from "next/link";
import { notFound } from "next/navigation";
import { getPo } from "@/backend/services/po";
import { listPayments } from "@/backend/services/payments";
import {
  PaymentBadge,
  StatusBadge,
  fmtMoney,
} from "@/components/StatusBadge";
import { PoActions } from "./PoActions";

export const dynamic = "force-dynamic";

export default async function PoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPo(Number(id));
  if (!data) notFound();
  const { po, items } = data;
  const payments = await listPayments(Number(id));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/po" className="text-sm text-brand-700 hover:underline">
            ← Purchase Orders
          </Link>
          <h1 className="text-2xl font-bold text-brand-800 mt-1">
            {po.po_number}
          </h1>
          <div className="text-sm text-muted">
            ลูกค้า:{" "}
            <Link
              href={`/customers/${po.customer_id}`}
              className="text-brand-700 hover:underline"
            >
              {po.customer_name}
            </Link>
            {" · "}
            สร้างเมื่อ {new Date(po.created_at).toLocaleString("th-TH")}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <StatusBadge status={po.status} />
            <PaymentBadge status={po.payment_status} />
          </div>
          <div className="text-xs text-muted">
            เครดิต {po.credit_term_days} วัน
            {po.due_date &&
              ` · กำหนดชำระ ${new Date(po.due_date).toLocaleDateString(
                "th-TH"
              )}`}
          </div>
          <Link
            href={`/po/${po.id}/quotation`}
            className="btn-secondary text-xs"
          >
            ดาวน์โหลดใบเสนอราคา
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs text-muted">ยอดรวม PO</div>
          <div className="text-2xl font-bold text-brand-800">
            {fmtMoney(po.total)} ฿
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted">ชำระแล้ว</div>
          <div className="text-2xl font-bold text-brand-700">
            {fmtMoney(po.paid_amount)} ฿
          </div>
          <div className="text-xs text-muted mt-1">
            {payments.length} ครั้ง
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted">คงค้าง</div>
          <div className="text-2xl font-bold text-red-600">
            {fmtMoney(po.remaining_amount)} ฿
          </div>
        </div>
      </div>

      {/* Workflow & Actions */}
      <PoActions
        poId={po.id}
        status={po.status}
        payment_status={po.payment_status}
        remaining={Number(po.remaining_amount)}
        signed_doc_path={po.signed_doc_path}
      />

      {/* Items */}
      <div className="card p-5">
        <h3 className="font-semibold mb-3">รายการสินค้า</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b">
              <tr>
                <th className="text-left p-2">สินค้า</th>
                <th className="text-left">รายละเอียด</th>
                <th className="text-right">จำนวน</th>
                <th className="text-left">หน่วย</th>
                <th className="text-right">ราคา/หน่วย</th>
                <th className="text-right">รวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{it.product_name}</td>
                  <td className="text-muted text-xs">
                    {it.description || "-"}
                  </td>
                  <td className="text-right">{Number(it.quantity)}</td>
                  <td>{it.unit}</td>
                  <td className="text-right">{fmtMoney(it.unit_price)}</td>
                  <td className="text-right font-medium">
                    {fmtMoney(it.line_total)}
                  </td>
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={5} className="p-2 text-right">
                  รวมทั้งหมด
                </td>
                <td className="p-2 text-right text-brand-700 text-lg">
                  {fmtMoney(po.total)} ฿
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {po.notes && (
          <div className="mt-3 text-sm">
            <div className="text-xs text-muted">หมายเหตุ:</div>
            <div className="whitespace-pre-wrap">{po.notes}</div>
          </div>
        )}
      </div>

      {/* Payments history */}
      <div className="card p-5">
        <h3 className="font-semibold mb-3">ประวัติการชำระเงิน</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b">
              <tr>
                <th className="text-left p-2">วันที่</th>
                <th className="text-right">ยอด</th>
                <th>วิธี</th>
                <th>อ้างอิง</th>
                <th>สลิป</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-2">
                    {new Date(p.paid_at).toLocaleString("th-TH")}
                  </td>
                  <td className="text-right text-brand-700 font-medium">
                    {fmtMoney(p.amount)}
                  </td>
                  <td className="text-center text-xs">{p.method}</td>
                  <td className="text-xs">{p.reference || "-"}</td>
                  <td>
                    {p.slip_path ? (
                      <a
                        href={p.slip_path}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-700 hover:underline text-xs"
                      >
                        ดูสลิป
                      </a>
                    ) : (
                      <span className="text-muted text-xs">-</span>
                    )}
                  </td>
                  <td className="text-xs text-muted">{p.notes || "-"}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-muted">
                    ยังไม่มีการชำระเงิน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
