import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/backend/services/customers";
import { listPos } from "@/backend/services/po";
import { listAllPaymentsForCustomer } from "@/backend/services/payments";
import {
  PaymentBadge,
  StatusBadge,
  fmtMoney,
} from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cid = Number(id);
  const c = await getCustomer(cid);
  if (!c) notFound();
  const [pos, payments] = await Promise.all([
    listPos({ customer_id: cid }),
    listAllPaymentsForCustomer(cid),
  ]);
  const usedPct = c.credit_limit
    ? (Number(c.outstanding) / Number(c.credit_limit)) * 100
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/customers"
            className="text-sm text-brand-700 hover:underline"
          >
            ← ลูกค้าทั้งหมด
          </Link>
          <h1 className="text-2xl font-bold text-brand-800 mt-1">{c.name}</h1>
          <div className="text-sm text-muted">
            {c.code ? `รหัส: ${c.code} · ` : ""}
            {c.contact_person ? `ติดต่อ: ${c.contact_person}` : ""}
          </div>
        </div>
        <Link href={`/po/new?customer_id=${cid}`} className="btn-primary">
          + สร้าง PO ให้ลูกค้านี้
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs text-muted">วงเงินสินเชื่อ</div>
          <div className="text-2xl font-bold text-brand-800">
            {fmtMoney(c.credit_limit)}
          </div>
          <div className="text-xs text-muted mt-1">
            เครดิตเริ่มต้น: {c.default_credit_term_days} วัน
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted">ลูกหนี้คงค้าง</div>
          <div className="text-2xl font-bold text-red-600">
            {fmtMoney(c.outstanding)}
          </div>
          <div className="h-2 rounded-full bg-brand-100 mt-2 overflow-hidden">
            <div
              className={`h-full ${
                usedPct > 80
                  ? "bg-red-500"
                  : usedPct > 50
                  ? "bg-amber-500"
                  : "bg-brand-600"
              }`}
              style={{ width: `${Math.min(100, usedPct)}%` }}
            />
          </div>
          <div className="text-xs text-muted mt-1">
            ใช้ไป {usedPct.toFixed(1)}%
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted">วงเงินคงเหลือ</div>
          <div className="text-2xl font-bold text-brand-700">
            {fmtMoney(c.credit_available)}
          </div>
          <div className="text-xs text-muted mt-1">
            Credit Score:{" "}
            <span className="font-medium text-foreground">
              {c.credit_score ?? "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 text-sm space-y-1">
          <h3 className="font-semibold mb-2">ข้อมูลติดต่อ</h3>
          <div>
            <span className="text-muted">โทร:</span> {c.phone || "-"}
          </div>
          <div>
            <span className="text-muted">Email:</span> {c.email || "-"}
          </div>
          <div>
            <span className="text-muted">เลขผู้เสียภาษี:</span>{" "}
            {c.tax_id || "-"}
          </div>
          <div>
            <span className="text-muted">ที่อยู่:</span>{" "}
            <span className="whitespace-pre-wrap">{c.address || "-"}</span>
          </div>
        </div>
        <div className="card p-5 text-sm space-y-1">
          <h3 className="font-semibold mb-2">หมายเหตุ Credit</h3>
          <div className="text-muted whitespace-pre-wrap">
            {c.credit_score_notes || "-"}
          </div>
          <h3 className="font-semibold mt-3 mb-1">หมายเหตุทั่วไป</h3>
          <div className="text-muted whitespace-pre-wrap">
            {c.notes || "-"}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">ประวัติ Purchase Order</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b">
              <tr>
                <th className="text-left py-2">PO</th>
                <th className="text-right">ยอดรวม</th>
                <th className="text-right">ชำระแล้ว</th>
                <th className="text-right">คงค้าง</th>
                <th>สถานะ</th>
                <th>ชำระ</th>
                <th>กำหนดชำระ</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2">
                    <Link
                      href={`/po/${p.id}`}
                      className="text-brand-700 hover:underline font-medium"
                    >
                      {p.po_number}
                    </Link>
                  </td>
                  <td className="text-right">{fmtMoney(p.total)}</td>
                  <td className="text-right text-brand-700">
                    {fmtMoney(p.paid_amount)}
                  </td>
                  <td className="text-right text-red-600">
                    {fmtMoney(p.remaining_amount)}
                  </td>
                  <td className="text-center">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-center">
                    <PaymentBadge status={p.payment_status} />
                  </td>
                  <td className="text-center text-xs">
                    {p.due_date
                      ? new Date(p.due_date).toLocaleDateString("th-TH")
                      : "-"}
                  </td>
                </tr>
              ))}
              {pos.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-muted">
                    ยังไม่มี PO
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">ประวัติการชำระเงิน (ทุก PO)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b">
              <tr>
                <th className="text-left py-2">วันที่</th>
                <th className="text-left">PO</th>
                <th className="text-right">ยอด</th>
                <th>วิธี</th>
                <th>อ้างอิง</th>
                <th>สลิป</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2">
                    {new Date(p.paid_at).toLocaleString("th-TH")}
                  </td>
                  <td>
                    <Link
                      href={`/po/${p.po_id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {p.po_number}
                    </Link>
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
