import Link from "next/link";
import { getDashboardStats, getRecentPos } from "@/backend/services/dashboard";
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
  const [stats, recent] = await Promise.all([
    getDashboardStats(),
    getRecentPos(10),
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

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">PO ล่าสุด</h3>
          <Link href="/po" className="text-sm text-brand-700 hover:underline">
            ดูทั้งหมด →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b">
              <tr>
                <th className="text-left py-2">PO No.</th>
                <th className="text-left">ลูกค้า</th>
                <th className="text-right">ยอดรวม</th>
                <th className="text-right">คงค้าง</th>
                <th>สถานะ</th>
                <th>การชำระ</th>
                <th>กำหนดชำระ</th>
              </tr>
            </thead>
            <tbody>
              {(recent as Array<Record<string, unknown>>).map((r) => (
                <tr key={r.id as number} className="border-b last:border-0">
                  <td className="py-2">
                    <Link
                      href={`/po/${r.id}`}
                      className="text-brand-700 hover:underline font-medium"
                    >
                      {r.po_number as string}
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={`/customers/${r.customer_id}`}
                      className="hover:underline"
                    >
                      {r.customer_name as string}
                    </Link>
                  </td>
                  <td className="text-right">{fmtMoney(r.total as number)}</td>
                  <td className="text-right text-red-600">
                    {fmtMoney(r.remaining_amount as number)}
                  </td>
                  <td className="text-center">
                    <StatusBadge status={r.status as string} />
                  </td>
                  <td className="text-center">
                    <PaymentBadge status={r.payment_status as string} />
                  </td>
                  <td className="text-center text-xs">
                    {r.due_date
                      ? new Date(r.due_date as string).toLocaleDateString(
                          "th-TH"
                        )
                      : "-"}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-muted">
                    ยังไม่มี PO
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {Object.values(STATUS_LABEL_TH).length === 0 && null}
    </div>
  );
}
