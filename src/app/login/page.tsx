"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Outer card */}
      <div className="w-full max-w-5xl rounded-2xl border border-border shadow-sm overflow-hidden flex min-h-[600px] bg-white">

        {/* Left — flat brand panel with text */}
        <div className="hidden lg:flex lg:w-[42%] relative flex-col justify-between p-14 overflow-hidden bg-brand-700">
          {/* Logo */}
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
              <Image src="/logo.svg" alt="FlowSync" width={40} height={40} style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }} />
            </div>
          </div>

          {/* Text */}
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white leading-tight">
              FlowSync
            </h2>
            <p className="text-brand-100 font-medium text-sm mt-1">
              by Rimping
            </p>
            <p className="text-brand-50/80 text-sm mt-4 leading-relaxed max-w-[240px]">
              ระบบบริหารการขายแบบสินเชื่อ จัดการ Quotation, Invoice, การชำระเงิน และเอกสารในที่เดียว
            </p>
          </div>
        </div>

        {/* Right — white form */}
        <div className="flex-1 bg-white flex items-center justify-center p-8 md:p-14">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex justify-center mb-8 lg:hidden">
              <Brand size={48} />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-1.5">เข้าสู่ระบบ</h1>
            <p className="text-sm text-muted mb-8">กรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Username หรือ Email</label>
                <input
                  className="input"
                  placeholder="Username หรือ Email"
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
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {err && (
                <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {err}
                </div>
              )}

              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-muted">
              ผู้ใช้ใหม่ต้องลงทะเบียนโดยผู้ดูแลระบบเท่านั้น
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
