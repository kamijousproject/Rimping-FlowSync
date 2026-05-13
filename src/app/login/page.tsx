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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #e8f5ec 0%, #c8e6cf 100%)" }}
    >
      {/* Outer card */}
      <div className="w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex min-h-[620px]">

        {/* Left — green gradient with text */}
        <div
          className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-14 overflow-hidden"
          style={{ background: "linear-gradient(145deg, #3f9a4d 0%, #2f8b46 40%, #185028 100%)" }}
        >
          {/* Circle decorations */}
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-white/10" />
          <div className="absolute top-10 -right-16 w-56 h-56 rounded-full bg-white/5" />

          {/* Logo */}
          <div className="relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg">
              <Image src="/logo.svg" alt="FlowSync" width={52} height={52} style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }} />
            </div>
          </div>

          {/* Text */}
          <div className="relative z-10">
            <h2 className="text-5xl font-extrabold text-white uppercase tracking-wide leading-tight">
              WELCOME
            </h2>
            <p className="text-green-200 font-semibold text-sm mt-1 uppercase tracking-widest">
              FlowSync · by Rimping
            </p>
            <p className="text-green-100/70 text-xs mt-4 leading-relaxed max-w-[220px]">
              ระบบบริหารการขายแบบสินเชื่อ จัดการ PO, Invoice, การชำระเงิน และเอกสารในที่เดียว
            </p>
          </div>
        </div>

        {/* Right — white form */}
        <div className="flex-1 bg-white flex items-center justify-center p-14">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex justify-center mb-8 lg:hidden">
              <Brand size={52} />
            </div>

            <h1 className="text-4xl font-bold text-brand-900 mb-2">เข้าสู่ระบบ</h1>
            <p className="text-base text-muted mb-10">กรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>

            <form onSubmit={submit} className="space-y-6">
              <div>
                <input
                  className="w-full border border-gray-200 rounded-xl px-5 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition placeholder:text-gray-400"
                  placeholder="Username หรือ Email"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-xl px-5 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition placeholder:text-gray-400"
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {err && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {err}
                </div>
              )}

              <button
                className="w-full py-4 rounded-xl text-base font-semibold text-white transition disabled:opacity-60"
                style={{ background: "linear-gradient(90deg, #3f9a4d, #2f8b46)" }}
                disabled={loading}
              >
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
