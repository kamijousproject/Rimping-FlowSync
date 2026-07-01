"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, BookOpen, UserRound } from "lucide-react";

const TITLE_RULES: { test: RegExp; title: string }[] = [
  { test: /^\/dashboard/, title: "Dashboard" },
  { test: /^\/customers\/new/, title: "เพิ่มลูกค้าใหม่" },
  { test: /^\/customers\/[^/]+\/edit/, title: "แก้ไขข้อมูลลูกค้า" },
  { test: /^\/customers\/[^/]+\/billing-notes\/new/, title: "สร้างใบวางบิล" },
  { test: /^\/customers\/[^/]+\/billing-notes\//, title: "ใบวางบิล" },
  { test: /^\/customers\/[^/]+/, title: "รายละเอียดลูกค้า" },
  { test: /^\/customers/, title: "ลูกค้า" },
  { test: /^\/po\/new/, title: "สร้าง Quotation ใหม่" },
  { test: /^\/po\/[^/]+\/edit/, title: "แก้ไข Quotation" },
  { test: /^\/po\/[^/]+\/invoice/, title: "ใบแจ้งหนี้ / Invoice" },
  { test: /^\/po\/[^/]+\/quotation/, title: "ใบเสนอราคา" },
  { test: /^\/po\/[^/]+\/credit-note/, title: "ใบลดหนี้" },
  { test: /^\/po\/[^/]+/, title: "รายละเอียด Quotation" },
  { test: /^\/po/, title: "Quotation" },
  { test: /^\/invoices\/new/, title: "สร้าง Invoice" },
  { test: /^\/invoices/, title: "Invoice ทั้งหมด" },
  { test: /^\/receipts/, title: "ใบเสร็จ" },
  { test: /^\/billing-notes/, title: "ใบวางบิล" },
  { test: /^\/users\/new/, title: "เพิ่มผู้ใช้ใหม่" },
  { test: /^\/users/, title: "ผู้ใช้ในระบบ" },
];

function getTitle(path: string) {
  return TITLE_RULES.find((r) => r.test.test(path))?.title ?? "FlowSync";
}

export function Navbar({
  user,
}: {
  user: { full_name: string; role: string; username: string };
}) {
  const path = usePathname();
  const title = getTitle(path);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = user.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="hidden md:flex print:hidden h-[72px] shrink-0 items-center justify-between border-b border-border bg-white px-6">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          title="ยังไม่เปิดใช้งาน"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted cursor-default hover:bg-gray-50"
        >
          <Bell className="h-[18px] w-[18px]" />
        </button>

        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-gray-50 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials || <UserRound className="h-4 w-4" />}
            </div>
            <div className="hidden lg:block text-left leading-tight">
              <div className="text-sm font-medium text-foreground">
                {user.full_name}
              </div>
              <div className="text-xs text-muted">
                @{user.username} · {user.role}
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-white shadow-lg py-1.5 z-50">
              <div className="px-3 py-2 border-b border-border">
                <div className="text-sm font-medium text-foreground">
                  {user.full_name}
                </div>
                <div className="text-xs text-muted">
                  @{user.username} · {user.role}
                </div>
              </div>
              <button
                onClick={() => window.open("/manual", "_blank")}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-gray-50"
              >
                <BookOpen className="h-4 w-4" />
                คู่มือการใช้งาน
              </button>
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
