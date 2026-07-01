"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { fmtMoney, StatusBadge, PaymentBadge } from "@/components/StatusBadge";
import { ThaiDateInput } from "@/components/ThaiDateInput";

type Po = {
  id: number;
  po_number: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  payment_status: string;
  due_date: string | null;
  fully_paid_at: string | null;
  created_at: string;
  tax_invoice_number: string | null;
};

function OverdueBadge({ p }: { p: Po }) {
  if (!p.due_date) return null;
  const due = new Date(p.due_date);
  const settledAt = p.fully_paid_at ? new Date(p.fully_paid_at) : null;
  const compareDate = settledAt ?? new Date();
  const diffDays = Math.floor((compareDate.getTime() - due.getTime()) / 86400000);
  if (p.payment_status === "paid" && settledAt) {
    if (diffDays <= 0)
      return <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1">ตรงเวลา</span>;
    return <span className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-1">ล่าช้า {diffDays} วัน</span>;
  }
  if (p.payment_status !== "paid" && diffDays > 0)
    return <span className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1">เกิน {diffDays} วัน</span>;
  return null;
}

export function CustomerPoTable({
  customerId,
  pos,
}: {
  customerId: number;
  pos: Po[];
}) {
  const router = useRouter();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [bnNotes, setBnNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return pos.filter((p) => {
      const d = p.created_at.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [pos, dateFrom, dateTo]);

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedPos = filtered.filter((p) => selected.has(p.id));

  async function createBn() {
    if (selectedPos.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const items = selectedPos.map((p) => ({
        po_id: p.id,
        po_number: p.po_number,
        po_date: p.created_at.slice(0, 10),
        tax_invoice_number: p.tax_invoice_number || null,
        amount: Number(p.remaining_amount),
      }));
      const r = await fetch(`/api/customers/${customerId}/billing-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issued_date: issuedDate, due_date: dueDate || undefined, notes: bnNotes || undefined, items }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setShowModal(false);
      setSelected(new Set());
      router.push(`/customers/${customerId}/billing-notes/${data.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold">ประวัติ Quotation</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <label className="text-muted text-xs">ตั้งแต่</label>
            <ThaiDateInput className="input w-[140px] text-xs py-1 px-2 h-8" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <label className="text-muted text-xs">ถึง</label>
            <ThaiDateInput className="input w-[140px] text-xs py-1 px-2 h-8" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {(dateFrom || dateTo) && (
            <button className="text-xs text-muted underline" onClick={() => { setDateFrom(""); setDateTo(""); }}>ล้าง</button>
          )}
          {selected.size > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary text-xs flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              สร้างใบวางบิล ({selected.size} Quotation)
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b">
            <tr>
              <th className="py-2 pr-2 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  className="accent-brand-600"
                />
              </th>
              <th className="text-left py-2">Quotation</th>
              <th className="text-right">ยอดรวม</th>
              <th className="text-right">ชำระแล้ว</th>
              <th className="text-right">คงค้าง</th>
              <th>สถานะ</th>
              <th>ชำระ</th>
              <th>กำหนดชำระ / สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={`border-b last:border-0 ${selected.has(p.id) ? "bg-brand-50" : ""}`}>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="accent-brand-600"
                  />
                </td>
                <td className="py-2">
                  <Link href={`/po/${p.id}`} className="text-brand-700 hover:underline font-medium">
                    {p.po_number}
                  </Link>
                  <div className="text-[10px] text-muted">{p.created_at.slice(0, 10)}</div>
                </td>
                <td className="text-right">{fmtMoney(p.total)}</td>
                <td className="text-right text-brand-700">{fmtMoney(p.paid_amount)}</td>
                <td className="text-right text-red-600">{p.status === "cancelled" ? fmtMoney(0) : fmtMoney(p.remaining_amount)}</td>
                <td className="text-center"><StatusBadge status={p.status} /></td>
                <td className="text-center"><PaymentBadge status={p.payment_status} /></td>
                <td className="text-center text-xs">
                  <div>{p.due_date ? new Date(p.due_date).toLocaleDateString("th-TH") : "-"}</div>
                  <OverdueBadge p={p} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-muted">ไม่พบ Quotation ในช่วงวันที่ที่เลือก</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Billing Note Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold">สร้างใบวางบิล</h2>
            {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">วันที่ออกใบ *</label>
                <ThaiDateInput className="input w-full text-sm" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">กำหนดชำระ</label>
                <ThaiDateInput className="input w-full text-sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label text-xs">หมายเหตุ</label>
              <textarea className="input text-sm h-16 resize-none" value={bnNotes} onChange={(e) => setBnNotes(e.target.value)} />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted mb-1">Quotation ที่เลือก ({selectedPos.length} ใบ)</div>
              <div className="card overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-muted">
                    <tr>
                      <th className="text-left p-2">เลข Quotation</th>
                      <th className="text-left p-2">เลขใบกำกับ</th>
                      <th className="text-right p-2">ยอด (หลัง CN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPos.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2 font-medium">{p.po_number}</td>
                        <td className="p-2 text-muted">{p.tax_invoice_number || "-"}</td>
                        <td className="p-2 text-right font-medium">{fmtMoney(p.remaining_amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-brand-50 font-bold">
                      <td colSpan={2} className="p-2 text-right">รวม</td>
                      <td className="p-2 text-right text-brand-700">
                        {fmtMoney(selectedPos.reduce((s, p) => s + Number(p.remaining_amount), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowModal(false); setErr(null); }} className="btn-secondary text-sm">ยกเลิก</button>
              <button onClick={createBn} disabled={busy} className="btn-primary text-sm">
                {busy ? "กำลังสร้าง..." : "สร้างใบวางบิล"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
