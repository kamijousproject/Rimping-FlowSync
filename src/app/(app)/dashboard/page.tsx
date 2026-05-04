import Link from "next/link";
import { getDashboardStats } from "@/backend/services/dashboard";
import { listCustomers } from "@/backend/services/customers";
import { PaymentBadge, StatusBadge, fmtMoney } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const STATUS_LIST = [
  "draft",
  "confirmed",
  "packed",
  "checked",
  "delivered",
  "received",
  "cancelled",
];

const STATUS_LABEL_TH: Record<string, string> = {
  draft: "ร่าง",
  confirmed: "ยืนยัน",
  packed: "แพ็ค",
  checked: "ตรวจ",
  delivered: "ส่ง",
  received: "รับของ",
  cancelled: "ยกเลิก",
};

export default async function DashboardPage() {
  const [stats, customers] = await Promise.all([
    getDashboardStats(),
    listCustomers(),
  ]);

  const cards = [
    {
      label: "ลูกหนี้คงค้างรวม",
      value: fmtMoney(stats.total_outstanding),
      sub: "บาท",
      cls: "from-brand-600 to-brand-700",
    },
    {
      label: "วงเงินรวมทั้งระบบ",
      value: fmtMoney(stats.total_credit_limit),
      sub: "บาท",
      cls: "from-emerald-500 to-brand-600",
    },
    {
      label: "จำนวนลูกหนี้",
      value: stats.total_debtors.toLocaleString(),
      sub: `จาก ${stats.total_customers.toLocaleString()} ราย`,
      cls: "from-teal-500 to-brand-600",
    },
    {
      label: "PO เกินกำหนด",
      value: stats.overdue_count.toLocaleString(),
      sub: `${fmtMoney(stats.overdue_amount)} บาท`,
      cls: "from-red-500 to-red-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-800">
            Dashboard
          </h1>
          <p className="text-xs md:text-sm text-muted">ภาพรวมระบบ FlowSync</p>
        </div>
        <Link href="/po/new" className="btn-primary hidden md:inline-flex">
          + สร้าง PO ใหม่
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl p-4 md:p-5 text-white bg-gradient-to-br ${c.cls} shadow-sm`}
          >
            <div className="text-[11px] md:text-xs opacity-90">{c.label}</div>
            <div className="text-lg md:text-2xl font-bold mt-1 break-all">
              {c.value}
            </div>
            <div className="text-[10px] md:text-xs opacity-90 mt-0.5">
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">สถานะ PO ทั้งหมด</h3>
          <div className="space-y-2">
            {STATUS_LIST.map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <StatusBadge status={s} />
                <span className="font-medium">
                  {stats.pos_by_status[s] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">สถานะการชำระเงิน</h3>
          <div className="space-y-2">
            {(["unpaid", "partial", "paid"] as const).map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <PaymentBadge status={s} />
                <span className="font-medium">
                  {stats.pos_by_payment[s] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">สรุปวงเงิน</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">วงเงินรวม</span>
              <span>{fmtMoney(stats.total_credit_limit)} ฿</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">ใช้ไป (ลูกหนี้)</span>
              <span className="text-red-600">
                {fmtMoney(stats.total_credit_used)} ฿
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">วงเงินคงเหลือ</span>
              <span className="font-bold text-brand-700">
                {fmtMoney(
                  stats.total_credit_limit - stats.total_credit_used
                )}{" "}
                ฿
              </span>
            </div>
            <div className="h-2 rounded-full bg-brand-100 mt-2 overflow-hidden">
              <div
                className="h-full bg-brand-600"
                style={{
                  width: `${Math.min(
                    100,
                    stats.total_credit_limit
                      ? (stats.total_credit_used / stats.total_credit_limit) *
                          100
                      : 0
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-brand-800">ลูกค้าทั้งหมด</h3>
          <Link href="/customers" className="text-sm text-brand-700 hover:underline">
            จัดการลูกค้า →
          </Link>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {customers.map((c) => {
            const usedPct = c.effective_limit
              ? (Number(c.outstanding) / Number(c.effective_limit)) * 100
              : 0;
            return (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="block card p-4 active:scale-[0.99] transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted">
                      {c.code || "—"}{c.phone ? ` · ${c.phone}` : ""}
                    </div>
                  </div>
                  {c.credit_score != null && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      c.credit_score >= 700 ? "bg-brand-100 text-brand-800"
                      : c.credit_score >= 600 ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-700"
                    }`}>{c.credit_score}</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted text-[10px]">วงเงิน</div>
                    <div className="font-medium">{fmtMoney(c.effective_limit)}</div>
                  </div>
                  <div>
                    <div className="text-muted text-[10px]">ใช้ไป</div>
                    <div className="font-medium text-red-600">{fmtMoney(c.outstanding)}</div>
                  </div>
                  <div>
                    <div className="text-muted text-[10px]">คงเหลือ</div>
                    <div className="font-medium text-brand-700">{fmtMoney(c.credit_available)}</div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-brand-100 mt-2 overflow-hidden">
                  <div
                    className={`h-full ${
                      usedPct > 80 ? "bg-red-500" : usedPct > 50 ? "bg-amber-500" : "bg-brand-600"
                    }`}
                    style={{ width: `${Math.min(100, usedPct)}%` }}
                  />
                </div>
                {Number(c.open_pos || 0) > 0 && (
                  <div className="text-[11px] text-muted mt-2">PO เปิดอยู่ {Number(c.open_pos)} ใบ</div>
                )}
              </Link>
            );
          })}
          {customers.length === 0 && (
            <div className="card p-8 text-center text-muted text-sm">ยังไม่มีลูกค้า</div>
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
                const usedPct = c.effective_limit
                  ? (Number(c.outstanding) / Number(c.effective_limit)) * 100
                  : 0;
                return (
                  <tr key={c.id} className="border-t hover:bg-brand-50/40">
                    <td className="p-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted">{c.code || "-"}</div>
                    </td>
                    <td>
                      <div className="text-xs">{c.phone || "-"}</div>
                      <div className="text-xs text-muted">{c.email || ""}</div>
                    </td>
                    <td className="text-right">
                      {fmtMoney(c.effective_limit)}
                      {c.temp_extra > 0 && (
                        <div className="text-[10px] text-blue-600">+{fmtMoney(c.temp_extra)} ชั่วคราว</div>
                      )}
                    </td>
                    <td className="text-right text-red-600">{fmtMoney(c.outstanding)}</td>
                    <td className="text-right text-brand-700 font-medium">
                      {fmtMoney(c.credit_available)}
                      <div className="h-1.5 rounded-full bg-brand-100 mt-1 w-24 ml-auto overflow-hidden">
                        <div
                          className={`h-full ${
                            usedPct > 80 ? "bg-red-500" : usedPct > 50 ? "bg-amber-500" : "bg-brand-600"
                          }`}
                          style={{ width: `${Math.min(100, usedPct)}%` }}
                        />
                      </div>
                    </td>
                    <td className="text-center">{Number(c.open_pos || 0)}</td>
                    <td className="text-center">
                      {c.credit_score ?? <span className="text-muted text-xs">—</span>}
                    </td>
                    <td className="pr-3">
                      <Link href={`/customers/${c.id}`} className="text-brand-700 hover:underline text-sm">
                        ดู →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted">ยังไม่มีลูกค้า</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
