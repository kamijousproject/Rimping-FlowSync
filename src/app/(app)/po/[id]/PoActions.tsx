"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileMinus, Upload, Wallet, X } from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";

const FLOW: { from: string; to: string; label: string }[] = [
  { from: "draft", to: "confirmed", label: "ยืนยัน PO (ลูกค้า confirm)" },
  { from: "confirmed", to: "packed", label: "แพ็คของแล้ว" },
  { from: "packed", to: "checked", label: "ตรวจของครบแล้ว" },
  { from: "checked", to: "delivered", label: "จัดส่งแล้ว" },
  { from: "delivered", to: "received", label: "ลูกค้ารับของแล้ว" },
];

type PoItem = { id: number; product_name: string; description: string | null; quantity: number; unit: string; unit_price: number };
type CnItem = { po_item_id: number; product_name: string; description: string; quantity: number; unit: string; original_price: number; new_price: number };
type CreditNote = { id: number; cn_number: string; total_diff: number; status: string; created_at: string; creator_name?: string };

export function PoActions({
  poId,
  status,
  payment_status,
  remaining,
  signed_doc_path,
  tax_invoice_number: initialTaxInvNo,
  items: poItems,
  customerId,
  creditNotes: initialCreditNotes,
}: {
  poId: number;
  status: string;
  payment_status: string;
  remaining: number;
  signed_doc_path: string | null;
  tax_invoice_number: string | null;
  items: PoItem[];
  customerId: number;
  creditNotes: CreditNote[];
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

  // Sign upload (multi-file)
  const [signFiles, setSignFiles] = useState<File[]>([]);
  const signPreviews = useMemo(
    () =>
      signFiles.map((f) =>
        f.type.startsWith("image/") ? URL.createObjectURL(f) : null
      ),
    [signFiles]
  );
  useEffect(() => {
    return () => signPreviews.forEach((u) => u && URL.revokeObjectURL(u));
  }, [signPreviews]);

  // Parse signed docs (JSON array or legacy single path)
  const signedDocs = useMemo(() => {
    if (!signed_doc_path) return [];
    try {
      const parsed = JSON.parse(signed_doc_path);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch { /**/ }
    return [signed_doc_path];
  }, [signed_doc_path]);

  const [localSignedDocs, setLocalSignedDocs] = useState<string[]>(signedDocs);
  useEffect(() => { setLocalSignedDocs(signedDocs); }, [signed_doc_path]);

  // Invoice generated
  const [invoice, setInvoice] = useState<{
    invoice_number: string;
    amount: number;
  } | null>(null);

  // Credit note state
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(initialCreditNotes);
  const [showCnModal, setShowCnModal] = useState(false);
  const [cnReason, setCnReason] = useState("");
  const [cnItems, setCnItems] = useState<CnItem[]>([]);
  const [cnEditId, setCnEditId] = useState<number | null>(null);

  function openCreateCn() {
    setCnEditId(null);
    setCnReason("");
    setCnItems([]);
    setShowCnModal(true);
  }

  async function openEditCn(cn: CreditNote) {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/po/${poId}/credit-notes/${cn.id}`);
    setBusy(false);
    if (!r.ok) { setErr("โหลดข้อมูลไม่สำเร็จ"); return; }
    const data = await r.json();
    const full = data.credit_note;
    setCnEditId(cn.id);
    setCnReason(full.reason ?? "");
    setCnItems(
      (full.items ?? []).map((it: CnItem & { original_price: number; new_price: number }) => ({
        po_item_id: it.po_item_id,
        product_name: it.product_name,
        description: it.description ?? "",
        quantity: Number(it.quantity),
        unit: it.unit ?? "",
        original_price: Number(it.original_price),
        new_price: Number(it.new_price),
      }))
    );
    setShowCnModal(true);
  }

  function addCnItem() {
    if (poItems.length === 0) return;
    const first = poItems[0];
    setCnItems((prev) => [
      ...prev,
      {
        po_item_id: first.id,
        product_name: first.product_name,
        description: first.description ?? "",
        quantity: Number(first.quantity),
        unit: first.unit,
        original_price: Number(first.unit_price),
        new_price: Number(first.unit_price),
      },
    ]);
  }

  function updateCnItem(idx: number, patch: Partial<CnItem>) {
    setCnItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeCnItem(idx: number) {
    setCnItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitCn() {
    if (cnItems.length === 0) return;
    setBusy(true);
    setErr(null);
    const url = cnEditId
      ? `/api/po/${poId}/credit-notes/${cnEditId}`
      : `/api/po/${poId}/credit-notes`;
    const method = cnEditId ? "PUT" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId, reason: cnReason, items: cnItems }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "ไม่สามารถบันทึกใบลดหนี้ได้");
      return;
    }
    setShowCnModal(false);
    router.refresh();
    const fresh = await fetch(`/api/po/${poId}/credit-notes`).then((x) => x.json());
    setCreditNotes(fresh.credit_notes ?? []);
  }

  async function deleteCn(cnId: number) {
    if (!confirm("ยืนยันยกเลิก/ลบใบลดหนี้นี้?")) return;
    setBusy(true);
    const r = await fetch(`/api/po/${poId}/credit-notes/${cnId}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "ลบไม่สำเร็จ");
      return;
    }
    setCreditNotes((prev) => prev.filter((c) => c.id !== cnId));
    router.refresh();
  }

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
    if (signFiles.length === 0) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    signFiles.forEach((f) => fd.append("files", f));
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
    setSignFiles([]);
    router.refresh();
  }

  async function deleteSignedDoc(path: string) {
    if (!confirm("ยืนยันลบรูปนี้?")) return;
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/po/${poId}/sign`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "ลบไม่สำเร็จ");
      return;
    }
    setLocalSignedDocs((prev) => prev.filter((p) => p !== path));
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
      {(status === "delivered" || status === "received" || localSignedDocs.length > 0) && (
        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">
            เอกสารหลักฐานรับของ (signed by customer)
          </div>

          {/* Existing docs grid */}
          {localSignedDocs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {localSignedDocs.map((docPath, idx) => (
                <div key={idx} className="relative group">
                  <a href={docPath} target="_blank" rel="noreferrer">
                    {/\.(jpe?g|png|gif|webp|bmp)$/i.test(docPath) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={docPath}
                        alt={`เอกสาร ${idx + 1}`}
                        className="w-24 h-24 object-cover rounded-lg border border-border shadow-sm hover:opacity-80 transition"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg border border-border bg-brand-50 flex flex-col items-center justify-center gap-1 text-brand-700 hover:bg-brand-100 transition">
                        <FileText className="w-7 h-7" />
                        <span className="text-[10px] font-medium">PDF</span>
                      </div>
                    )}
                  </a>
                  {/* Delete button overlay */}
                  <button
                    type="button"
                    onClick={() => deleteSignedDoc(docPath)}
                    disabled={busy}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                    title="ลบรูปนี้"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload new files */}
          <div className="space-y-2">
            {signFiles.length === 0 ? (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-brand-200 rounded-lg px-4 py-4 text-sm text-brand-700 hover:bg-brand-50 cursor-pointer transition">
                <Upload className="w-4 h-4" />
                <span>เพิ่มรูป/เอกสาร (เลือกได้หลายไฟล์)</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => setSignFiles(Array.from(e.target.files || []))}
                />
              </label>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {signFiles.map((f, idx) => (
                    <div key={idx} className="relative group">
                      {signPreviews[idx] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={signPreviews[idx]!}
                          alt={f.name}
                          className="w-20 h-20 object-cover rounded border border-border"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded border border-border bg-brand-50 flex flex-col items-center justify-center text-brand-700">
                          <FileText className="w-6 h-6" />
                          <span className="text-[9px] mt-1 px-1 text-center truncate w-full">{f.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSignFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {/* Add more */}
                  <label className="w-20 h-20 rounded border-2 border-dashed border-brand-200 flex flex-col items-center justify-center text-brand-400 hover:bg-brand-50 cursor-pointer transition">
                    <Upload className="w-5 h-5" />
                    <span className="text-[10px] mt-1">เพิ่ม</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => setSignFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                    />
                  </label>
                </div>
                <div className="text-xs text-muted">{signFiles.length} ไฟล์ที่เลือก</div>
              </div>
            )}
            {signFiles.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={uploadSigned}
                  disabled={busy}
                  className="btn-secondary text-sm"
                >
                  อัปโหลด {signFiles.length} ไฟล์
                </button>
                <button
                  type="button"
                  onClick={() => setSignFiles([])}
                  className="text-sm text-muted hover:text-foreground"
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>
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

      {/* Credit Notes section — only when received */}
      {status === "received" && (
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">ใบลดหนี้ (Credit Notes)</div>
            {creditNotes.some((cn) => cn.status === "active") ? (
              <span className="text-xs text-muted">มีใบลดหนี้ที่ใช้งานอยู่แล้ว</span>
            ) : (
              <button onClick={openCreateCn} disabled={busy} className="btn-secondary text-xs flex items-center gap-1">
                <FileMinus className="w-3 h-3" />
                สร้างใบลดหนี้
              </button>
            )}
          </div>
          {creditNotes.length === 0 ? (
            <div className="text-xs text-muted">ยังไม่มีใบลดหนี้</div>
          ) : (
            <div className="space-y-1">
              {creditNotes.map((cn) => (
                <div key={cn.id} className={`flex items-center justify-between text-xs rounded px-2 py-1.5 border ${cn.status === "voided" ? "opacity-50 bg-gray-50 border-gray-200" : "bg-orange-50 border-orange-200"}`}>
                  <div>
                    <span className="font-mono font-semibold text-orange-700">{cn.cn_number}</span>
                    {cn.status === "voided" && <span className="ml-2 text-red-500">[ยกเลิกแล้ว]</span>}
                    <span className="ml-2 text-muted">ลด {fmtMoney(cn.total_diff)} บ</span>
                    <span className="ml-2 text-muted">{new Date(cn.created_at).toLocaleDateString("th-TH")}</span>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/po/${poId}/credit-note/${cn.id}`} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">ดูเอกสาร</a>
                    {cn.status === "active" && (
                      <>
                        <button onClick={() => openEditCn(cn)} className="text-muted hover:text-brand-700 underline">แก้ไข</button>
                        <button onClick={() => deleteCn(cn.id)} className="text-red-500 hover:text-red-700 underline">ลบ</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
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

      {/* Credit Note Modal */}
      {showCnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-orange-700">
              {cnEditId ? "แก้ไขใบลดหนี้" : "สร้างใบลดหนี้"}
            </h2>
            <div>
              <label className="label">เหตุผล / หมายเหตุ</label>
              <input
                className="input"
                placeholder="เช่น สินค้าไม่ตรงสเปค, ลดราคาพิเศษ..."
                value={cnReason}
                onChange={(e) => setCnReason(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">รายการที่ต้องการลดราคา</label>
                <button type="button" onClick={addCnItem} className="btn-secondary text-xs">+ เพิ่มรายการ</button>
              </div>
              {cnItems.length === 0 && (
                <div className="text-sm text-muted text-center py-4 border border-dashed border-border rounded-lg">
                  กด &quot;+ เพิ่มรายการ&quot; เพื่อเลือกสินค้าที่ต้องการลดราคา
                </div>
              )}
              <div className="space-y-2">
                {cnItems.map((it, idx) => {
                  const poItem = poItems.find((p) => p.id === it.po_item_id);
                  const maxQty = poItem ? Number(poItem.quantity) : 999999;
                  const usedIds = cnItems.map((c, i) => i !== idx ? c.po_item_id : null);
                  const qtyErr = it.quantity > maxQty;
                  const priceErr = it.new_price > it.original_price;
                  return (
                  <div key={idx} className="border border-border rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <label className="label text-xs">เลือกสินค้า</label>
                        <select
                          className="input text-sm"
                          value={it.po_item_id}
                          onChange={(e) => {
                            const sel = poItems.find((p) => p.id === Number(e.target.value));
                            if (sel) updateCnItem(idx, {
                              po_item_id: sel.id,
                              product_name: sel.product_name,
                              description: sel.description ?? "",
                              quantity: Number(sel.quantity),
                              unit: sel.unit,
                              original_price: Number(sel.unit_price),
                              new_price: Number(sel.unit_price),
                            });
                          }}
                        >
                          {poItems.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={usedIds.includes(p.id)}
                            >
                              {p.product_name}{p.description ? ` - ${p.description}` : ""}
                              {usedIds.includes(p.id) ? " (เลือกแล้ว)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="button" onClick={() => removeCnItem(idx)} className="text-red-400 hover:text-red-600 mt-6 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label text-xs">จำนวน (สูงสุด {maxQty})</label>
                        <input type="number" step="1" min="1" max={maxQty}
                          className={`input text-sm text-right ${qtyErr ? "border-red-400 bg-red-50" : ""}`}
                          value={it.quantity}
                          onChange={(e) => updateCnItem(idx, { quantity: Number(e.target.value) })}
                        />
                        {qtyErr && <div className="text-xs text-red-500 mt-0.5">เกินจำนวนที่สั่งซื้อ ({maxQty})</div>}
                      </div>
                      <div>
                        <label className="label text-xs">ราคาเดิม/หน่วย</label>
                        <input type="number" step="0.01" min="0" className="input text-sm text-right bg-gray-50"
                          value={it.original_price} readOnly
                        />
                      </div>
                      <div>
                        <label className="label text-xs text-orange-700">ราคาใหม่/หน่วย *</label>
                        <input type="number" step="0.01" min="0" max={it.original_price}
                          className={`input text-sm text-right ${priceErr ? "border-red-400 bg-red-50" : "border-orange-300 focus:ring-orange-400"}`}
                          value={it.new_price}
                          onChange={(e) => updateCnItem(idx, { new_price: Number(e.target.value) })}
                        />
                        {priceErr && <div className="text-xs text-red-500 mt-0.5">ราคาใหม่ต้องไม่เกินราคาเดิม ({fmtMoney(it.original_price)})</div>}
                      </div>
                    </div>
                    <div className="text-xs text-right text-orange-700 font-semibold">
                      ส่วนต่าง: -{fmtMoney(Math.max(0, (it.original_price - it.new_price)) * it.quantity)} บ
                    </div>
                  </div>
                  );
                })}
              </div>
              {cnItems.length > 0 && (
                <div className="mt-2 text-right text-sm font-bold text-orange-700">
                  รวมส่วนต่างทั้งสิ้น: -{fmtMoney(cnItems.reduce((s, it) => s + (it.original_price - it.new_price) * it.quantity, 0))} บ
                </div>
              )}
            </div>
            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setShowCnModal(false); setErr(null); }} className="btn-secondary">ยกเลิก</button>
              <button type="button" onClick={submitCn} disabled={busy || cnItems.length === 0 || cnItems.some((it) => { const p = poItems.find((x) => x.id === it.po_item_id); return (p && it.quantity > Number(p.quantity)) || it.new_price > it.original_price; })} className="btn-primary bg-orange-600 hover:bg-orange-700 border-orange-600">
                {busy ? "กำลังบันทึก..." : cnEditId ? "บันทึกการแก้ไข" : "สร้างใบลดหนี้"}
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
