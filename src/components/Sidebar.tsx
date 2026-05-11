"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "./Brand";
import {
  LayoutDashboard,
  Users,
  Package,
  PlusCircle,
  BookOpen,
  UsersRound,
  FileText,
  ChevronDown,
  Receipt,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";

interface SubMenuItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

interface MenuGroup {
  id: string;
  label: string;
  Icon: LucideIcon;
  items: SubMenuItem[];
}

const SINGLE_NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/customers", label: "ลูกค้า", Icon: Users },
];

const MENU_GROUPS: MenuGroup[] = [
  {
    id: "po",
    label: "Purchase Orders",
    Icon: Package,
    items: [
      { href: "/po", label: "รายการ PO", Icon: FileText },
      { href: "/po/new", label: "สร้าง PO ใหม่", Icon: PlusCircle },
    ],
  },
  {
    id: "invoices",
    label: "เอกสารกำกับการขาย",
    Icon: FileText,
    items: [
      { href: "/receipts", label: "ใบเสร็จ", Icon: Receipt },
      { href: "/billing-notes", label: "ใบวางบิล", Icon: FileSpreadsheet },
    ],
  },
];

function NavGroup({
  group,
  path,
}: {
  group: MenuGroup;
  path: string;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    // เปิดอัตโนมัติถ้าอยู่ใน group นี้
    return group.items.some((item) =>
      path === item.href || path.startsWith(item.href + "/")
    );
  });

  const isActive = group.items.some(
    (item) =>
      path === item.href ||
      (path.startsWith(item.href + "/") && !item.href.endsWith("/new"))
  );

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
          isActive
            ? "bg-brand-600 text-white"
            : "text-foreground hover:bg-brand-50 hover:text-brand-700"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <group.Icon className="w-4 h-4" />
          <span>{group.label}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="ml-4 pl-2 border-l border-border space-y-1">
          {group.items.map((item) => {
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                  active
                    ? "bg-brand-100 text-brand-700 font-medium"
                    : "text-muted-foreground hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <item.Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  user,
}: {
  user: { full_name: string; role: string; username: string };
}) {
  const path = usePathname();
  return (
    <aside className="hidden md:flex print:hidden w-60 bg-white border-r border-border h-screen sticky top-0 flex-col overflow-hidden">
      <div className="p-4 border-b border-border">
        <Brand size={40} />
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {/* Single Menu Items */}
        {SINGLE_NAV.map((n) => {
          const isCreatePage = n.href.endsWith("/new");
          const active = isCreatePage
            ? path === n.href
            : path === n.href ||
              (path.startsWith(n.href + "/") && !path.endsWith("/new"));
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
              <n.Icon className="w-4 h-4" />
              <span>{n.label}</span>
            </Link>
          );
        })}

        {/* Menu Groups with Sub-menu */}
        {MENU_GROUPS.map((group) => (
          <NavGroup key={group.id} group={group} path={path} />
        ))}

        {/* Super Admin Only */}
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
