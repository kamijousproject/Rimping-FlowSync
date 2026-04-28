"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    role: "staff" as "staff" | "admin",
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
      setErr(d.error || "ลงทะเบียนไม่สำเร็จ");
      return;
    }
    setOk(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-50 via-background to-brand-100">
      <div className="w-full max-w-md card p-8">
        <div className="mb-6 flex flex-col items-center">
          <Brand size={56} />
          <h1 className="mt-4 text-xl font-semibold text-brand-800">
            ลงทะเบียนผู้ใช้ใหม่
          </h1>
          <p className="text-xs text-muted text-center mt-1">
            หน้านี้สำหรับผู้ดูแลระบบเพื่อสร้างบัญชีพนักงาน
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              required
              minLength={3}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
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
          <div>
            <label className="label">ชื่อ-นามสกุล</label>
            <input
              className="input"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
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
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as "staff" | "admin" })
              }
            >
              <option value="staff">staff</option>
              <option value="admin">admin</option>
            </select>
          </div>
          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          {ok && (
            <div className="text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
              ลงทะเบียนสำเร็จ กำลังพาไปหน้าเข้าสู่ระบบ...
            </div>
          )}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "กำลังบันทึก..." : "ลงทะเบียน"}
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-muted">
          มีบัญชีแล้ว?{" "}
          <Link href="/login" className="text-brand-700 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
