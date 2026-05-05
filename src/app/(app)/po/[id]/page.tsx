import Link from "next/link";
import { notFound } from "next/navigation";
import { getPo, listPoEditLogs } from "@/backend/services/po";
import { listPayments } from "@/backend/services/payments";
import { listCreditNotes, listCreditNoteLogs } from "@/backend/services/credit-notes";
import {
  PaymentBadge,
  StatusBadge,
  fmtMoney,
} from "@/components/StatusBadge";
import { PoActions } from "./PoActions";
import { EditLogsSection } from "./EditLogsSection";

export const dynamic = "force-dynamic";

export default async function PoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ denied?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getPo(Number(id));
  if (!data) notFound();
  const { po, items } = data;
  const [payments, editLogs, creditNotes, cnLogs] = await Promise.all([
    listPayments(Number(id)),
    listPoEditLogs(Number(id)),
    listCreditNotes(Number(id)),
    listCreditNoteLogs(Number(id)),
  ]);
  const isPaid = po.payment_status === "paid";

  return (
    <div className="space-y-5">
      {sp.denied === "paid" && (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          PO นี้ชำระครบแล้ว ไม่สามารถแก้ไขได้
        </div>
      )}
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
              ` · กำหนดชำระ ${new Date(po.due_date).toLocaleDateString("th-TH")}`}
          </div>
          {/* Overdue / paid-on-time indicator */}
          {(() => {
            if (!po.due_date) return null;
            const due = new Date(po.due_date);
            const settledAt = po.fully_paid_at ? new Date(po.fully_paid_at) : null;
            const compareDate = settledAt ?? new Date();
            const diffDays = Math.floor((compareDate.getTime() - due.getTime()) / 86400000);
            if (po.payment_status === "paid" && settledAt) {
              if (diffDays <= 0) {
                return (
                  <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                    ✓ ชำระตรงเวลา ({Math.abs(diffDays)} วันก่อนครบกำหนด)
                  </div>
                );
              }
              return (
                <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
                  ⚠ ชำระล่าช้า {diffDays} วัน
                </div>
              );
            }
            if (po.payment_status !== "paid" && diffDays > 0) {
              return (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                  ⚠ เกินกำหนด {diffDays} วัน
                </div>
              );
            }
            return null;
          })()}
          <div className="flex gap-2">
            {isPaid ? (
              <button
                disabled
                className="btn-secondary text-xs opacity-50 cursor-not-allowed"
                title="PO นี้ชำระครบแล้ว ไม่สามารถแก้ไขได้"
              >
                แก้ไข PO
              </button>
            ) : (
              <Link
                href={`/po/${po.id}/edit`}
                className="btn-secondary text-xs"
              >
                แก้ไข PO
              </Link>
            )}
            <Link
              href={`/po/${po.id}/quotation`}
              className="btn-secondary text-xs"
            >
              ดาวน์โหลดใบเสนอราคา
            </Link>
          </div>
        </div>
      </div>

      {(() => {
        const activeCnDiff = creditNotes
          .filter((cn) => cn.status === "active")
          .reduce((s, cn) => s + Number(cn.total_diff), 0);
        const itemsTotal = items.reduce((s, it) => s + Number(it.line_total), 0);
        const netTotal = itemsTotal - activeCnDiff;
        const netRemaining = netTotal - Number(po.paid_amount);
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="text-xs text-muted">ยอดรวม PO</div>
              <div className="text-2xl font-bold text-brand-800">
                {fmtMoney(netTotal)} ฿
              </div>
              {activeCnDiff > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  {fmtMoney(itemsTotal)} (ยอดเต็ม) − {fmtMoney(activeCnDiff)} (ใบลดหนี้)
                </div>
              )}
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
                {fmtMoney(Math.max(0, netRemaining))} ฿
              </div>
              {activeCnDiff > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  {fmtMoney(netTotal)} − ชำระแล้ว {fmtMoney(po.paid_amount)}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Workflow & Actions */}
      <PoActions
        poId={po.id}
        status={po.status}
        payment_status={po.payment_status}
        remaining={Number(po.remaining_amount)}
        signed_doc_path={po.signed_doc_path}
        tax_invoice_number={po.tax_invoice_number}
        items={items.map((it) => ({
          id: it.id,
          product_name: it.product_name,
          description: it.description ?? null,
          quantity: Number(it.quantity),
          unit: it.unit ?? "",
          unit_price: Number(it.unit_price),
        }))}
        customerId={po.customer_id}
        creditNotes={creditNotes.map((cn) => ({
          id: cn.id,
          cn_number: cn.cn_number,
          total_diff: Number(cn.total_diff),
          status: cn.status,
          created_at: cn.created_at,
          creator_name: cn.creator_name,
        }))}
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
                  {fmtMoney(items.reduce((s, it) => s + Number(it.line_total), 0))} ฿
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
                  <td className="text-center">
                    {p.slip_path ? (
                      /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p.slip_path) ? (
                        <a
                          href={p.slip_path}
                          target="_blank"
                          rel="noreferrer"
                          title="คลิกเพื่อดูเต็ม"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.slip_path}
                            alt="สลิป"
                            className="w-12 h-12 object-cover rounded border border-border inline-block hover:ring-2 hover:ring-brand-400 transition"
                          />
                        </a>
                      ) : (
                        <a
                          href={p.slip_path}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-700 hover:underline text-xs"
                        >
                          ดูไฟล์ (PDF)
                        </a>
                      )
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

      {/* Edit history (includes CN logs) */}
      <EditLogsSection
        logs={[
          ...editLogs.map((l) => ({ ...l, logType: "po" as const })),
          ...cnLogs.map((l) => ({
            id: l.id + 1000000,
            edited_by: l.performed_by,
            editor_name: l.performer_name ?? "—",
            summary: `[ใบลดหนี้ ${l.cn_number}] ${l.summary ?? ""}`,
            changes: "{}",
            created_at: l.created_at,
            logType: "cn" as const,
          })),
        ].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )}
      />
    </div>
  );
}
