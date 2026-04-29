"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    code: "",
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    tax_id: "",
    address: "",
    credit_limit: 0,
    credit_score: "",
    credit_score_notes: "",
    default_credit_term_days: 30,
    notes: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
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
    const r = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "บันทึกไม่สำเร็จ");
      return;
    }
    const data = await r.json();
    router.push(`/customers/${data.id}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">เพิ่มลูกค้าใหม่</h1>
        <p className="text-sm text-muted">
          ระบุข้อมูลลูกค้า วงเงิน และ credit score (ภายหลังจะเปลี่ยนเป็น AI ประเมิน)
        </p>
      </div>
      <form onSubmit={submit} className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">รหัสลูกค้า (ไม่บังคับ)</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder="เช่น C001"
            />
          </div>
          <div>
            <label className="label">ชื่อกิจการ / ลูกค้า *</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className="label">ผู้ติดต่อ</label>
            <input
              className="input"
              value={form.contact_person}
              onChange={(e) => set("contact_person", e.target.value)}
            />
          </div>
          <div>
            <label className="label">โทรศัพท์</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <label className="label">เลขผู้เสียภาษี</label>
            <input
              className="input"
              value={form.tax_id}
              onChange={(e) => set("tax_id", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="label">ที่อยู่</label>
            <textarea
              className="input"
              rows={2}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-brand-800 mb-3">
            ข้อมูลสินเชื่อ (Credit)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">วงเงิน (บาท) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                required
                value={form.credit_limit}
                onChange={(e) => set("credit_limit", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">เครดิต (วัน) เริ่มต้น</label>
              <select
                className="input"
                value={form.default_credit_term_days}
                onChange={(e) =>
                  set("default_credit_term_days", Number(e.target.value))
                }
              >
                <option value={7}>7 วัน</option>
                <option value={15}>15 วัน</option>
                <option value={30}>30 วัน</option>
                <option value={60}>60 วัน</option>
              </select>
            </div>
            <div>
              <label className="label">
                Credit Score (0-1000, AI ภายหลัง)
              </label>
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
              <input
                className="input"
                value={form.credit_score_notes}
                onChange={(e) => set("credit_score_notes", e.target.value)}
                placeholder="ระยะแรกกรอกเอง ภายหลังจะให้ AI ประเมิน"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label">บันทึกเพิ่มเติม</label>
          <textarea
            className="input"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn-primary" disabled={loading}>
            {loading ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          <Link href="/customers" className="btn-secondary">
            ยกเลิก
          </Link>
        </div>
      </form>
    </div>
  );
}
