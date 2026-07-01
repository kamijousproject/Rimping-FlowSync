"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Plus,
  LogOut,
  FileText,
} from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "หน้าหลัก", Icon: LayoutDashboard },
  { href: "/customers", label: "ลูกค้า", Icon: Users },
  { href: "/po", label: "Quotation", Icon: Package },
  { href: "/invoices", label: "Invoice", Icon: FileText },
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

  const isPoPath = path.startsWith("/po");
  const isInvoicePath = path.startsWith("/invoices");

  return (
    <nav
      className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 items-end h-16">
        {/* หน้าหลัก */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center gap-1 h-full text-[10px] transition ${
            isActive("/dashboard") ? "text-brand-700" : "text-muted"
          }`}
        >
          <LayoutDashboard
            className={`w-5 h-5 ${isActive("/dashboard") ? "stroke-[2.5]" : ""}`}
          />
          <span className="font-medium">หน้าหลัก</span>
        </Link>

        {/* ลูกค้า */}
        <Link
          href="/customers"
          className={`flex flex-col items-center justify-center gap-1 h-full text-[10px] transition ${
            isActive("/customers") ? "text-brand-700" : "text-muted"
          }`}
        >
          <Users
            className={`w-5 h-5 ${isActive("/customers") ? "stroke-[2.5]" : ""}`}
          />
          <span className="font-medium">ลูกค้า</span>
        </Link>

        {/* Center FAB-style Quick Create */}
        <div className="flex items-start justify-center -mt-5">
          <Link
            href={isInvoicePath ? "/invoices/new" : "/po/new"}
            className={`w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg ring-4 ring-background active:scale-95 transition ${
              path.endsWith("/new") ? "bg-brand-700" : ""
            }`}
            aria-label={isInvoicePath ? "สร้าง Invoice" : "สร้าง Quotation"}
          >
            <Plus className="w-7 h-7" />
          </Link>
        </div>

        {/* PO */}
        <Link
          href="/po"
          className={`flex flex-col items-center justify-center gap-1 h-full text-[10px] transition ${
            isPoPath && !path.endsWith("/new") ? "text-brand-700" : "text-muted"
          }`}
        >
          <Package
            className={`w-5 h-5 ${isPoPath && !path.endsWith("/new") ? "stroke-[2.5]" : ""}`}
          />
          <span className="font-medium">Quotation</span>
        </Link>

        {/* Invoice */}
        <Link
          href="/invoices"
          className={`flex flex-col items-center justify-center gap-1 h-full text-[10px] transition ${
            isInvoicePath && !path.endsWith("/new") ? "text-brand-700" : "text-muted"
          }`}
        >
          <FileText
            className={`w-5 h-5 ${isInvoicePath && !path.endsWith("/new") ? "stroke-[2.5]" : ""}`}
          />
          <span className="font-medium">Invoice</span>
        </Link>
      </div>
    </nav>
  );
}
