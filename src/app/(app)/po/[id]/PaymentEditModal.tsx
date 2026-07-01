"use client";

import { useState } from "react";
import { fmtMoney } from "@/components/StatusBadge";
import { X, Trash2, Edit2, AlertCircle } from "lucide-react";

type Payment = {
  id: number;
  amount: number;
  paid_at: Date;
  method: string;
  reference: string | null;
  slip_path: string | null;
  notes: string | null;
};

type PaymentEditModalProps = {
  payment: Payment;
  poId: number;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export function PaymentEditModal({ payment, poId, onClose, onSaved, onDeleted }: PaymentEditModalProps) {
  const [amount, setAmount] = useState<number>(Number(payment.amount));
  const [paidAt, setPaidAt] = useState<string>(
    new Date(payment.paid_at).toISOString().slice(0, 16)
  );
  const [method, setMethod] = useState<string>(payment.method || "transfer");
  const [reference, setReference] = useState<string>(payment.reference || "");
  const [notes, setNotes] = useState<string>(payment.notes || "");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleSave() {
    setLoading(true);
    setErr("");

    try {
      const formData = new FormData();
      formData.append("amount", String(amount));
      formData.append("paid_at", paidAt);
      formData.append("method", method);
      if (reference) formData.append("reference", reference);
      if (notes) formData.append("notes", notes);
      if (slipFile) formData.append("slip", slipFile);

      const r = await fetch(`/api/po/${poId}/payments/${payment.id}`, {
        method: "PUT",
        body: formData,
      });

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "แก้ไขไม่สำเร็จ");
      }

      onSaved();
    } catch (e: any) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setErr("");

    try {
      const r = await fetch(`/api/po/${poId}/payments/${payment.id}`, {
        method: "DELETE",
      });

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "ลบไม่สำเร็จ");
      }

      onDeleted();
    } catch (e: any) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-lg">แก้ไขการชำระเงิน</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {err && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">
              {err}
            </div>
          )}

          <div>
            <label className="label">ยอดที่ชำระ (บาท) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">วันเวลาที่ชำระ</label>
              <input
                type="datetime-local"
                className="input"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div>
              <label className="label">วิธีชำระ</label>
              <select
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="transfer">โอนเงิน</option>
                <option value="cash">เงินสด</option>
                <option value="check">เช็ค</option>
                <option value="credit">เครดิตการ์ด</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">เลขอ้างอิง</label>
            <input
              type="text"
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="เช่น เลขที่รายการโอน"
            />
          </div>

          <div>
            <label className="label">หมายเหตุ</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div>
            <label className="label">อัปโหลดสลิปใหม่ (ถ้าต้องการเปลี่ยน)</label>
            <input
              type="file"
              accept="image/*,.pdf"
              className="input py-2"
              onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
            />
            {payment.slip_path && !slipFile && (
              <div className="text-xs text-muted mt-1">
                สลิปปัจจุบัน: {" "}
                <a
                  href={payment.slip_path}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:underline"
                >
                  ดูสลิป
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger text-sm flex items-center gap-1"
            disabled={loading}
          >
            <Trash2 className="w-4 h-4" />
            ลบ
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm" disabled={loading}>
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="btn-primary text-sm flex items-center gap-1"
              disabled={loading}
            >
              <Edit2 className="w-4 h-4" />
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center gap-2 mb-3 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-semibold">ยืนยันการลบ</h4>
            </div>
            <p className="text-sm text-muted mb-4">
              ต้องการลบการชำระเงินนี้ใช่หรือไม่? ยอดชำระจะถูกหักออกจาก Quotation และไม่สามารถกู้คืนได้
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary text-sm"
                disabled={loading}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger text-sm"
                disabled={loading}
              >
                {loading ? "กำลังลบ..." : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
