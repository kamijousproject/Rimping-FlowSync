"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/Brand";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function AbstractPattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.06] pointer-events-none"
      viewBox="0 0 600 800"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <circle cx="520" cy="80" r="220" stroke="white" strokeWidth="1" />
      <circle cx="520" cy="80" r="320" stroke="white" strokeWidth="1" />
      <circle cx="520" cy="80" r="420" stroke="white" strokeWidth="1" />
      <path
        d="M-40 560C80 500 160 640 280 580S520 500 660 560"
        stroke="white"
        strokeWidth="1"
      />
      <path
        d="M-40 660C80 600 160 740 280 680S520 600 660 660"
        stroke="white"
        strokeWidth="1"
      />
    </svg>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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

  const inputClass =
    "w-full h-[52px] rounded-[14px] border border-border bg-white pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0B6B3A] to-[#064E2A] p-14">
        <AbstractPattern />

        {/* Logo, top-left */}
        <div className="relative z-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/10">
            <Image
              src="/logo.svg"
              alt="Rimping"
              width={56}
              height={56}
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>

        {/* Branding, vertically centered */}
        <div className="relative z-10 -mt-14">
          <h1 className="text-[56px] font-bold leading-none tracking-tight text-white">
            FlowSync
          </h1>
          <p className="mt-3 text-sm font-medium text-brand-100">by Rimping</p>
          <p className="mt-6 max-w-[320px] text-sm leading-relaxed text-white/70">
            ระบบบริหารจัดการ Purchase Order, Quotation, Invoice, Payment
            และเอกสารทางธุรกิจ
          </p>
        </div>

        {/* Security note, bottom */}
        <div className="relative z-10 flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
          <div className="text-xs leading-relaxed text-white/60">
            <div className="font-medium text-white/80">ปลอดภัย เชื่อถือได้</div>
            <div>ข้อมูลของคุณได้รับการเข้ารหัสตามมาตรฐานสากล</div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="relative flex flex-1 items-center justify-center bg-white px-6 lg:justify-start lg:px-0 lg:pl-24">
        {/* Language switcher */}
        <button
          type="button"
          disabled
          title="ยังไม่เปิดใช้งาน"
          className="absolute right-6 top-6 inline-flex h-9 cursor-default items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted transition hover:bg-gray-50 lg:right-10 lg:top-8"
        >
          <Globe className="h-4 w-4" />
          TH
        </button>

        <div className="w-full max-w-[440px] py-16">
          {/* Mobile logo */}
          <div className="mb-10 flex justify-center lg:hidden">
            <Brand size={48} />
          </div>

          <h2 className="text-[40px] font-bold leading-tight text-foreground">
            เข้าสู่ระบบ
          </h2>
          <p className="mt-2 text-base text-muted">
            กรอกข้อมูลเพื่อเข้าใช้งานระบบ
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
              <input
                className={inputClass}
                placeholder="Username หรือ Email"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                className={`${inputClass} pr-11`}
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-[18px] w-[18px]" />
                ) : (
                  <Eye className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-100"
                />
                จดจำฉันไว้
              </label>
              <button
                type="button"
                disabled
                title="ยังไม่เปิดใช้งาน"
                className="cursor-default text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>

            {err && (
              <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
                {err}
              </div>
            )}

            <button
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-600 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            ยังไม่มีบัญชี?{" "}
            <span className="font-medium text-foreground">ติดต่อผู้ดูแลระบบ</span>
          </p>
        </div>
      </div>
    </div>
  );
}
