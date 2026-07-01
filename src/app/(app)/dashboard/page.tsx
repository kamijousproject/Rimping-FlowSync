import Link from "next/link";
import { getDashboardStats } from "@/backend/services/dashboard";
import { listCustomers } from "@/backend/services/customers";
import { PaymentBadge, StatusBadge, fmtMoney } from "@/components/StatusBadge";
import { PoStatusDonut } from "@/components/charts/PoStatusDonut";
import { PaymentBarChart } from "@/components/charts/PaymentBarChart";
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Wallet,
  CreditCard,
  Users as UsersIcon,
} from "lucide-react";

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
      Icon: Wallet,
      iconCls: "bg-red-50 text-danger",
    },
    {
      label: "วงเงินรวมทั้งระบบ",
      value: fmtMoney(stats.total_credit_limit),
      sub: "บาท",
      Icon: CreditCard,
      iconCls: "bg-brand-50 text-brand-600",
    },
    {
      label: "จำนวนลูกหนี้",
      value: stats.total_debtors.toLocaleString(),
      sub: `จาก ${stats.total_customers.toLocaleString()} ราย`,
      Icon: UsersIcon,
      iconCls: "bg-blue-50 text-blue-600",
    },
    {
      label: "Quotation เกินกำหนด",
      value: stats.overdue_count.toLocaleString(),
      sub: `${fmtMoney(stats.overdue_amount)} บาท`,
      Icon: AlertTriangle,
      iconCls: "bg-amber-50 text-warning",
    },
  ];

  const poStatusItems = STATUS_LIST.map((s) => ({
    key: s,
    label: STATUS_LABEL_TH[s],
    count: stats.pos_by_status[s] || 0,
  }));

  const paymentItems = (["unpaid", "partial", "paid"] as const).map((s) => ({
    key: s,
    label: s === "unpaid" ? "ยังไม่ชำระ" : s === "partial" ? "ชำระบางส่วน" : "ชำระครบ",
    count: stats.pos_by_payment[s] || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-[32px] font-bold text-foreground leading-tight">
            Dashboard
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1">ภาพรวมระบบ FlowSync</p>
        </div>
        <Link href="/po/new" className="btn-primary hidden md:inline-flex">
          + สร้าง Quotation ใหม่
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4 md:p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconCls}`}>
              <c.Icon className="w-[18px] h-[18px]" />
            </div>
            <div className="text-xs md:text-sm text-muted mt-3">{c.label}</div>
            <div className="text-xl md:text-3xl font-semibold mt-1 text-foreground break-all">
              {c.value}
            </div>
            <div className="text-[11px] md:text-xs text-muted mt-0.5">
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-[15px]">สถานะ Quotation ทั้งหมด</h3>
          </div>
          <PoStatusDonut items={poStatusItems} />
          <div className="mt-4 space-y-2">
            {poStatusItems.map((it) => (
              <div key={it.key} className="flex items-center justify-between text-sm">
                <StatusBadge status={it.key} />
                <span className="font-medium text-foreground">{it.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-[15px]">สถานะการชำระเงิน</h3>
          </div>
          <PaymentBarChart items={paymentItems} />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-[15px] mb-4">สรุปวงเงิน</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">วงเงินรวม</span>
              <span className="font-medium">{fmtMoney(stats.total_credit_limit)} ฿</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">ใช้ไป (ลูกหนี้)</span>
              <span className="text-danger font-medium">
                {fmtMoney(stats.total_credit_used)} ฿
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2.5">
              <span className="font-medium">วงเงินคงเหลือ</span>
              <span className="font-semibold text-brand-700">
                {fmtMoney(
                  stats.total_credit_limit - stats.total_credit_used
                )}{" "}
                ฿
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 mt-3 overflow-hidden">
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

      {/* PO ที่เลยกำหนดชำระ */}
      {stats.overdue_pos.length > 0 && (
        <div className="card p-5 border-l-2 border-l-danger">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <h3 className="font-semibold text-[15px] text-foreground">Quotation ที่เลยกำหนดชำระ</h3>
            <span className="badge bg-red-50 text-danger">
              {stats.overdue_pos.length} รายการ
            </span>
          </div>
          <div className="space-y-2">
            {stats.overdue_pos.map((po) => (
              <Link
                key={po.id}
                href={`/po/${po.id}`}
                className="block rounded-xl p-3.5 border border-border hover:border-red-200 hover:bg-red-50/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{po.po_number}</span>
                      <StatusBadge status={po.status} />
                      <PaymentBadge status={po.payment_status} />
                    </div>
                    <div className="text-sm text-danger mt-1">
                      {po.customer_name} · เลยกำหนด {po.days_overdue} วัน
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-foreground">
                      {fmtMoney(po.remaining_amount)}
                    </div>
                    <div className="text-xs text-muted">คงเหลือ</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              รวมยอดเลยกำหนด:
            </span>
            <span className="font-semibold text-danger text-lg">
              {fmtMoney(stats.overdue_amount)}
            </span>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[15px] text-foreground">ลูกค้าทั้งหมด</h3>
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
                  <div className="text-[11px] text-muted mt-2">Quotation เปิดอยู่ {Number(c.open_pos)} ใบ</div>
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
              {customers.map((c) => {
                const usedPct = c.effective_limit
                  ? (Number(c.outstanding) / Number(c.effective_limit)) * 100
                  : 0;
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-gray-50 transition-colors">
                    <td className="p-3.5">
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
