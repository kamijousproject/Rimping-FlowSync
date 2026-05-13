import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomer,
  listCustomerFiles,
  getEffectiveCreditLimit,
} from "@/backend/services/customers";
import { listPos } from "@/backend/services/po";
import { listAllPaymentsForCustomer } from "@/backend/services/payments";
import { getCurrentUser, isSuperAdmin } from "@/backend/auth";
import {
  PaymentBadge,
  StatusBadge,
  fmtMoney,
} from "@/components/StatusBadge";
import { CustomerFilesModal } from "./CustomerFilesModal";
import { CustomerEditLogsSection } from "./CustomerEditLogsSection";
import { CustomerPoTable } from "./CustomerPoTable";

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
  const [{ pos }, payments, user, files, effective] = await Promise.all([
    listPos({ customer_id: cid, limit: 999 }),
    listAllPaymentsForCustomer(cid),
    getCurrentUser(),
    listCustomerFiles(cid),
    getEffectiveCreditLimit(cid),
  ]);
  const canEdit = isSuperAdmin(user);

  const today = new Date().toISOString().slice(0, 10);
  const tempCredit = effective.temp_credit;
  const tempExpired =
    tempCredit &&
    today > tempCredit.end_date &&
    tempCredit.is_active;
  const usedPct = effective.effective_limit
    ? (Number(c.outstanding) / Number(effective.effective_limit)) * 100
    : 0;
  const overBaseLimit =
    !tempCredit &&
    Number(c.credit_limit) > 0 &&
    Number(c.outstanding) > Number(c.credit_limit);

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
        <div className="flex gap-2 flex-wrap">
          <CustomerFilesModal
            customerId={cid}
            initialFiles={files.map((f) => ({
              ...f,
              created_at: f.created_at instanceof Date ? f.created_at.toISOString() : String(f.created_at),
            }))}
            canDelete={canEdit}
          />
          {canEdit && (
            <Link href={`/customers/${cid}/edit`} className="btn-secondary">
              แก้ไขข้อมูล
            </Link>
          )}
          <Link href={`/po/new?customer_id=${cid}`} className="btn-primary">
            + สร้าง PO ให้ลูกค้านี้
          </Link>
        </div>
      </div>

      {/* Over base limit warning (temp credit expired or no temp credit) */}
      {overBaseLimit && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">
          ⚠️ ลูกค้ามียอดค้างชำระ {fmtMoney(c.outstanding)} เกินวงเงินหลัก {fmtMoney(c.credit_limit)}
        </div>
      )}

      {/* Temp credit expired warning */}
      {tempExpired && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          ⚠️ <strong>วงเงินชั่วคราวหมดอายุแล้ว</strong> (หมดเมื่อ {tempCredit!.end_date}) — วงเงินเพิ่มเติม{" "}
          {fmtMoney(tempCredit!.extra_amount)} ไม่นับรวมอีกต่อไป{" "}
          {Number(c.outstanding) > Number(c.credit_limit) && (
            <span className="font-bold text-red-700">
              · ยอดค้างชำระ {fmtMoney(c.outstanding)} เกินวงเงินหลัก {fmtMoney(c.credit_limit)}
            </span>
          )}
        </div>
      )}

      {/* Active temp credit banner */}
      {tempCredit && !tempExpired && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          🔵 <strong>วงเงินชั่วคราวใช้งานอยู่:</strong> +{fmtMoney(tempCredit.extra_amount)} (ถึง{" "}
          {new Date(tempCredit.end_date).toLocaleDateString("th-TH")}){" "}
          {tempCredit.reason ? `· ${tempCredit.reason}` : ""}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs text-muted">วงเงินสินเชื่อ</div>
          <div className="text-2xl font-bold text-brand-800">
            {fmtMoney(effective.effective_limit)}
          </div>
          {effective.temp_extra > 0 && (
            <div className="text-xs text-blue-700 mt-0.5">
              วงเงินหลัก {fmtMoney(c.credit_limit)} + ชั่วคราว +{fmtMoney(effective.temp_extra)}
            </div>
          )}
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
          <div className="text-xs text-muted">วงเงินคงเหลือ (effective)</div>
          <div className="text-2xl font-bold text-brand-700">
            {fmtMoney(Math.max(0, effective.effective_limit - Number(c.outstanding)))}
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

      <CustomerPoTable
        customerId={cid}
        pos={pos.map((p) => ({
          id: p.id,
          po_number: p.po_number,
          total: Number(p.total),
          paid_amount: Number(p.paid_amount),
          remaining_amount: Number(p.remaining_amount),
          status: p.status,
          payment_status: p.payment_status,
          due_date: p.due_date ? (p.due_date instanceof Date ? p.due_date.toISOString().slice(0, 10) : String(p.due_date).slice(0, 10)) : null,
          fully_paid_at: p.fully_paid_at ? (p.fully_paid_at instanceof Date ? p.fully_paid_at.toISOString() : String(p.fully_paid_at)) : null,
          created_at: p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at),
          tax_invoice_number: p.tax_invoice_number ?? null,
        }))}
      />

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

      <CustomerEditLogsSection customerId={cid} />
    </div>
  );
}
