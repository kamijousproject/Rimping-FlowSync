import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { listCustomers } from "@/backend/services/customers";
import { fmtMoney } from "@/components/StatusBadge";
import { getCurrentUser, isSuperAdmin } from "@/backend/auth";
import CustomerSearch from "@/components/CustomerSearch";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; search?: string; page?: string }>;
}) {
  const customers = await listCustomers();
  const user = await getCurrentUser();
  const canCreate = isSuperAdmin(user);
  const sp = await searchParams;

  // Filter customers based on search term
  const filteredCustomers = sp.search
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(sp.search!.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(sp.search!.toLowerCase()))
      )
    : customers;

  // Pagination (frontend-only; slices the already-fetched list)
  const limit = 10;
  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / limit));
  const currentPage = Math.min(page, totalPages);
  const startItem = filteredCustomers.length > 0 ? (currentPage - 1) * limit + 1 : 0;
  const endItem = Math.min(currentPage * limit, filteredCustomers.length);
  const pageCustomers = filteredCustomers.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  );

  function buildPageLink(p: number) {
    const params = new URLSearchParams();
    if (sp.search) params.set("search", sp.search);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/customers?${qs}` : "/customers";
  }

  return (
    <div className="space-y-4">
      {sp.denied && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
          ไม่มีสิทธิ์เพิ่มลูกค้าใหม่ — ต้องเป็น super admin เท่านั้น
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-800">
            ลูกค้าทั้งหมด
          </h1>
          <p className="text-xs md:text-sm text-muted">
            {filteredCustomers.length} รายจาก {customers.length} รายทั้งหมด · จัดการวงเงิน · ลูกหนี้คงค้าง
          </p>
        </div>
        {canCreate && (
          <Link href="/customers/new" className="btn-primary text-sm">
            + เพิ่มลูกค้า
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border bg-gray-50 flex items-center justify-between gap-3">
          <CustomerSearch />
          <p className="text-sm text-muted shrink-0 hidden sm:block">
            {filteredCustomers.length} รายการ
          </p>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-3 space-y-2">
          {pageCustomers.map((c) => {
            const hasTemp = Number(c.temp_extra) > 0;
            const usedPct = c.effective_limit
              ? (Number(c.outstanding) / Number(c.effective_limit)) * 100
              : 0;
            return (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className={`block border rounded-xl p-4 hover:border-brand-200 hover:bg-gray-50 transition ${hasTemp ? "border-amber-300" : "border-border"}`}
              >
                {hasTemp && (
                  <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    ใช้วงเงินชั่วคราว +{fmtMoney(c.temp_extra)} บ
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted">
                      {c.code || "—"}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </div>
                  </div>
                  {c.credit_score != null && (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        c.credit_score >= 700
                          ? "bg-brand-100 text-brand-800"
                          : c.credit_score >= 600
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {c.credit_score}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted text-[10px]">วงเงิน</div>
                    <div className="font-medium">
                      {fmtMoney(c.effective_limit)}
                      {hasTemp && <span className="ml-1 text-[10px] text-amber-600">(+{fmtMoney(c.temp_extra)})</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-[10px]">ใช้ไป</div>
                    <div className="font-medium text-red-600">
                      {fmtMoney(c.outstanding)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-[10px]">คงเหลือ</div>
                    <div className="font-medium text-brand-700">
                      {fmtMoney(c.credit_available)}
                    </div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-brand-100 mt-2 overflow-hidden">
                  <div
                    className={`h-full ${
                      usedPct > 80
                        ? "bg-red-500"
                        : usedPct > 50
                        ? "bg-amber-500"
                        : "bg-brand-600"
                    }`}
                    style={{ width: `${Math.min(100, usedPct)}%` }}
                  />
                </div>
                {Number(c.open_pos || 0) > 0 && (
                  <div className="text-[11px] text-muted mt-2">
                    Quotation เปิดอยู่ {Number(c.open_pos)} ใบ
                  </div>
                )}
              </Link>
            );
          })}
          {filteredCustomers.length === 0 && (
            <div className="text-center text-muted text-sm py-10">
              {sp.search ? `ไม่พบลูกค้าที่ค้นหา: "${sp.search!}"` : "ยังไม่มีลูกค้า"}
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs font-medium text-muted bg-gray-50">
              <tr>
                <th className="text-left p-3.5">รหัส / ชื่อ</th>
                <th className="text-left">ติดต่อ</th>
                <th className="text-right">วงเงิน</th>
                <th className="text-right">ใช้ไป</th>
                <th className="text-right">คงเหลือ</th>
                <th className="text-center">Quotation เปิดอยู่</th>
                <th className="text-center">Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageCustomers.map((c) => {
                const hasTemp = Number(c.temp_extra) > 0;
                const usedPct = c.effective_limit
                  ? (Number(c.outstanding) / Number(c.effective_limit)) * 100
                  : 0;
                return (
                  <tr key={c.id} className={`border-t border-border hover:bg-gray-50 transition-colors ${hasTemp ? "bg-amber-50/40" : ""}`}>
                    <td className="p-3.5">
                      <div className="font-medium flex items-center gap-1.5">
                        {c.name}
                        {hasTemp && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-semibold">วงเงินชั่วคราว</span>
                        )}
                      </div>
                      <div className="text-xs text-muted">{c.code || "-"}</div>
                    </td>
                    <td>
                      <div className="text-xs">{c.phone || "-"}</div>
                      <div className="text-xs text-muted">{c.email || ""}</div>
                    </td>
                    <td className="text-right">
                      <div>{fmtMoney(c.effective_limit)}</div>
                      {hasTemp && <div className="text-[11px] text-amber-600">+{fmtMoney(c.temp_extra)} ชั่วคราว</div>}
                    </td>
                    <td className="text-right text-red-600">
                      {fmtMoney(c.outstanding)}
                    </td>
                    <td className="text-right text-brand-700 font-medium">
                      {fmtMoney(c.credit_available)}
                      <div className="h-1.5 rounded-full bg-brand-100 mt-1 w-24 ml-auto overflow-hidden">
                        <div
                          className={`h-full ${
                            usedPct > 80
                              ? "bg-red-500"
                              : usedPct > 50
                              ? "bg-amber-500"
                              : "bg-brand-600"
                          }`}
                          style={{ width: `${Math.min(100, usedPct)}%` }}
                        />
                      </div>
                    </td>
                    <td className="text-center">{Number(c.open_pos || 0)}</td>
                    <td className="text-center">
                      {c.credit_score ?? (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="pr-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-brand-700 hover:underline text-sm"
                      >
                        ดู →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {pageCustomers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted">
                    {sp.search ? `ไม่พบลูกค้าที่ค้นหา: "${sp.search!}"` : "ยังไม่มีลูกค้า"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-gray-50">
            <p className="text-sm text-muted">
              แสดง {startItem}-{endItem} จาก {filteredCustomers.length} รายการ
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildPageLink(currentPage - 1)}
                aria-disabled={currentPage <= 1}
                className={`btn-secondary text-sm flex items-center gap-1 ${
                  currentPage <= 1 ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">ก่อนหน้า</span>
              </Link>
              <span className="text-sm text-muted px-2">
                หน้า {currentPage} / {totalPages}
              </span>
              <Link
                href={buildPageLink(currentPage + 1)}
                aria-disabled={currentPage >= totalPages}
                className={`btn-secondary text-sm flex items-center gap-1 ${
                  currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <span className="hidden sm:inline">ถัดไป</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
