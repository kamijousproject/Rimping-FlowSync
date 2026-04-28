import Link from "next/link";
import { listPos } from "@/backend/services/po";
import {
  PaymentBadge,
  StatusBadge,
  fmtMoney,
} from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { v: "draft", label: "ร่าง" },
  { v: "confirmed", label: "ยืนยัน" },
  { v: "packed", label: "แพ็ค" },
  { v: "checked", label: "ตรวจ" },
  { v: "delivered", label: "ส่ง" },
  { v: "received", label: "รับของ" },
];

const PAY_FILTERS = [
  { v: "unpaid", label: "ยังไม่ชำระ" },
  { v: "partial", label: "ชำระบางส่วน" },
  { v: "paid", label: "ชำระครบ" },
];

export default async function PoListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    payment_status?: string;
  }>;
}) {
  const sp = await searchParams;
  const pos = await listPos({
    status: sp.status,
    payment_status: sp.payment_status,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-800">
            Purchase Orders
          </h1>
          <p className="text-xs md:text-sm text-muted">
            {pos.length} รายการ
          </p>
        </div>
        <Link href="/po/new" className="btn-primary hidden md:inline-flex">
          + สร้าง PO ใหม่
        </Link>
      </div>

      {/* Filter — scrollable row on mobile */}
      <div className="card p-3 space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 scrollbar-thin">
          <span className="text-xs text-muted shrink-0">สถานะ:</span>
          <FilterPill href="/po" active={!sp.status && !sp.payment_status}>
            ทั้งหมด
          </FilterPill>
          {STATUS_FILTERS.map((f) => (
            <FilterPill
              key={f.v}
              href={`/po?status=${f.v}`}
              active={sp.status === f.v}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
          <span className="text-xs text-muted shrink-0">ชำระ:</span>
          {PAY_FILTERS.map((f) => (
            <FilterPill
              key={f.v}
              href={`/po?payment_status=${f.v}`}
              active={sp.payment_status === f.v}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {pos.map((p) => (
          <Link
            key={p.id}
            href={`/po/${p.id}`}
            className="block card p-4 active:scale-[0.99] transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-brand-700">
                  {p.po_number}
                </div>
                <div className="text-sm text-foreground truncate">
                  {p.customer_name}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-bold">
                  {fmtMoney(p.total)} ฿
                </div>
                {Number(p.remaining_amount) > 0 ? (
                  <div className="text-xs text-red-600">
                    คงค้าง {fmtMoney(p.remaining_amount)}
                  </div>
                ) : (
                  <div className="text-xs text-brand-700">ชำระครบ</div>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between flex-wrap gap-1">
              <div className="flex gap-1.5">
                <StatusBadge status={p.status} />
                <PaymentBadge status={p.payment_status} />
              </div>
              <div className="text-[11px] text-muted">
                {p.due_date
                  ? `กำหนด ${new Date(p.due_date).toLocaleDateString(
                      "th-TH"
                    )}`
                  : `เครดิต ${p.credit_term_days} วัน`}
              </div>
            </div>
          </Link>
        ))}
        {pos.length === 0 && (
          <div className="card p-8 text-center text-muted text-sm">
            ไม่มี PO ที่ตรงเงื่อนไข
          </div>
        )}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted bg-brand-50">
            <tr>
              <th className="text-left p-3">PO No.</th>
              <th className="text-left">ลูกค้า</th>
              <th className="text-right">ยอดรวม</th>
              <th className="text-right">ชำระแล้ว</th>
              <th className="text-right">คงค้าง</th>
              <th>สถานะ</th>
              <th>การชำระ</th>
              <th>เครดิต</th>
              <th>กำหนดชำระ</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((p) => (
              <tr key={p.id} className="border-t hover:bg-brand-50/40">
                <td className="p-3">
                  <Link
                    href={`/po/${p.id}`}
                    className="text-brand-700 hover:underline font-medium"
                  >
                    {p.po_number}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/customers/${p.customer_id}`}
                    className="hover:underline"
                  >
                    {p.customer_name}
                  </Link>
                </td>
                <td className="text-right">{fmtMoney(p.total)}</td>
                <td className="text-right text-brand-700">
                  {fmtMoney(p.paid_amount)}
                </td>
                <td className="text-right text-red-600">
                  {fmtMoney(p.remaining_amount)}
                </td>
                <td className="text-center">
                  <StatusBadge status={p.status} />
                </td>
                <td className="text-center">
                  <PaymentBadge status={p.payment_status} />
                </td>
                <td className="text-center text-xs">{p.credit_term_days}d</td>
                <td className="text-center text-xs">
                  {p.due_date
                    ? new Date(p.due_date).toLocaleDateString("th-TH")
                    : "-"}
                </td>
              </tr>
            ))}
            {pos.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-muted">
                  ยังไม่มี PO
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-brand-50 text-brand-700 hover:bg-brand-100"
      }`}
    >
      {children}
    </Link>
  );
}
