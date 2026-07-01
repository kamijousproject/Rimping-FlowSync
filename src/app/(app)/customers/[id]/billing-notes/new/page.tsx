"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { FileSpreadsheet, ArrowLeft } from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";
import { ThaiDateInput } from "@/components/ThaiDateInput";

interface PoDetail {
  id: number;
  po_number: string;
  tax_invoice_number: string | null;
  total: number;
  remaining_amount: number;
  created_at: string;
}

interface Customer {
  id: number;
  name: string;
  default_credit_term_days: number;
  billing_note_due_days: number;
}

export default function NewBillingNotePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = params.id as string;
  const poIdsParam = searchParams.get("po_ids") || "";

  const [pos, setPos] = useState<PoDetail[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Auto calculate due date based on customer billing_note_due_days
  useEffect(() => {
    if (customer && issuedDate) {
      const d = new Date(issuedDate);
      d.setDate(d.getDate() + (customer.billing_note_due_days ?? 5));
      setDueDate(d.toISOString().slice(0, 10));
    }
  }, [customer, issuedDate]);

  useEffect(() => {
    // Load customer data
    fetch(`/api/customers/${customerId}`)
      .then(r => r.json())
      .then(d => setCustomer(d.customer))
      .catch(() => setErr("โหลดข้อมูลลูกค้าไม่สำเร็จ"));

    if (!poIdsParam) { setLoading(false); return; }
    const ids = poIdsParam.split(",").filter(Boolean);
    Promise.all(
      ids.map((id) =>
        fetch(`/api/po/${id}`)
          .then((r) => r.json())
          .then((d) => d.po as PoDetail)
      )
    )
      .then((results) => setPos(results.filter(Boolean)))
      .catch(() => setErr("โหลดข้อมูล Quotation ไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [poIdsParam, customerId]);

  async function handleSubmit() {
    if (pos.length === 0) return;
    setSubmitting(true);
    setErr(null);
    try {
      const items = pos.map((p) => ({
        po_id: p.id,
        po_number: p.po_number,
        po_date: String(p.created_at).slice(0, 10),
        tax_invoice_number: p.tax_invoice_number ?? null,
        amount: Number(p.remaining_amount),
      }));
      const res = await fetch(`/api/customers/${customerId}/billing-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issued_date: issuedDate, due_date: dueDate || undefined, notes: notes || undefined, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สร้างใบวางบิลไม่สำเร็จ");
      router.push(`/customers/${customerId}/billing-notes/${data.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setSubmitting(false);
    }
  }

  const total = pos.reduce((s, p) => s + Number(p.remaining_amount), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            สร้างใบวางบิล
          </h1>
          <p className="text-sm text-muted">ตรวจสอบข้อมูลก่อนสร้างเอกสาร</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted">กำลังโหลด...</div>
      ) : (
        <div className="space-y-4">
          {/* PO Summary with Notes */}
          <div className="card p-4 space-y-4">
            <h2 className="font-medium mb-3 text-sm">รายการ Quotation ที่เลือก ({pos.length} รายการ)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-muted">
                    <th className="text-left px-3 py-2">เลข Quotation</th>
                    <th className="text-left px-3 py-2">เลขใบกำกับภาษี</th>
                    <th className="text-left px-3 py-2">วันที่</th>
                    <th className="text-right px-3 py-2">ยอดค้างชำระ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pos.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-medium">{p.po_number}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.tax_invoice_number || "—"}</td>
                      <td className="px-3 py-2 text-muted text-xs">
                        {new Date(p.created_at).toLocaleDateString("th-TH")}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{fmtMoney(Number(p.remaining_amount))} ฿</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td colSpan={3} className="px-3 py-2 text-right">ยอดรวม</td>
                    <td className="px-3 py-2 text-right text-brand-700">{fmtMoney(total)} ฿</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Notes moved here */}
            <div className="pt-3 border-t">
              <label className="label text-sm">หมายเหตุ</label>
              <textarea
                className="input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
              />
            </div>
          </div>

          {/* Form - Document Info */}
          <div className="card p-4 space-y-3">
            <h2 className="font-medium text-sm">ข้อมูลเอกสาร</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">วันที่ออกเอกสาร *</label>
                <ThaiDateInput
                  className="input w-full"
                  value={issuedDate}
                  onChange={(e) => setIssuedDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">กำหนดชำระ</label>
                <ThaiDateInput
                  className="input w-full bg-gray-50"
                  value={dueDate}
                  readOnly
                />
                {customer && (
                  <p className="text-[11px] text-muted mt-1">
                    วันที่ออก + {customer.billing_note_due_days ?? 5} วัน (สำหรับใบวางบิล)
                  </p>
                )}
              </div>
            </div>
          </div>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button onClick={() => router.back()} className="btn-secondary">
              ยกเลิก
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || pos.length === 0}
              className="btn-primary"
            >
              {submitting ? "กำลังสร้าง..." : `สร้างใบวางบิล (${fmtMoney(total)} ฿)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
