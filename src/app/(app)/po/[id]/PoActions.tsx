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
  tax_invoice_number: initialTaxInvNo,
}: {
  poId: number;
  status: string;
  payment_status: string;
  remaining: number;
  signed_doc_path: string | null;
  tax_invoice_number: string | null;
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

  // Tax invoice number
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxInvNo, setTaxInvNo] = useState(initialTaxInvNo ?? "");
  const [taxInvInput, setTaxInvInput] = useState("");
  const [editingTaxInv, setEditingTaxInv] = useState(false);
  const [editTaxInvInput, setEditTaxInvInput] = useState("");

  // Sign upload
  const [signFile, setSignFile] = useState<File | null>(null);
  const [replaceSign, setReplaceSign] = useState(false);
  const signPreview = useMemo(
    () =>
      signFile && signFile.type.startsWith("image/")
        ? URL.createObjectURL(signFile)
        : null,
    [signFile]
  );
  useEffect(() => {
    return () => {
      if (signPreview) URL.revokeObjectURL(signPreview);
    };
  }, [signPreview]);

  // Invoice generated
  const [invoice, setInvoice] = useState<{
    invoice_number: string;
    amount: number;
  } | null>(null);

  const next = FLOW.find((f) => f.from === status);

  async function setStatus(to: string, extraData?: Record<string, string>) {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/po/${poId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to, ...extraData }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "เปลี่ยนสถานะไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  async function submitTaxInvModal() {
    if (!taxInvInput.trim()) return;
    setShowTaxModal(false);
    await setStatus("delivered", { tax_invoice_number: taxInvInput.trim() });
    setTaxInvNo(taxInvInput.trim());
    setTaxInvInput("");
  }

  async function saveTaxInvEdit() {
    if (!editTaxInvInput.trim()) return;
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/po/${poId}/tax-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tax_invoice_number: editTaxInvInput.trim() }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "บันทึกไม่สำเร็จ");
      return;
    }
    setTaxInvNo(editTaxInvInput.trim());
    setEditingTaxInv(false);
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
    router.push(`/po/${poId}/invoice?inv=${d.invoice.id}`);
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
            onClick={() => {
              if (next.to === "delivered") {
                setTaxInvInput("");
                setShowTaxModal(true);
              } else {
                setStatus(next.to);
              }
            }}
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

      {/* Tax invoice number display / edit */}
      {(status === "delivered" || status === "received") && (
        <div className="border-t pt-3 text-sm">
          <div className="font-medium mb-1">เลขที่ใบกำกับภาษีเต็มรูปแบบ</div>
          {editingTaxInv ? (
            <div className="flex gap-2 items-center">
              <input
                className="input flex-1"
                value={editTaxInvInput}
                onChange={(e) => setEditTaxInvInput(e.target.value)}
                placeholder="เช่น 1234-56789"
                autoFocus
              />
              <button onClick={saveTaxInvEdit} disabled={busy || !editTaxInvInput.trim()} className="btn-primary text-sm">บันทึก</button>
              <button type="button" onClick={() => setEditingTaxInv(false)} className="text-sm text-muted hover:text-foreground">ยกเลิก</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-mono text-brand-800">{taxInvNo || <span className="text-muted">ยังไม่ได้กรอก</span>}</span>
              <button
                type="button"
                onClick={() => { setEditTaxInvInput(taxInvNo); setEditingTaxInv(true); }}
                className="text-xs text-muted hover:text-brand-700 underline"
              >
                แก้ไข
              </button>
            </div>
          )}
        </div>
      )}

      {/* Signed delivery doc */}
      {(status === "delivered" || status === "received" || signed_doc_path) && (
        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">
            เอกสารหลักฐานรับของ (signed by customer)
          </div>
          {signed_doc_path && !replaceSign ? (
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={signed_doc_path}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 hover:underline text-sm"
              >
                ดูเอกสาร
              </a>
              <span className="text-xs text-muted">บันทึกแล้ว</span>
              <button
                type="button"
                onClick={() => setReplaceSign(true)}
                className="text-xs text-muted hover:text-brand-700 underline"
              >
                เปลี่ยนไฟล์
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {!signFile ? (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-brand-200 rounded-lg px-4 py-5 text-sm text-brand-700 hover:bg-brand-50 cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  <span>กดเพื่อเลือกไฟล์เอกสาร / ถ่ายรูป</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setSignFile(e.target.files?.[0] || null)}
                  />
                </label>
              ) : (
                <div className="border border-border rounded-lg p-2 flex items-start gap-3">
                  {signPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signPreview}
                      alt="เอกสาร"
                      className="w-20 h-20 object-cover rounded border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded border border-border bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
                      <FileText className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium truncate">{signFile.name}</div>
                    <div className="text-xs text-muted">
                      {(signFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignFile(null)}
                    className="text-muted hover:text-red-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={uploadSigned}
                  disabled={!signFile || busy}
                  className="btn-secondary text-sm"
                >
                  อัปโหลดเอกสาร
                </button>
                {replaceSign && (
                  <button
                    type="button"
                    onClick={() => { setReplaceSign(false); setSignFile(null); }}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    ยกเลิก
                  </button>
                )}
              </div>
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

      {/* Tax invoice number modal */}
      {showTaxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-brand-800">
              กรอกเลขที่ใบกำกับภาษีเต็มรูปแบบ
            </h2>
            <p className="text-sm text-muted">
              ต้องกรอกเลขนี้ก่อนเปลี่ยนสถานะเป็น <strong>จัดส่งแล้ว</strong> (แก้ไขได้ภายหลัง)
            </p>
            <div>
              <label className="label">เลขที่ใบกำกับภาษีเต็มรูปแบบ *</label>
              <input
                className="input"
                value={taxInvInput}
                onChange={(e) => setTaxInvInput(e.target.value)}
                placeholder="เช่น 1234-56789"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") submitTaxInvModal(); }}
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
                onClick={() => { setShowTaxModal(false); setTaxInvInput(""); }}
                className="btn-secondary"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={submitTaxInvModal}
                disabled={!taxInvInput.trim() || busy}
                className="btn-primary"
              >
                ยืนยันและจัดส่ง
              </button>
            </div>
          </div>
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
