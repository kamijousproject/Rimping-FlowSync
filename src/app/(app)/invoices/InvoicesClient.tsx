"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  PlusCircle,
  Download,
  Filter,
  Search,
  Trash2,
  FilePlus,
  AlertCircle,
  CheckSquare,
  Square,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { InvoiceWithDetails } from "../api/invoices/route";

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

export default function InvoicesClient() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  
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

  const fetchInvoices = useCallback(async () => {
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
        throw new Error(data.error || "Failed to fetch invoices");
      }
      
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Get unique customers from selected invoices
  const getSelectedCustomers = () => {
    const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
    const customerIds = new Set(selectedInvoices.map((inv) => inv.customer_id));
    return customerIds;
  };

  // Validate same customer selection
  const validateSameCustomer = () => {
    const customerIds = getSelectedCustomers();
    if (customerIds.size > 1) {
      setCustomerError("กรุณาเลือก Invoice จากลูกค้าเดียวกันเท่านั้น");
      return false;
    }
    setCustomerError(null);
    return true;
  };

  // Handle checkbox toggle
  const handleToggleSelect = (invoice: InvoiceWithDetails) => {
    const newSelected = new Set(selectedIds);
    
    if (newSelected.has(invoice.id)) {
      newSelected.delete(invoice.id);
      setCustomerError(null);
    } else {
      // Check if adding this would violate same-customer rule
      const currentSelected = invoices.filter((inv) => newSelected.has(inv.id));
      if (currentSelected.length > 0) {
        const firstCustomerId = currentSelected[0].customer_id;
        if (invoice.customer_id !== firstCustomerId) {
          setCustomerError(`ไม่สามารถเลือก Invoice จากลูกค้าคนละคนกัน (${invoice.customer_name} vs ${currentSelected[0].customer_name})`);
          return;
        }
      }
      newSelected.add(invoice.id);
    }
    
    setSelectedIds(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedIds.size === invoices.length) {
      // Deselect all
      setSelectedIds(new Set());
      setCustomerError(null);
    } else {
      // Check if all invoices are from same customer
      const firstCustomerId = invoices[0]?.customer_id;
      const allSameCustomer = invoices.every((inv) => inv.customer_id === firstCustomerId);
      
      if (!allSameCustomer && invoices.length > 0) {
        setCustomerError("ไม่สามารถเลือกทั้งหมดได้ เนื่องจากมี Invoice จากลูกค้าหลายคน กรุณาเลือกทีละรายการ");
        return;
      }
      
      // Select all visible
      const newSelected = new Set(invoices.map((inv) => inv.id));
      setSelectedIds(newSelected);
      setCustomerError(null);
    }
  };

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

  // Download single invoice
  const handleDownload = (invoice: InvoiceWithDetails) => {
    // Navigate to PO page with download trigger
    router.push(`/po/${invoice.po_id}?download=invoice`);
  };

  // Create billing note from selected
  const handleCreateBillingNote = () => {
    if (selectedIds.size === 0) {
      alert("กรุณาเลือก Invoice อย่างน้อย 1 รายการ");
      return;
    }
    
    if (!validateSameCustomer()) {
      return;
    }
    
    const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
    const customerId = selectedInvoices[0].customer_id;
    
    // Navigate to billing note creation with selected POs
    const poIds = selectedInvoices.map((inv) => inv.po_id).join(",");
    router.push(`/customers/${customerId}/billing-notes/new?po_ids=${poIds}`);
  };

  const selectedCount = selectedIds.size;
  const selectedAmount = invoices
    .filter((inv) => selectedIds.has(inv.id))
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Invoices
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 text-sm ${
              showFilters ? "bg-brand-100 text-brand-700" : ""
            }`}
          >
            <Filter className="w-4 h-4" />
            ตัวกรอง
          </button>
          <Link
            href="/po"
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            สร้าง Invoice ใหม่
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {customerError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">{customerError}</p>
            <p className="text-red-600 text-sm mt-1">
              กรุณาเลือก Invoice จากลูกค้าเดียวกันเท่านั้น
            </p>
          </div>
          <button
            onClick={() => setCustomerError(null)}
            className="ml-auto p-1 hover:bg-red-100 rounded"
          >
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-white border border-border rounded-lg">
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
              <label className="label text-xs">วันที่ออก Invoice</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                  className="input text-sm flex-1"
                />
                <span className="text-muted">-</span>
                <input
                  type="date"
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
                fetchInvoices();
              }}
              className="btn-primary text-sm"
            >
              ค้นหา
            </button>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {selectedCount > 0 && (
        <div className="mb-4 p-4 bg-brand-50 border border-brand-200 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-brand-800 font-medium">
                เลือก {selectedCount} รายการ
              </p>
              <p className="text-brand-600 text-sm">
                ยอดรวม: {selectedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
              </p>
              {selectedCount > 0 && (
                <p className="text-brand-600 text-xs mt-1">
                  ลูกค้า: {invoices.find((inv) => selectedIds.has(inv.id))?.customer_name}
                </p>
              )}
            </div>
            <button
              onClick={handleCreateBillingNote}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <FilePlus className="w-4 h-4" />
              สร้างใบวางบิล
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted">กำลังโหลด...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted" />
            <p>ไม่พบ Invoice</p>
            <p className="text-sm mt-1">
              สร้าง Invoice ได้จากหน้า PO
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center gap-2"
                      >
                        {selectedIds.size === invoices.length && invoices.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-brand-600" />
                        ) : (
                          <Square className="w-4 h-4 text-muted" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      เลขใบกำกับภาษี
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      PO
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
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className={`hover:bg-gray-50 transition ${
                        selectedIds.has(invoice.id) ? "bg-brand-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleSelect(invoice)}
                          className="flex items-center"
                        >
                          {selectedIds.has(invoice.id) ? (
                            <CheckSquare className="w-4 h-4 text-brand-600" />
                          ) : (
                            <Square className="w-4 h-4 text-muted" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {invoice.tax_invoice_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/po/${invoice.po_id}`}
                          className="text-brand-600 hover:text-brand-700 font-medium"
                        >
                          {invoice.po_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{invoice.customer_name}</p>
                          <p className="text-xs text-muted">{invoice.customer_code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">
                          {invoice.amount.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {new Date(invoice.po_date).toLocaleDateString("th-TH")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDownload(invoice)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                          title="ดาวน์โหลด Invoice"
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
                แสดง {invoices.length} จาก {pagination.total} รายการ
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
