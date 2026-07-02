"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Info,
  Search,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";

const GRID_COLS =
  "grid-cols-[28px_minmax(160px,1.6fr)_minmax(140px,1.4fr)_76px_72px_76px_104px_112px_36px]";

export default function NewPoPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading...</div>}>
      <NewPoInner />
    </Suspense>
  );
}

type Customer = {
  id: number;
  name: string;
  code: string | null;
  credit_limit: number;
  outstanding: number;
  credit_available: number;
  effective_limit: number;
  temp_extra: number;
  credit_notes_balance: number;
  default_credit_term_days: number;
};

type ProductHit = {
  id: number;
  sku: string;
  upc: string | null;
  description: string;
  current_price: number;
  dept: string | null;
  vendor_name: string | null;
};

type Item = {
  product_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  _prodQuery?: string;
  _prodOpen?: boolean;
  _prodHits?: ProductHit[];
};

type DropdownPos = { top: number; left: number; width: number };

const newItem = (): Item => ({
  product_name: "",
  description: "",
  quantity: 1,
  unit: "ชิ้น",
  unit_price: 0,
  _prodQuery: "",
  _prodOpen: false,
  _prodHits: [],
});

function NewPoInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const presetCust = sp.get("customer_id");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [custQuery, setCustQuery] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [creditTerm, setCreditTerm] = useState(30);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [stockInfo, setStockInfo] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        const list: Customer[] = d.customers || [];
        setCustomers(list);
        if (presetCust) {
          const id = Number(presetCust);
          setCustomerId(id);
          const c = list.find((x) => x.id === id);
          if (c) { setCreditTerm(c.default_credit_term_days); setCustQuery(c.name); }
        }
      })
      .catch(console.error);
  }, [presetCust]);

  useEffect(() => {
    const skus = items
      .filter(it => it.product_name)
      .map(it => it.product_name!);
    fetchStockInfo(skus);
  }, [items.map(it => it.product_name).join(",")]);

  const custMatches = custQuery.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(custQuery.toLowerCase()) ||
          (c.code ?? "").toLowerCase().includes(custQuery.toLowerCase())
      )
    : customers;

  function selectCustomer(c: Customer) {
    setCustomerId(c.id);
    setCustQuery(c.name);
    setCreditTerm(c.default_credit_term_days);
    setCustOpen(false);
  }

  const selected = customers.find((c) => c.id === customerId);
  const total = items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
    0
  );
  const overLimit =
    selected && total > Number(selected.credit_available || 0);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const recalcPos = useCallback((idx: number, el?: HTMLInputElement | null) => {
    const node = el ?? inputRefs.current[idx];
    if (!node) return;
    const r = node.getBoundingClientRect();
    setDropdownPos({ top: r.bottom + 2, left: r.left, width: r.width });
  }, []);

  function onProdQueryChange(idx: number, val: string, el?: HTMLInputElement | null) {
    const cleared = !val.trim();
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, _prodQuery: val, _prodOpen: true, product_name: val, _prodHits: cleared ? [] : it._prodHits }
          : it
      )
    );
    setOpenIdx(idx);
    recalcPos(idx, el);
    clearTimeout(searchTimers.current[idx]);
    if (cleared) { setItems((prev) => prev.map((it, i) => i === idx ? { ...it, _prodHits: [] } : it)); return; }
    searchTimers.current[idx] = setTimeout(async () => {
      const r = await fetch(`/api/products?q=${encodeURIComponent(val)}`);
      if (!r.ok) return;
      const d = await r.json();
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx ? { ...it, _prodHits: d.products ?? [] } : it
        )
      );
    }, 250);
  }

  function selectProduct(idx: number, p: ProductHit) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              product_name: p.sku,
              description: p.description,
              unit_price: Number(p.current_price),
              _prodQuery: p.sku,
              _prodOpen: false,
              _prodHits: [],
            }
          : it
      )
    );
    setOpenIdx(null);
    setDropdownPos(null);
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  // Fetch stock info for display
  async function fetchStockInfo(skus: string[]) {
    if (skus.length === 0) {
      setStockInfo({});
      return;
    }
    
    try {
      const response = await fetch("/api/inventory/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          items: skus.map(sku => ({ sku, quantity: 1 }))
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const stockMap: Record<string, number> = {};
        data.items?.forEach((item: any) => {
          stockMap[item.sku] = item.stock;
        });
        setStockInfo(stockMap);
      }
    } catch (error) {
      console.error("Failed to fetch stock info:", error);
    }
  }

  // Validation function
  function validateForm(): boolean {
    if (!customerId) {
      setErr("กรุณาเลือกลูกค้า");
      return false;
    }
    if (items.length === 0 || items.some((it) => !it.product_name)) {
      setErr("กรุณากรอกรายการสินค้าให้ครบ");
      return false;
    }
    if (items.some((it) => !it.quantity || it.quantity <= 0)) {
      setErr("กรุณาระบุจำนวนที่ถูกต้อง");
      return false;
    }
    return true;
  }

  // Show confirmation modal
  function handleSubmitClick(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!validateForm()) return;
    setShowConfirm(true);
  }

  // Actual submit after confirmation
  async function confirmSubmit() {
    setShowConfirm(false);
    setLoading(true);
    setErr(null);
    
    const cleanItems = items.map(({ _prodQuery: _q, _prodOpen: _o, _prodHits: _h, ...rest }) => rest);
    const r = await fetch("/api/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        credit_term_days: creditTerm,
        notes,
        items: cleanItems,
      }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "บันทึกไม่สำเร็จ");
      return;
    }
    const data = await r.json();
    router.push(`/po/${data.po?.id ?? data.id}`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Legacy - redirect to handleSubmitClick
    handleSubmitClick(e);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/po"
          className="text-sm text-muted hover:text-foreground transition inline-flex items-center gap-1"
        >
          ← กลับ
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-brand-800 mt-1 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-600" />
          สร้าง Quotation ใหม่
        </h1>
      </div>

      <form onSubmit={handleSubmitClick} className="space-y-6">
        {/* Section: ข้อมูลพื้นฐาน */}
        <section className="bg-white border border-border rounded-[20px] p-7 md:p-8 space-y-5">
          <h2 className="font-semibold text-[15px] text-foreground">ข้อมูลพื้นฐาน</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 relative">
              <label className="label">ลูกค้า *</label>
              <div className="relative">
                <input
                  className="input h-12 rounded-xl pr-10"
                  placeholder="พิมพ์ชื่อหรือรหัสลูกค้า..."
                  value={custQuery}
                  autoComplete="off"
                  onFocus={() => setCustOpen(true)}
                  onBlur={() => setTimeout(() => setCustOpen(false), 150)}
                  onChange={(e) => {
                    setCustQuery(e.target.value);
                    setCustOpen(true);
                    if (!e.target.value) setCustomerId("");
                  }}
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              </div>
              {custOpen && custMatches.length > 0 && (
                <ul className="absolute z-30 mt-1.5 w-full bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto text-sm">
                  {custMatches.map((c) => (
                    <li
                      key={c.id}
                      onMouseDown={() => selectCustomer(c)}
                      className={`px-3.5 py-2.5 cursor-pointer hover:bg-brand-50 transition ${
                        c.id === customerId ? "bg-brand-50 font-medium" : ""
                      }`}
                    >
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                        <span className="font-medium">
                          {c.code ? <span className="text-muted mr-1">[{c.code}]</span> : null}
                          {c.name}
                        </span>
                        {c.temp_extra > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            +{fmtMoney(c.temp_extra)} วงเงินชั่วคราว
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        วงเงินเหลือ{" "}
                        <span className={c.credit_available <= 0 ? "text-red-600 font-semibold" : "font-semibold text-brand-700"}>
                          {fmtMoney(c.credit_available)} บ
                        </span>
                        {c.temp_extra > 0 && (
                          <span className="text-muted ml-1">(รวมวงเงินหลัก {fmtMoney(c.credit_limit)} + ชั่วคราว {fmtMoney(c.temp_extra)})</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {custOpen && custQuery.trim() && custMatches.length === 0 && (
                <div className="absolute z-30 mt-1.5 w-full bg-white border border-border rounded-xl shadow-lg px-3.5 py-2.5 text-sm text-muted">
                  ไม่พบลูกค้าที่ตรงกัน
                </div>
              )}
            </div>

            <div>
              <label className="label">เครดิต (วัน) *</label>
              <div className="h-12 rounded-xl border border-border bg-gray-50 px-3.5 flex items-center justify-between text-muted cursor-not-allowed select-none">
                <span>{creditTerm ? `${creditTerm} วัน` : "—"}</span>
                <ChevronDown className="w-4 h-4 shrink-0" />
              </div>
              <p className="text-xs text-muted mt-1">ตามเครดิตเริ่มต้นของร้าน</p>
            </div>

            {selected && (
              <div className="md:col-span-3 space-y-2.5">
                {selected.temp_extra > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span><strong>วงเงินชั่วคราวใช้งานอยู่:</strong> +{fmtMoney(selected.temp_extra)} (วงเงินรวม {fmtMoney(selected.effective_limit)})</span>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-gray-50 rounded-xl p-4">
                  <div>
                    <div className="text-xs text-muted">วงเงิน (effective)</div>
                    <div className="font-semibold mt-0.5">
                      {fmtMoney(selected.effective_limit)} บ
                    </div>
                    {selected.temp_extra > 0 && (
                      <div className="text-xs text-muted">หลัก {fmtMoney(selected.credit_limit)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted">ลูกหนี้คงค้าง</div>
                    <div className="font-semibold text-danger mt-0.5">
                      {fmtMoney(selected.outstanding)} บ
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">เครดิตโน๊ต</div>
                    <div className="font-semibold text-success mt-0.5">
                      {fmtMoney(selected.credit_notes_balance)} บ
                    </div>
                    <div className="text-[10px] text-muted">ใช้ก่อนเสมอ</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">วงเงินคงเหลือ</div>
                    <div className="font-semibold text-brand-700 mt-0.5">
                      {fmtMoney(selected.credit_available)} บ
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section: รายการสินค้า */}
        <section className="bg-white border border-border rounded-[20px] p-7 md:p-8">
          <h2 className="font-semibold text-[15px] text-foreground mb-4">รายการสินค้า</h2>

          {/* Desktop: grid table */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[820px]">
              {/* Grid header */}
              <div className={`grid ${GRID_COLS} gap-3 px-2 pb-2.5 border-b border-gray-100`}>
                <div />
                <div className="text-xs font-medium text-muted uppercase tracking-wide">สินค้า (SKU) *</div>
                <div className="text-xs font-medium text-muted uppercase tracking-wide">รายละเอียด</div>
                <div className="text-xs font-medium text-muted uppercase tracking-wide text-right">จำนวน *</div>
                <div className="text-xs font-medium text-muted uppercase tracking-wide">หน่วย</div>
                <div className="text-xs font-medium text-muted uppercase tracking-wide text-right">Stock</div>
                <div className="text-xs font-medium text-muted uppercase tracking-wide text-right">ราคา/หน่วย *</div>
                <div className="text-xs font-medium text-muted uppercase tracking-wide text-right">รวม</div>
                <div />
              </div>

              {/* Grid rows */}
              {items.map((it, idx) => {
                const line = Number(it.quantity || 0) * Number(it.unit_price || 0);
                return (
                  <div
                    key={idx}
                    className={`grid ${GRID_COLS} gap-3 px-2 items-center h-16 border-b border-gray-100 rounded-lg transition-colors duration-200 hover:bg-brand-50/40`}
                  >
                    <div className="text-xs text-muted">{idx + 1}</div>
                    <input
                      type="text"
                      className="h-10 rounded-[10px] border border-border bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                      required
                      placeholder="ค้น SKU / UPC / ชื่อสินค้า..."
                      autoComplete="off"
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      value={it._prodQuery ?? it.product_name}
                      onFocus={() => { setOpenIdx(idx); recalcPos(idx); updateItem(idx, { _prodOpen: true }); }}
                      onBlur={() => setTimeout(() => { updateItem(idx, { _prodOpen: false }); setOpenIdx(null); setDropdownPos(null); }, 150)}
                      onChange={(e) => onProdQueryChange(idx, e.target.value)}
                    />
                    <input
                      className="h-10 rounded-[10px] border border-border bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                      value={it.description}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="h-10 rounded-[10px] border border-border bg-white px-2.5 text-sm text-right outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                      required
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(idx, {
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                    <input
                      className="h-10 rounded-[10px] border border-border bg-white px-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                      value={it.unit}
                      onChange={(e) =>
                        updateItem(idx, { unit: e.target.value })
                      }
                    />
                    <div className="text-right text-sm">
                      {it.product_name && stockInfo[it.product_name] !== undefined ? (
                        <span className={
                          stockInfo[it.product_name] < 0 ? "text-red-600 font-semibold" :
                          stockInfo[it.product_name] < Number(it.quantity || 0) ? "text-orange-600 font-semibold" :
                          "text-success font-medium"
                        }>
                          {stockInfo[it.product_name] < 0 ? `${stockInfo[it.product_name]} (ติดลบ)` : stockInfo[it.product_name]}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-10 rounded-[10px] border border-border bg-white px-2.5 text-sm text-right outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                      required
                      value={it.unit_price}
                      onChange={(e) =>
                        updateItem(idx, {
                          unit_price: Number(e.target.value),
                        })
                      }
                    />
                    <div className="text-right text-sm font-medium text-foreground">
                      {fmtMoney(line)}
                    </div>
                    <div className="flex justify-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-muted hover:text-danger hover:bg-red-50 rounded-lg p-1.5 transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {items.map((it, idx) => {
              const line = Number(it.quantity || 0) * Number(it.unit_price || 0);
              const stock = it.product_name ? stockInfo[it.product_name] : undefined;
              return (
                <div key={idx} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">รายการที่ {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-muted hover:text-danger hover:bg-red-50 rounded-lg p-1.5 transition"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <label className="label">สินค้า (SKU) *</label>
                    <input
                      type="text"
                      className="input h-11 rounded-xl"
                      required
                      placeholder="ค้น SKU / UPC / ชื่อสินค้า..."
                      autoComplete="off"
                      value={it._prodQuery ?? it.product_name}
                      onFocus={(e) => { setOpenIdx(idx); recalcPos(idx, e.currentTarget); updateItem(idx, { _prodOpen: true }); }}
                      onBlur={() => setTimeout(() => { updateItem(idx, { _prodOpen: false }); setOpenIdx(null); setDropdownPos(null); }, 150)}
                      onChange={(e) => onProdQueryChange(idx, e.target.value, e.currentTarget)}
                    />
                  </div>

                  <div>
                    <label className="label">รายละเอียด</label>
                    <input
                      className="input h-11 rounded-xl"
                      value={it.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">จำนวน *</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        className="input h-11 rounded-xl text-right"
                        required
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="label">หน่วย</label>
                      <input
                        className="input h-11 rounded-xl"
                        value={it.unit}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">ราคา/หน่วย *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input h-11 rounded-xl text-right"
                        required
                        value={it.unit_price}
                        onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="label">Stock</label>
                      <div className="h-11 flex items-center text-sm">
                        {stock !== undefined ? (
                          <span className={
                            stock < 0 ? "text-red-600 font-semibold" :
                            stock < Number(it.quantity || 0) ? "text-orange-600 font-semibold" :
                            "text-success font-medium"
                          }>
                            {stock < 0 ? `${stock} (ติดลบ)` : stock}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm text-muted">รวม</span>
                    <span className="text-base font-semibold text-brand-700">{fmtMoney(line)} บาท</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setItems([...items, newItem()])}
            className="mt-4 w-full h-11 rounded-xl border border-dashed border-border text-sm text-muted hover:text-brand-700 hover:border-brand-300 hover:bg-brand-50/40 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            เพิ่มสินค้า
          </button>

          <div className="mt-6 flex justify-end">
            <div className="text-right">
              <div className="text-sm text-muted">รวมทั้งหมด</div>
              <div className="text-3xl font-bold text-brand-700 mt-0.5">{fmtMoney(total)} บาท</div>
            </div>
          </div>
        </section>

        {/* Section: หมายเหตุ */}
        <section className="bg-white border border-border rounded-[20px] p-7 md:p-8">
          <h2 className="font-semibold text-[15px] text-foreground mb-3">หมายเหตุ</h2>
          <div className="relative">
            <textarea
              className="w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition resize-none"
              style={{ height: 120 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <span className="absolute bottom-2.5 right-3.5 text-xs text-gray-400 pointer-events-none">
              {notes.length} ตัวอักษร
            </span>
          </div>
        </section>

        {overLimit && (
          <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              ยอด Quotation ({fmtMoney(total)}) เกินวงเงินคงเหลือของลูกค้า (
              {selected ? fmtMoney(selected.credit_available) : 0}) ไม่สามารถออก Quotation ได้
            </span>
          </div>
        )}
        {err && (
          <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {err}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmitClick}
            className="h-11 px-5 rounded-xl bg-brand-600 text-white text-sm font-medium inline-flex items-center gap-2 transition-all duration-200 hover:bg-brand-700 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            disabled={loading || overLimit || !customerId}
          >
            <Save className="w-4 h-4" />
            {loading ? "กำลังบันทึก..." : "บันทึก Quotation (สถานะ: ร่าง)"}
          </button>
          <Link
            href="/po"
            className="h-11 px-5 rounded-xl border border-border bg-white text-foreground text-sm font-medium inline-flex items-center gap-2 transition-all duration-200 hover:bg-gray-50 hover:-translate-y-px"
          >
            ยกเลิก
          </Link>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              ยืนยันการสร้าง Quotation
            </h2>

            <div className="space-y-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">ลูกค้า:</span>
                  <span className="font-medium">{custQuery}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">จำนวนรายการ:</span>
                  <span className="font-medium">{items.length} รายการ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">ยอดรวม:</span>
                  <span className="font-medium text-brand-700">
                    {fmtMoney(items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0))} บาท
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">เครดิต:</span>
                  <span className="font-medium">{creditTerm} วัน</span>
                </div>
              </div>

              <p className="text-muted text-center">
                ต้องการสร้าง Quotation นี้ใช่หรือไม่?
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="btn-secondary"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                className="btn-primary"
              >
                ยืนยัน สร้าง Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed-position product dropdown — renders outside overflow containers */}
      {openIdx !== null && dropdownPos && (() => {
        const it = items[openIdx];
        if (!it) return null;
        const hits = it._prodHits ?? [];
        const query = it._prodQuery ?? "";
        if (!query.trim()) return null;
        return (
          <ul
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: Math.max(dropdownPos.width, 380),
              zIndex: 9999,
            }}
            className="bg-white border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto text-xs"
          >
            {hits.length === 0 ? (
              <li className="px-3 py-2 text-muted">ไม่พบสินค้า</li>
            ) : (
              hits.map((p) => (
                <li
                  key={p.id}
                  onMouseDown={() => selectProduct(openIdx, p)}
                  className="px-3 py-2 cursor-pointer hover:bg-brand-50 flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-brand-800">{p.sku}</span>
                    <span className="text-brand-600 font-semibold">{fmtMoney(p.current_price)} บ</span>
                  </div>
                  <div className="text-muted truncate">{p.description}</div>
                  {(p.upc || p.dept) && (
                    <div className="text-[10px] text-muted">
                      {p.upc ? `UPC ${p.upc}` : ""}
                      {p.upc && p.dept ? " · " : ""}
                      {p.dept ? p.dept : ""}
                      {p.dept && p.vendor_name ? ` · ${p.vendor_name}` : ""}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        );
      })()}
    </div>
  );
}
