"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import {
  LayoutDashboard,
  Users,
  Package,
  PlusCircle,
  BookOpen,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/customers", label: "ลูกค้า", Icon: Users },
  { href: "/po", label: "Purchase Orders", Icon: Package },
  { href: "/po/new", label: "สร้าง PO ใหม่", Icon: PlusCircle },
];

export function Sidebar({
  user,
}: {
  user: { full_name: string; role: string; username: string };
}) {
  const path = usePathname();
  return (
    <aside className="hidden md:flex print:hidden w-60 bg-white border-r border-border min-h-screen flex-col">
      <div className="p-4 border-b border-border">
        <Brand size={40} />
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map((n) => {
          // Exact match for "create" pages so they don't double-highlight
          // with their parent list page.
          const isCreatePage = n.href.endsWith("/new");
          const active = isCreatePage
            ? path === n.href
            : path === n.href ||
              (path.startsWith(n.href + "/") && !path.endsWith("/new"));
          const Icon = n.Icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-brand-600 text-white"
                  : "text-foreground hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{n.label}</span>
            </Link>
          );
        })}
        {user.role === "super_admin" && (
          <Link
            href="/users"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
              path.startsWith("/users")
                ? "bg-brand-600 text-white"
                : "text-foreground hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            <UsersRound className="w-4 h-4" />
            <span>ผู้ใช้ในระบบ</span>
          </Link>
        )}
      </nav>
      <div className="p-3 border-t border-border space-y-3">
        <div>
          <div className="text-xs text-muted">เข้าใช้ในชื่อ</div>
          <div className="text-sm font-medium">{user.full_name}</div>
          <div className="text-xs text-muted">
            @{user.username} · {user.role}
          </div>
        </div>
        
        <button
          onClick={() => {
            window.open("/manual", "_blank");
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition text-foreground hover:bg-brand-50 hover:text-brand-700 w-full"
        >
          <BookOpen className="w-4 h-4" />
          <span>คู่มือการใช้งาน</span>
        </button>
        
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="btn-secondary w-full text-xs"
        >
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
