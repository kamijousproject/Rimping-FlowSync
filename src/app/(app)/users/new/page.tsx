"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    role: "admin" as "admin" | "super_admin",
  });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "สร้างบัญชีไม่สำเร็จ");
      return;
    }
    setOk(true);
    setTimeout(() => router.back(), 1500);
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-brand-700 hover:underline"
        >
          ← กลับ
        </button>
        <h1 className="text-2xl font-bold text-brand-800 mt-1">
          สร้างบัญชีผู้ใช้ใหม่
        </h1>
        <p className="text-sm text-muted">เฉพาะ Super Admin เท่านั้น</p>
      </div>

      <div className="card p-6">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">ชื่อ-นามสกุล</label>
            <input
              className="input"
              required
              placeholder="เช่น สมชาย ใจดี (จะแสดงในช่องเซ็นชื่อผู้ขายบนเอกสาร Quotation และ Invoice)"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                required
                minLength={3}
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">สิทธิ์การใช้งาน</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as "admin" | "super_admin" })
              }
            >
              <option value="admin">Admin — ใช้งานทั่วไป</option>
              <option value="super_admin">Super Admin — จัดการลูกค้าและระบบ</option>
            </select>
          </div>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          {ok && (
            <div className="text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
              สร้างบัญชีสำเร็จ
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1"
            >
              ยกเลิก
            </button>
            <button className="btn-primary flex-1" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "สร้างบัญชี"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
