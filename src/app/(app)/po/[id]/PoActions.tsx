"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, Wallet, X } from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";

const FLOW: { from: string; to: string; label: string }[] = [
  { from: "draft", to: "confirmed", label: "ยืนยัน PO (ลูกค้า confirm)" },
  { from: "confirmed", to: "packed", label: "แพ็คของแล้ว" },
  { from: "packed", to: "checked", label: "ตรวจของครบแล้ว" },
  { from: "checked", to: "delivered", label: "จัดส่งแล้ว" },
  { from: "delivered", to: "received", label: "ลูกค้ารับของแล้ว" },
];

export function PoActions({
  poId,
  status,
  payment_status,
  remaining,
  signed_doc_path,
}: {
  poId: number;
  status: string;
  payment_status: string;
  remaining: number;
  signed_doc_path: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Pay modal state
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(remaining);
  const [payDate, setPayDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [payMethod, setPayMethod] = useState("transfer");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paySlip, setPaySlip] = useState<File | null>(null);
  const paySlipPreview = useMemo(
    () =>
      paySlip && paySlip.type.startsWith("image/")
        ? URL.createObjectURL(paySlip)
        : null,
    [paySlip]
  );
  useEffect(() => {
    return () => {
      if (paySlipPreview) URL.revokeObjectURL(paySlipPreview);
    };
  }, [paySlipPreview]);

  // Sign upload
  const [signFile, setSignFile] = useState<File | null>(null);

  // Invoice generated
  const [invoice, setInvoice] = useState<{
    invoice_number: string;
    amount: number;
  } | null>(null);

  const next = FLOW.find((f) => f.from === status);

  async function setStatus(to: string) {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/po/${poId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "เปลี่ยนสถานะไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  async function uploadSigned() {
    if (!signFile) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", signFile);
    const r = await fetch(`/api/po/${poId}/sign`, {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "อัปโหลดไม่สำเร็จ");
      return;
    }
    setSignFile(null);
    router.refresh();
  }

  async function genInvoice() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/po/${poId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: remaining }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "ไม่สามารถสร้าง invoice ได้");
      return;
    }
    const d = await r.json();
    setInvoice(d.invoice);
    // open invoice in new tab
    window.open(`/po/${poId}/invoice?inv=${d.invoice.id}`, "_blank");
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("amount", String(payAmount));
    fd.append("paid_at", new Date(payDate).toISOString());
    fd.append("method", payMethod);
    if (payRef) fd.append("reference", payRef);
    if (payNotes) fd.append("notes", payNotes);
    if (paySlip) fd.append("slip", paySlip);
    const r = await fetch(`/api/po/${poId}/payments`, {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "บันทึกการชำระไม่สำเร็จ");
      return;
    }
    setShowPay(false);
    router.refresh();
  }

  const canPay = payment_status !== "paid" && status !== "cancelled" &&
    ["received", "delivered"].includes(status);

  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-semibold">การดำเนินการ</h3>

      {/* Status flow */}
      <div className="flex flex-wrap items-center gap-2">
        {["draft", "confirmed", "packed", "checked", "delivered", "received"].map(
          (s, i) => {
            const idx = [
              "draft",
              "confirmed",
              "packed",
              "checked",
              "delivered",
              "received",
            ].indexOf(status);
            const active = i === idx;
            const done = i < idx;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`text-xs px-2 py-1 rounded-full ${
                    active
                      ? "bg-brand-600 text-white"
                      : done
                      ? "bg-brand-100 text-brand-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {i + 1}. {s}
                </div>
                {i < 5 && <span className="text-muted">→</span>}
              </div>
            );
          }
        )}
      </div>

      {/* Next-step button */}
      <div className="flex flex-wrap gap-2">
        {next && status !== "cancelled" && (
          <button
            onClick={() => setStatus(next.to)}
            disabled={busy}
            className="btn-primary"
          >
            {next.label} →
          </button>
        )}
        {status !== "cancelled" && status !== "received" && (
          <button
            onClick={() => {
              if (confirm("ยืนยันยกเลิก PO นี้?")) setStatus("cancelled");
            }}
            disabled={busy}
            className="btn-danger"
          >
            ยกเลิก PO
          </button>
        )}
      </div>

      {/* Signed delivery doc */}
      {(status === "delivered" || status === "received" || signed_doc_path) && (
        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">
            เอกสารหลักฐานรับของ (signed by customer)
          </div>
          {signed_doc_path ? (
            <div className="flex items-center gap-3">
              <a
                href={signed_doc_path}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 hover:underline text-sm"
              >
                ดูเอกสาร
              </a>
              <span className="text-xs text-muted">บันทึกแล้ว</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setSignFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              <button
                onClick={uploadSigned}
                disabled={!signFile || busy}
                className="btn-secondary text-sm"
              >
                อัปโหลดเอกสาร
              </button>
            </div>
          )}
        </div>
      )}

      {/* Payment section */}
      {canPay && (
        <div className="border-t pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={genInvoice}
              disabled={busy || remaining <= 0}
              className="btn-secondary"
            >
              <FileText className="w-4 h-4" />
              สร้าง Invoice ({fmtMoney(remaining)} ฿)
            </button>
            <button
              onClick={() => {
                setPayAmount(remaining);
                setShowPay(true);
              }}
              disabled={busy || remaining <= 0}
              className="btn-primary"
            >
              <Wallet className="w-4 h-4" />
              บันทึกการชำระเงิน
            </button>
          </div>
          {invoice && (
            <div className="mt-2 text-xs text-brand-700">
              สร้าง Invoice {invoice.invoice_number} ยอด {fmtMoney(invoice.amount)} ฿ แล้ว
            </div>
          )}
        </div>
      )}

      {err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {err}
        </div>
      )}

      {/* Payment modal */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitPayment}
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-3"
          >
            <h2 className="text-lg font-semibold text-brand-800">
              บันทึกการชำระเงิน
            </h2>
            <div className="text-sm text-muted">
              ยอดคงค้าง: {fmtMoney(remaining)} ฿
            </div>
            <div>
              <label className="label">ยอดที่ชำระ (บาท) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                className="input"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
              />
              <div className="text-xs text-muted mt-1">
                สามารถชำระบางส่วนได้ ระบบจะคำนวณคงค้างให้อัตโนมัติ
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">วันเวลาที่ชำระ</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">วิธีการชำระ</label>
                <select
                  className="input"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="transfer">โอนเงิน</option>
                  <option value="cash">เงินสด</option>
                  <option value="cheque">เช็ค</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">เลขอ้างอิง</label>
              <input
                className="input"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
              />
            </div>
            <div>
              <label className="label">
                สลิปการชำระเงิน{" "}
                <span className="text-muted font-normal">
                  (แนบรูปหรือไฟล์ PDF)
                </span>
              </label>
              {!paySlip ? (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-brand-200 rounded-lg px-4 py-6 text-sm text-brand-700 hover:bg-brand-50 cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  <span>กดเพื่อเลือกไฟล์ / ถ่ายรูปสลิป</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    className="hidden"
                    onChange={(e) =>
                      setPaySlip(e.target.files?.[0] || null)
                    }
                  />
                </label>
              ) : (
                <div className="border border-border rounded-lg p-2 flex items-start gap-3">
                  {paySlipPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={paySlipPreview}
                      alt="สลิป"
                      className="w-20 h-20 object-cover rounded border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded border border-border bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
                      <FileText className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium truncate">{paySlip.name}</div>
                    <div className="text-xs text-muted">
                      {(paySlip.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaySlip(null)}
                    className="text-muted hover:text-red-600 p-1"
                    aria-label="ลบไฟล์"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="label">หมายเหตุ</label>
              <textarea
                className="input"
                rows={2}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {err}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowPay(false)}
                className="btn-secondary"
              >
                ยกเลิก
              </button>
              <button className="btn-primary" disabled={busy}>
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
