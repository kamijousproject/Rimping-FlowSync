"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  PlusCircle,
  Download,
  Filter,
  Search,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import type { InvoiceWithDetails } from "@/app/api/invoices/route";
import { ThaiDateInput } from "@/components/ThaiDateInput";

interface FilterState {
  customerName: string;
  taxInvoiceNumber: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ReceiptsClient() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<FilterState>({
    customerName: "",
    taxInvoiceNumber: "",
    minAmount: "",
    maxAmount: "",
    dateFrom: "",
    dateTo: "",
  });
  
  // Pagination
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());
      
      if (filters.customerName) params.set("customer_name", filters.customerName);
      if (filters.taxInvoiceNumber) params.set("tax_invoice_number", filters.taxInvoiceNumber);
      if (filters.minAmount) params.set("min_amount", filters.minAmount);
      if (filters.maxAmount) params.set("max_amount", filters.maxAmount);
      if (filters.dateFrom) params.set("date_from", filters.dateFrom);
      if (filters.dateTo) params.set("date_to", filters.dateTo);
      
      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch receipts");
      }
      
      setReceipts(data.invoices);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Clear filters
  const clearFilters = () => {
    setFilters({
      customerName: "",
      taxInvoiceNumber: "",
      minAmount: "",
      maxAmount: "",
      dateFrom: "",
      dateTo: "",
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Download receipt
  const handleDownload = (receipt: InvoiceWithDetails) => {
    router.push(`/po/${receipt.po_id}?download=invoice`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          ใบเสร็จ (Receipts)
        </h1>
        <p className="text-sm text-muted">
          เอกสารกำกับการขายที่ออกแล้ว
        </p>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-4 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <Search className="w-4 h-4" />
              ค้นหาและกรอง
            </h3>
            <button
              onClick={clearFilters}
              className="text-sm text-muted hover:text-foreground flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              ล้างตัวกรอง
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Customer Name */}
            <div>
              <label className="label text-xs">ชื่อลูกค้า</label>
              <input
                type="text"
                value={filters.customerName}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, customerName: e.target.value }))
                }
                placeholder="ค้นหาชื่อลูกค้า..."
                className="input text-sm"
              />
            </div>

            {/* Tax Invoice Number */}
            <div>
              <label className="label text-xs">เลขใบกำกับภาษี</label>
              <input
                type="text"
                value={filters.taxInvoiceNumber}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, taxInvoiceNumber: e.target.value }))
                }
                placeholder="INV-XXXX..."
                className="input text-sm"
              />
            </div>

            {/* Amount Range */}
            <div>
              <label className="label text-xs">ช่วงจำนวนเงิน</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.minAmount}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, minAmount: e.target.value }))
                  }
                  placeholder="ขั้นต่ำ"
                  className="input text-sm flex-1"
                />
                <span className="text-muted">-</span>
                <input
                  type="number"
                  value={filters.maxAmount}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))
                  }
                  placeholder="สูงสุด"
                  className="input text-sm flex-1"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="label text-xs">วันที่ออก</label>
              <div className="flex items-center gap-2">
                <ThaiDateInput
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                  className="input text-sm flex-1"
                />
                <span className="text-muted">-</span>
                <ThaiDateInput
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                  }
                  className="input text-sm flex-1"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                fetchReceipts();
              }}
              className="btn-primary text-sm"
            >
              ค้นหา
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary text-sm flex items-center gap-2 ${
              showFilters ? "bg-brand-100 text-brand-700" : ""
            }`}
          >
            <Filter className="w-4 h-4" />
            ตัวกรอง
          </button>
          <p className="text-sm text-muted">
            {pagination.total} รายการ
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted">กำลังโหลด...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : receipts.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-muted" />
            <p>ไม่พบใบเสร็จ</p>
            <p className="text-sm mt-1">
              สร้างใบเสร็จได้จากหน้า Quotation โดยคลิก &quot;ออกใบแจ้งหนี้&quot;
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      เลขใบกำกับภาษี
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      Quotation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      ลูกค้า
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                      จำนวนเงิน
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      วันที่
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">
                      ดาวน์โหลด
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receipts.map((receipt) => (
                    <tr
                      key={receipt.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {receipt.tax_invoice_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/po/${receipt.po_id}`}
                          className="text-brand-600 hover:text-brand-700 font-medium"
                        >
                          {receipt.po_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{receipt.customer_name}</p>
                          <p className="text-xs text-muted">{receipt.customer_code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">
                          {receipt.amount.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {new Date(receipt.po_date).toLocaleDateString("th-TH")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDownload(receipt)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                          title="ดาวน์โหลดใบเสร็จ"
                        >
                          <Download className="w-4 h-4 text-muted hover:text-brand-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-border bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-muted">
                แสดง {receipts.length} จาก {pagination.total} รายการ
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.max(1, prev.page - 1),
                    }))
                  }
                  disabled={pagination.page === 1}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  ก่อนหน้า
                </button>
                <span className="text-sm text-muted px-2">
                  หน้า {pagination.page} จาก {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.min(prev.totalPages, prev.page + 1),
                    }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  ถัดไป
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
