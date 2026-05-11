"use client";

import Link from "next/link";
import { Suspense, useState, useCallback, useEffect } from "react";
import {
  PaymentBadge,
  StatusBadge,
  fmtMoney,
} from "@/components/StatusBadge";
import DateRangeFilter from "@/components/DateRangeFilter";
import { ChevronLeft, ChevronRight, Search, X, Filter } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

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

type PurchaseOrder = {
  id: number;
  po_number: string;
  customer_id: number;
  customer_name: string;
  status: string;
  payment_status: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  credit_term_days: number;
  due_date: string | null;
};

export default function PoListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL params
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const status = searchParams.get("status") || "";
  const paymentStatus = searchParams.get("payment_status") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";

  // Advanced filter states
  const [customerName, setCustomerName] = useState(searchParams.get("customer_name") || "");
  const [poNumber, setPoNumber] = useState(searchParams.get("po_number") || "");
  const [minAmount, setMinAmount] = useState(searchParams.get("min_amount") || "");
  const [maxAmount, setMaxAmount] = useState(searchParams.get("max_amount") || "");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Data state
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const limit = 10;
  const totalPages = Math.ceil(total / limit);
  const startItem = total > 0 ? (page - 1) * limit + 1 : 0;
  const endItem = Math.min(page * limit, total);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (status) params.set("status", status);
      if (paymentStatus) params.set("payment_status", paymentStatus);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (customerName) params.set("customer_name", customerName);
      if (poNumber) params.set("po_number", poNumber);
      if (minAmount) params.set("min_amount", minAmount);
      if (maxAmount) params.set("max_amount", maxAmount);

      const res = await fetch(`/api/po?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setPos(data.pos || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Error fetching POs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, status, paymentStatus, startDate, endDate, customerName, poNumber, minAmount, maxAmount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply advanced filters
  const applyAdvancedFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (customerName) params.set("customer_name", customerName);
    else params.delete("customer_name");
    if (poNumber) params.set("po_number", poNumber);
    else params.delete("po_number");
    if (minAmount) params.set("min_amount", minAmount);
    else params.delete("min_amount");
    if (maxAmount) params.set("max_amount", maxAmount);
    else params.delete("max_amount");
    router.push(`/po?${params.toString()}`);
  };

  // Clear advanced filters
  const clearAdvancedFilters = () => {
    setCustomerName("");
    setPoNumber("");
    setMinAmount("");
    setMaxAmount("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("customer_name");
    params.delete("po_number");
    params.delete("min_amount");
    params.delete("max_amount");
    params.set("page", "1");
    router.push(`/po?${params.toString()}`);
  };

  // Build link for basic filters (status, payment_status)
  const buildFilterLink = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    return `/po?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-800">
            Purchase Orders
          </h1>
          <p className="text-xs md:text-sm text-muted">
            {total} รายการ ทั้งหมด (แสดง {startItem}-{endItem})
          </p>
        </div>
        <Link href="/po/new" className="btn-primary hidden md:inline-flex">
          + สร้าง PO ใหม่
        </Link>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              ตัวกรองขั้นสูง
            </h3>
            <button
              onClick={clearAdvancedFilters}
              className="text-sm text-muted hover:text-foreground flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              ล้างตัวกรอง
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Customer Name */}
            <div>
              <label className="label text-xs">ชื่อลูกค้า</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ค้นหาชื่อลูกค้า..."
                  className="input pl-9 text-sm"
                />
              </div>
            </div>

            {/* PO Number */}
            <div>
              <label className="label text-xs">เลข PO</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO2026XXXX..."
                className="input text-sm"
              />
            </div>

            {/* Amount Range */}
            <div>
              <label className="label text-xs">ช่วงจำนวนเงิน</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="ขั้นต่ำ"
                  className="input text-sm flex-1"
                />
                <span className="text-muted">-</span>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="สูงสุด"
                  className="input text-sm flex-1"
                />
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex items-end">
              <button
                onClick={applyAdvancedFilters}
                className="btn-primary text-sm w-full"
              >
                ค้นหา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter — scrollable row on mobile */}
      <div className="card p-3 space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 scrollbar-thin">
          <span className="text-xs text-muted shrink-0">สถานะ:</span>
          <FilterPill
            href={buildFilterLink("status", null)}
            active={!status && !paymentStatus}
          >
            ทั้งหมด
          </FilterPill>
          {STATUS_FILTERS.map((f) => (
            <FilterPill
              key={f.v}
              href={buildFilterLink("status", f.v)}
              active={status === f.v}
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
              href={buildFilterLink("payment_status", f.v)}
              active={paymentStatus === f.v}
            >
              {f.label}
            </FilterPill>
          ))}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${
              showAdvancedFilters || customerName || poNumber || minAmount || maxAmount
                ? "bg-brand-600 text-white"
                : "bg-brand-50 text-brand-700 hover:bg-brand-100"
            }`}
          >
            <Filter className="w-3 h-3" />
            ตัวกรองเพิ่มเติม
          </button>
        </div>
        <Suspense>
          <DateRangeFilter />
        </Suspense>
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

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 py-2">
            <button
              onClick={() => router.push(buildFilterLink("page", page <= 2 ? null : (page - 1).toString()))}
              disabled={page <= 1}
              className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              ก่อนหน้า
            </button>
            <span className="text-sm text-muted">
              หน้า {page} / {totalPages}
            </span>
            <button
              onClick={() => router.push(buildFilterLink("page", (page + 1).toString()))}
              disabled={page >= totalPages}
              className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              ถัดไป
              <ChevronRight className="w-4 h-4" />
            </button>
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

        {/* Desktop Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-gray-50">
            <p className="text-sm text-muted">
              แสดง {startItem}-{endItem} จาก {total} รายการ
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(buildFilterLink("page", page <= 2 ? null : (page - 1).toString()))}
                disabled={page <= 1}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                ก่อนหน้า
              </button>
              <span className="text-sm text-muted px-2">
                หน้า {page} / {totalPages}
              </span>
              <button
                onClick={() => router.push(buildFilterLink("page", (page + 1).toString()))}
                disabled={page >= totalPages}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                ถัดไป
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
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

