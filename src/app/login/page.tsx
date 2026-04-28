"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-brand-50 via-background to-brand-100">
      <div className="w-full max-w-md card p-8">
        <div className="mb-6 flex flex-col items-center">
          <Brand size={56} />
          <h1 className="mt-4 text-xl font-semibold text-brand-800">
            เข้าสู่ระบบ
          </h1>
          <p className="text-sm text-muted">FlowSync · ระบบขายแบบสินเชื่อ</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Username หรือ Email</label>
            <input
              className="input"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">รหัสผ่าน</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-muted">
          ระบบหลังบ้าน — ผู้ใช้ใหม่ต้อง{" "}
          <Link
            href="/register"
            className="text-brand-700 hover:underline font-medium"
          >
            ลงทะเบียน
          </Link>{" "}
          โดยผู้ดูแลเท่านั้น
        </div>
      </div>
    </div>
  );
}
