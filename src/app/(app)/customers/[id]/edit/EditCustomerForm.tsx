"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DeleteCustomerButton } from "../DeleteCustomerButton";

type FormState = {
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  tax_id: string;
  address: string;
  credit_score: string;
  credit_score_notes: string;
  default_credit_term_days: number;
  notes: string;
};

type Props = {
  id: number;
  initial: FormState & { credit_limit: number };
};

export function EditCustomerForm({ id, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    code: initial.code,
    name: initial.name,
    contact_person: initial.contact_person,
    phone: initial.phone,
    email: initial.email,
    tax_id: initial.tax_id,
    address: initial.address,
    credit_score: initial.credit_score,
    credit_score_notes: initial.credit_score_notes,
    default_credit_term_days: initial.default_credit_term_days,
    notes: initial.notes,
  });

  // Credit adjustment panel
  const [currentLimit, setCurrentLimit] = useState(initial.credit_limit);
  const [creditDelta, setCreditDelta] = useState<"" | number>("");
  const [creditSign, setCreditSign] = useState<"increase" | "decrease">("increase");
  const [creditReason, setCreditReason] = useState("");
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditMsg, setCreditMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Temp credit panel
  const maxTempExtra = Math.floor(currentLimit * 0.2);
  const [tempExtra, setTempExtra] = useState<"" | number>("");
  const [tempStart, setTempStart] = useState("");
  // end_date คำนวณอัตโนมัติจาก start_date + default_credit_term_days
  const tempEnd = tempStart
    ? (() => {
        const d = new Date(tempStart);
        d.setDate(d.getDate() + form.default_credit_term_days);
        return d.toISOString().slice(0, 10);
      })()
    : "";
  const [tempReason, setTempReason] = useState("");
  const [tempLoading, setTempLoading] = useState(false);
  const [tempMsg, setTempMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [activeTempCredits, setActiveTempCredits] = useState<any[]>([]);
  const [deactivateLoading, setDeactivateLoading] = useState<number | null>(null);

  // Upload files
  const [files, setFiles] = useState<File[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileMsg, setFileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load temp credits on component mount
  useEffect(() => {
    loadTempCredits();
  }, []);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm({ ...form, [k]: v });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const payload = {
      ...form,
      credit_score: form.credit_score === "" ? null : Number(form.credit_score),
    };
    const r = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "บันทึกไม่สำเร็จ");
      return;
    }
    router.push(`/customers/${id}`);
    router.refresh();
  }

  async function submitCreditAdjust() {
    if (creditDelta === "" || Number(creditDelta) <= 0) return;
    setCreditLoading(true);
    setCreditMsg(null);
    const delta = creditSign === "increase" ? Number(creditDelta) : -Number(creditDelta);
    const r = await fetch(`/api/customers/${id}/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "adjust", delta, reason: creditReason || undefined }),
    });
    setCreditLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setCreditMsg({ type: "err", text: d.error || "ปรับวงเงินไม่สำเร็จ" });
      return;
    }
    const d = await r.json();
    setCurrentLimit(d.new_limit);
    setCreditDelta("");
    setCreditReason("");
    setCreditMsg({ type: "ok", text: `ปรับวงเงินสำเร็จ → ${Number(d.new_limit).toLocaleString()} บาท` });
  }

  async function submitTempCredit() {
    if (!tempExtra || !tempStart || !tempEnd) return;
    setTempLoading(true);
    setTempMsg(null);
    const r = await fetch(`/api/customers/${id}/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "temp",
        extra_amount: Number(tempExtra),
        start_date: tempStart,
        end_date: tempEnd,
        reason: tempReason || undefined,
      }),
    });
    setTempLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setTempMsg({ type: "err", text: d.error || "เพิ่มวงเงินชั่วคราวไม่สำเร็จ" });
      return;
    }
    setTempExtra("");
    setTempStart("");
    setTempReason("");
    setTempMsg({ type: "ok", text: "บันทึกวงเงินชั่วคราวสำเร็จ" });
    await loadTempCredits(); // โหลดข้อมูลใหม่
  }

  async function loadTempCredits() {
    try {
      const r = await fetch(`/api/customers/${id}/credit`);
      if (r.ok) {
        const data = await r.json();
        setActiveTempCredits(data.temps || []);
      }
    } catch (error) {
      console.error('Failed to load temp credits:', error);
    }
  }

  async function deactivateTempCredit(tempId: number) {
    setDeactivateLoading(tempId);
    try {
      const r = await fetch(`/api/customers/${id}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate_temp", temp_id: tempId }),
      });
      if (r.ok) {
        await loadTempCredits(); // โหลดข้อมูลใหม่
        setTempMsg({ type: "ok", text: "ยกเลิกวงเงินชั่วคราวสำเร็จ" });
      } else {
        const d = await r.json().catch(() => ({}));
        setTempMsg({ type: "err", text: d.error || "ยกเลิกวงเงินชั่วคราวไม่สำเร็จ" });
      }
    } catch (error) {
      setTempMsg({ type: "err", text: "เกิดข้อผิดพลาด" });
    } finally {
      setDeactivateLoading(null);
    }
  }

  async function uploadFiles() {
    if (!files.length) return;
    setFileLoading(true);
    setFileMsg(null);
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    const r = await fetch(`/api/customers/${id}/files`, { method: "POST", body: fd });
    setFileLoading(false);
    if (!r.ok) {
      setFileMsg({ type: "err", text: "อัพโหลดไม่สำเร็จ" });
      return;
    }
    setFiles([]);
    setFileMsg({ type: "ok", text: `อัพโหลด ${files.length} ไฟล์สำเร็จ` });
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/customers/${id}`} className="text-sm text-brand-700 hover:underline">
          ← กลับ
        </Link>
        <h1 className="text-2xl font-bold text-brand-800 mt-1">แก้ไขข้อมูลลูกค้า</h1>
        <p className="text-sm text-muted">ปรับข้อมูลติดต่อ วงเงินสินเชื่อ และ Credit Score</p>
      </div>

      {/* ── Main Info ─────────────────────────────────────────────────── */}
      <form onSubmit={submit} className="card p-6 space-y-4">
        <h2 className="font-semibold text-brand-800">ข้อมูลทั่วไป</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">รหัสลูกค้า (ไม่บังคับ)</label>
            <input className="input" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="เช่น C001" />
          </div>
          <div>
            <label className="label">ชื่อกิจการ / ลูกค้า *</label>
            <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">ผู้ติดต่อ</label>
            <input className="input" value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
          </div>
          <div>
            <label className="label">โทรศัพท์</label>
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className="label">เลขผู้เสียภาษี</label>
            <input className="input" value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">ที่อยู่</label>
            <textarea className="input" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-brand-800 mb-3">ข้อมูลสินเชื่อ (Credit)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">เครดิต (วัน) เริ่มต้น</label>
              <select
                className="input"
                value={form.default_credit_term_days}
                onChange={(e) => set("default_credit_term_days", Number(e.target.value))}
              >
                <option value={7}>7 วัน</option>
                <option value={15}>15 วัน</option>
                <option value={30}>30 วัน</option>
                <option value={60}>60 วัน</option>
              </select>
            </div>
            <div>
              <label className="label">Credit Score (0-1000)</label>
              <input
                type="number"
                min="0"
                max="1000"
                className="input"
                value={form.credit_score}
                onChange={(e) => set("credit_score", e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <label className="label">หมายเหตุ Credit Score</label>
              <input className="input" value={form.credit_score_notes} onChange={(e) => set("credit_score_notes", e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className="label">บันทึกเพิ่มเติม</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>
        )}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={loading}>
            {loading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
          <Link href={`/customers/${id}`} className="btn-secondary">ยกเลิก</Link>
        </div>
      </form>

      {/* ── Credit Limit Adjustment ───────────────────────────────────── */}
      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-brand-800">ปรับวงเงินสินเชื่อ</h2>
        <div className="text-sm text-muted">
          วงเงินปัจจุบัน:{" "}
          <span className="font-bold text-brand-800 text-base">
            {Number(currentLimit).toLocaleString()} บาท
          </span>
        </div>
        <div className="grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">ประเภท</label>
            <select className="input" value={creditSign} onChange={(e) => setCreditSign(e.target.value as "increase" | "decrease")}>
              <option value="increase">เพิ่มวงเงิน</option>
              <option value="decrease">ลดวงเงิน</option>
            </select>
          </div>
          <div>
            <label className="label">จำนวน (บาท)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="input"
              value={creditDelta}
              onChange={(e) => setCreditDelta(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="เช่น 50000"
            />
          </div>
          <div>
            <label className="label">เหตุผล (ไม่บังคับ)</label>
            <input className="input" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="เช่น ขยายกิจการ" />
          </div>
          <div>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={creditLoading || !creditDelta}
              onClick={submitCreditAdjust}
            >
              {creditLoading ? "กำลังบันทึก..." : "ยืนยัน"}
            </button>
          </div>
        </div>
        {creditMsg && (
          <p className={`text-sm ${creditMsg.type === "ok" ? "text-green-700" : "text-red-600"}`}>{creditMsg.text}</p>
        )}
        {creditDelta !== "" && Number(creditDelta) > 0 && (
          <p className="text-xs text-muted">
            วงเงินใหม่จะเป็น:{" "}
            <span className="font-semibold text-brand-800">
              {(creditSign === "increase"
                ? Number(currentLimit) + Number(creditDelta)
                : Number(currentLimit) - Number(creditDelta)
              ).toLocaleString()}{" "}
              บาท
            </span>
          </p>
        )}
      </div>

      {/* ── Temporary Credit Limit ────────────────────────────────────── */}
      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-brand-800">วงเงินสินเชื่อชั่วคราว</h2>
        <p className="text-xs text-muted">เพิ่มวงเงินชั่วคราวสำหรับช่วงเวลาที่กำหนด โดยไม่เปลี่ยนวงเงินหลัก</p>
        <div className="text-xs bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 text-brand-700">
          วงเงินตั้งต้น: <span className="font-semibold">{currentLimit.toLocaleString("th-TH")} บาท</span>
          {" — "}เพิ่มชั่วคราวได้สูงสุด 20% ={" "}
          <span className="font-semibold text-brand-800">{maxTempExtra.toLocaleString("th-TH")} บาท</span>
        </div>
        <div className="grid grid-cols-4 gap-3 items-start">
          <div>
            <label className="label">จำนวนวงเงินเพิ่มเติม (บาท)</label>
            <input
              type="number"
              min="1"
              max={maxTempExtra}
              step="1"
              className="input"
              value={tempExtra}
              onChange={(e) => setTempExtra(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={`สูงสุด ${maxTempExtra.toLocaleString("th-TH")} บาท`}
            />
            {tempExtra !== "" && Number(tempExtra) > maxTempExtra && (
              <p className="text-xs text-red-600 mt-1">
                เกินวงเงินสูงสุด {maxTempExtra.toLocaleString("th-TH")} บาท
              </p>
            )}
          </div>
          <div>
            <label className="label">วันที่เริ่มต้น</label>
            <input type="date" className="input" value={tempStart} onChange={(e) => setTempStart(e.target.value)} />
          </div>
          <div>
            <label className="label">วันที่สิ้นสุด (อัตโนมัติ)</label>
            <input
              type="date"
              className="input bg-gray-50 text-muted cursor-not-allowed"
              value={tempEnd}
              readOnly
              tabIndex={-1}
            />
            <p className="text-[11px] text-muted mt-0.5">= วันเริ่มต้น + {form.default_credit_term_days} วัน (เครดิตของร้านนี้)</p>
          </div>
          <div>
            <label className="label">เหตุผล</label>
            <input className="input" value={tempReason} onChange={(e) => setTempReason(e.target.value)} placeholder="เช่น ช่วงเทศกาล" />
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={tempLoading || !tempExtra || !tempStart || !tempEnd || Number(tempExtra) > maxTempExtra}
          onClick={submitTempCredit}
        >
          {tempLoading ? "กำลังบันทึก..." : "บันทึกวงเงินชั่วคราว"}
        </button>
        {tempMsg && (
          <p className={`text-sm ${tempMsg.type === "ok" ? "text-green-700" : "text-red-600"}`}>{tempMsg.text}</p>
        )}
        
        {/* แสดงวงเงินชั่วคราวที่มีอยู่ */}
        {activeTempCredits.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-brand-800">วงเงินชั่วคราวที่ใช้งานอยู่</h3>
            {activeTempCredits.map((temp) => (
              <div key={temp.id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm">
                  <div className="font-semibold text-green-800">
                    +{Number(temp.extra_amount).toLocaleString()} บาท
                  </div>
                  <div className="text-green-600">
                    {temp.start_date} ถึง {temp.end_date}
                  </div>
                  {temp.reason && (
                    <div className="text-xs text-green-600 mt-1">เหตุผล: {temp.reason}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-danger text-sm px-3 py-1"
                  disabled={deactivateLoading === temp.id}
                  onClick={() => deactivateTempCredit(temp.id)}
                >
                  {deactivateLoading === temp.id ? "กำลังยกเลิก..." : "ยกเลิก"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── File Upload ───────────────────────────────────────────────── */}
      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-brand-800">อัพโหลดไฟล์ประกอบเพิ่มเติม</h2>
        <input
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="input py-1.5 cursor-pointer"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-brand-50 border border-brand-200 rounded px-3 py-1.5">
                <span className="truncate max-w-xs">{f.name}</span>
                <span className="text-muted ml-2">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn-secondary"
          disabled={fileLoading || !files.length}
          onClick={uploadFiles}
        >
          {fileLoading ? "กำลังอัพโหลด..." : "อัพโหลดไฟล์"}
        </button>
        {fileMsg && (
          <p className={`text-sm ${fileMsg.type === "ok" ? "text-green-700" : "text-red-600"}`}>{fileMsg.text}</p>
        )}
      </div>

      {/* ── Danger Zone ───────────────────────────────────────────────── */}
      <div className="card p-6 border-2 border-red-200 bg-red-50">
        <h2 className="font-semibold text-red-800 mb-4">⚠️ บริเวณอันตราย</h2>
        <div className="space-y-3">
          <p className="text-sm text-red-700">
            การลบลูกค้าจะเป็นการถาวรและไม่สามารถย้อนกลับได้ ข้อมูลทั้งหมดจะถูกลบออกจากระบบ
          </p>
          <div className="flex items-center gap-4">
            <DeleteCustomerButton 
              customerId={id} 
              customerName={initial.name} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
