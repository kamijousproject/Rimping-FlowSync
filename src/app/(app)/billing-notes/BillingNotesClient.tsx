"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Users,
  Package,
  CheckSquare,
  Square,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  PlusCircle,
  AlertCircle,
  FilePlus,
} from "lucide-react";

interface Customer {
  id: number;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  tax_invoice_number: string | null;
  total: number;
  payment_status: string;
  created_at: string;
}

interface FilterState {
  poNumber: string;
  taxInvoiceNumber: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
  status: string;
}

export default function BillingNotesClient() {
  const router = useRouter();
  const [step, setStep] = useState<"select-customer" | "select-pos">("select-customer");
  
  // Step 1: Select Customer
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // Step 2: Select POs
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const [selectedPoIds, setSelectedPoIds] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<FilterState>({
    poNumber: "",
    taxInvoiceNumber: "",
    minAmount: "",
    maxAmount: "",
    dateFrom: "",
    dateTo: "",
    status: "",
  });
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const params = new URLSearchParams();
      if (customerSearch) params.set("search", customerSearch);
      
      const res = await fetch(`/api/customers?${params.toString()}`);
      const data = await res.json();
      
      if (res.ok) {
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoadingCustomers(false);
    }
  }, [customerSearch]);

  useEffect(() => {
    if (step === "select-customer") {
      fetchCustomers();
    }
  }, [fetchCustomers, step]);

  // Fetch POs for selected customer
  const fetchPos = useCallback(async () => {
    if (!selectedCustomer) return;
    
    setLoadingPos(true);
    try {
      const params = new URLSearchParams();
      params.set("customer_id", selectedCustomer.id.toString());
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      
      if (filters.poNumber) params.set("po_number", filters.poNumber);
      if (filters.taxInvoiceNumber) params.set("tax_invoice_number", filters.taxInvoiceNumber);
      if (filters.minAmount) params.set("min_amount", filters.minAmount);
      if (filters.maxAmount) params.set("max_amount", filters.maxAmount);
      if (filters.dateFrom) params.set("date_from", filters.dateFrom);
      if (filters.dateTo) params.set("date_to", filters.dateTo);
      if (filters.status) params.set("status", filters.status);
      
      const res = await fetch(`/api/customers/${selectedCustomer.id}/pos?${params.toString()}`);
      const data = await res.json();
      
      if (res.ok) {
        setPos(data.pos || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching POs:", error);
    } finally {
      setLoadingPos(false);
    }
  }, [selectedCustomer, page, limit, filters]);

  useEffect(() => {
    if (step === "select-pos" && selectedCustomer) {
      fetchPos();
    }
  }, [fetchPos, step, selectedCustomer]);

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setStep("select-pos");
    setPage(1);
    setSelectedPoIds(new Set());
  };

  // Handle PO toggle
  const handleTogglePo = (poId: number) => {
    const newSelected = new Set(selectedPoIds);
    if (newSelected.has(poId)) {
      newSelected.delete(poId);
    } else {
      newSelected.add(poId);
    }
    setSelectedPoIds(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedPoIds.size === pos.length) {
      setSelectedPoIds(new Set());
    } else {
      setSelectedPoIds(new Set(pos.map((p) => p.id)));
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      poNumber: "",
      taxInvoiceNumber: "",
      minAmount: "",
      maxAmount: "",
      dateFrom: "",
      dateTo: "",
      status: "",
    });
    setPage(1);
  };

  // Create billing note
  const handleCreateBillingNote = () => {
    if (selectedPoIds.size === 0) {
      alert("กรุณาเลือก PO อย่างน้อย 1 รายการ");
      return;
    }
    
    const poIds = Array.from(selectedPoIds).join(",");
    router.push(`/customers/${selectedCustomer?.id}/billing-notes/new?po_ids=${poIds}`);
  };

  // Calculate totals
  const selectedPos = pos.filter((p) => selectedPoIds.has(p.id));
  const totalAmount = selectedPos.reduce((sum, p) => sum + p.total, 0);

  // STEP 1: Select Customer
  if (step === "select-customer") {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            สร้างใบวางบิล (Billing Note)
          </h1>
          <p className="text-sm text-muted mt-1">
            ขั้นตอนที่ 1: เลือกลูกค้า
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="ค้นหาลูกค้า..."
              className="input pl-10 w-full max-w-md"
            />
          </div>
        </div>

        {/* Customer Grid */}
        {loadingCustomers ? (
          <div className="text-center py-8 text-muted">กำลังโหลด...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <Users className="w-12 h-12 mx-auto mb-4" />
            <p>ไม่พบลูกค้า</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => handleSelectCustomer(customer)}
                className="p-4 bg-white border border-border rounded-lg hover:border-brand-300 hover:shadow-md transition text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-700 font-medium">
                      {customer.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{customer.name}</p>
                    <p className="text-sm text-muted">{customer.code}</p>
                    {customer.contact_person && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {customer.contact_person}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // STEP 2: Select POs
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <button
          onClick={() => setStep("select-customer")}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            สร้างใบวางบิล
          </h1>
          <p className="text-sm text-muted">
            ขั้นตอนที่ 2: เลือก PO ของ {selectedCustomer?.name} ({selectedCustomer?.code})
          </p>
        </div>
      </div>

      {/* Selection Summary */}
      {selectedPoIds.size > 0 && (
        <div className="mb-6 p-4 bg-brand-50 border border-brand-200 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-brand-800 font-medium">
                เลือก {selectedPoIds.size} รายการ
              </p>
              <p className="text-brand-600 text-sm">
                ยอดรวม: {totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
              </p>
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

      {/* Filters */}
      {showFilters && (
        <div className="mb-6 p-4 bg-white border border-border rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              ตัวกรอง PO
            </h3>
            <button
              onClick={clearFilters}
              className="text-sm text-muted hover:text-foreground"
            >
              ล้างตัวกรอง
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label text-xs">เลข PO</label>
              <input
                type="text"
                value={filters.poNumber}
                onChange={(e) => setFilters((prev) => ({ ...prev, poNumber: e.target.value }))}
                placeholder="PO-XXXX..."
                className="input text-sm"
              />
            </div>
            
            <div>
              <label className="label text-xs">เลขใบกำกับภาษี</label>
              <input
                type="text"
                value={filters.taxInvoiceNumber}
                onChange={(e) => setFilters((prev) => ({ ...prev, taxInvoiceNumber: e.target.value }))}
                placeholder="INV-XXXX..."
                className="input text-sm"
              />
            </div>
            
            <div>
              <label className="label text-xs">สถานะ</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="input text-sm"
              >
                <option value="">ทั้งหมด</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="packed">Packed</option>
                <option value="checked">Checked</option>
                <option value="delivered">Delivered</option>
                <option value="received">Received</option>
              </select>
            </div>
            
            <div>
              <label className="label text-xs">ช่วงจำนวนเงิน</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.minAmount}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
                  placeholder="ขั้นต่ำ"
                  className="input text-sm flex-1"
                />
                <span className="text-muted">-</span>
                <input
                  type="number"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))}
                  placeholder="สูงสุด"
                  className="input text-sm flex-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary text-sm flex items-center gap-2 ${
                showFilters ? "bg-brand-100 text-brand-700" : ""
              }`}
            >
              <Filter className="w-4 h-4" />
              ตัวกรอง
            </button>
            <button
              onClick={handleSelectAll}
              className="btn-secondary text-sm"
            >
              {selectedPoIds.size === pos.length && pos.length > 0 ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
            </button>
          </div>
          <p className="text-sm text-muted">{total} รายการ</p>
        </div>

        {loadingPos ? (
          <div className="p-8 text-center text-muted">กำลังโหลด...</div>
        ) : pos.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <Package className="w-12 h-12 mx-auto mb-4" />
            <p>ไม่พบ PO</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <button onClick={handleSelectAll}>
                        {selectedPoIds.size === pos.length && pos.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-brand-600" />
                        ) : (
                          <Square className="w-4 h-4 text-muted" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      เลข PO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      เลขใบกำกับภาษี
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      สถานะ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                      จำนวนเงิน
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      วันที่
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pos.map((po) => (
                    <tr
                      key={po.id}
                      className={`hover:bg-gray-50 transition ${
                        selectedPoIds.has(po.id) ? "bg-brand-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button onClick={() => handleTogglePo(po.id)}>
                          {selectedPoIds.has(po.id) ? (
                            <CheckSquare className="w-4 h-4 text-brand-600" />
                          ) : (
                            <Square className="w-4 h-4 text-muted" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/po/${po.id}`}
                          className="text-brand-600 hover:text-brand-700 font-medium"
                          target="_blank"
                        >
                          {po.po_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {po.tax_invoice_number || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          po.payment_status === "paid" 
                            ? "bg-green-100 text-green-700"
                            : po.payment_status === "partial"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {po.payment_status === "paid" ? "ชำระครบ" 
                            : po.payment_status === "partial" ? "ชำระบางส่วน" 
                            : "ยังไม่ชำระ"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {po.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {new Date(po.created_at).toLocaleDateString("th-TH")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-border bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-muted">
                แสดง {pos.length} จาก {total} รายการ
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  ก่อนหน้า
                </button>
                <span className="text-sm text-muted px-2">
                  หน้า {page} จาก {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={pos.length < limit}
                  className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1"
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
