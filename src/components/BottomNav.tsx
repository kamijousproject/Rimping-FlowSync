"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Plus,
  LogOut,
} from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "หน้าหลัก", Icon: LayoutDashboard },
  { href: "/customers", label: "ลูกค้า", Icon: Users },
  { href: "/po/new", label: "สร้าง PO", Icon: Plus, primary: true },
  { href: "/po", label: "PO", Icon: Package },
];

export function BottomNav() {
  const path = usePathname();

  function isActive(href: string) {
    const isCreate = href.endsWith("/new");
    if (isCreate) return path === href;
    if (href === "/dashboard") return path === href;
    return (
      path === href ||
      (path.startsWith(href + "/") && !path.endsWith("/new"))
    );
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 items-end h-16">
        {ITEMS.slice(0, 2).map((it) => {
          const active = isActive(it.href);
          const Icon = it.Icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center justify-center gap-1 h-full text-[10px] transition ${
                active ? "text-brand-700" : "text-muted"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`}
              />
              <span className="font-medium">{it.label}</span>
            </Link>
          );
        })}

        {/* Center FAB-style "Create PO" */}
        <div className="flex items-start justify-center -mt-5">
          <Link
            href="/po/new"
            className={`w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg ring-4 ring-background active:scale-95 transition ${
              path === "/po/new" ? "bg-brand-700" : ""
            }`}
            aria-label="สร้าง PO"
          >
            <Plus className="w-7 h-7" />
          </Link>
        </div>

        {ITEMS.slice(3).map((it) => {
          const active = isActive(it.href);
          const Icon = it.Icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center justify-center gap-1 h-full text-[10px] transition ${
                active ? "text-brand-700" : "text-muted"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`}
              />
              <span className="font-medium">{it.label}</span>
            </Link>
          );
        })}

        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="flex flex-col items-center justify-center gap-1 h-full text-[10px] text-muted active:text-red-600"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">ออก</span>
        </button>
      </div>
    </nav>
  );
}
