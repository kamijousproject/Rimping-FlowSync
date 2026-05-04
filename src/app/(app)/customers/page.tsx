import Link from "next/link";
import { listCustomers } from "@/backend/services/customers";
import { fmtMoney } from "@/components/StatusBadge";
import { getCurrentUser, isSuperAdmin } from "@/backend/auth";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const customers = await listCustomers();
  const user = await getCurrentUser();
  const canCreate = isSuperAdmin(user);
  const sp = await searchParams;
  return (
    <div className="space-y-4">
      {sp.denied && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
          ไม่มีสิทธิ์เพิ่มลูกค้าใหม่ — ต้องเป็น super admin เท่านั้น
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-800">
            ลูกค้าทั้งหมด
          </h1>
          <p className="text-xs md:text-sm text-muted">
            {customers.length} ราย · จัดการวงเงิน · ลูกหนี้คงค้าง
          </p>
        </div>
        {canCreate && (
          <Link href="/customers/new" className="btn-primary text-sm">
            + เพิ่มลูกค้า
          </Link>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {customers.map((c) => {
          const hasTemp = Number(c.temp_extra) > 0;
          const usedPct = c.effective_limit
            ? (Number(c.outstanding) / Number(c.effective_limit)) * 100
            : 0;
          return (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className={`block card p-4 active:scale-[0.99] transition ${hasTemp ? "border-amber-300" : ""}`}
            >
              {hasTemp && (
                <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded px-2 py-0.5 mb-2">
                  ⚠️ ใช้วงเงินชั่วคราว +{fmtMoney(c.temp_extra)} บ
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
                  PO เปิดอยู่ {Number(c.open_pos)} ใบ
                </div>
              )}
            </Link>
          );
        })}
        {customers.length === 0 && (
          <div className="card p-8 text-center text-muted text-sm">
            ยังไม่มีลูกค้า
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted bg-brand-50">
            <tr>
              <th className="text-left p-3">รหัส / ชื่อ</th>
              <th className="text-left">ติดต่อ</th>
              <th className="text-right">วงเงิน</th>
              <th className="text-right">ใช้ไป</th>
              <th className="text-right">คงเหลือ</th>
              <th className="text-center">PO เปิดอยู่</th>
              <th className="text-center">Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const hasTemp = Number(c.temp_extra) > 0;
              const usedPct = c.effective_limit
                ? (Number(c.outstanding) / Number(c.effective_limit)) * 100
                : 0;
              return (
                <tr key={c.id} className={`border-t hover:bg-brand-50/40 ${hasTemp ? "bg-amber-50/40" : ""}`}>
                  <td className="p-3">
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
            {customers.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted">
                  ยังไม่มีลูกค้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
