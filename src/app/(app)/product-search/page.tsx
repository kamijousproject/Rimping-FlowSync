"use client";
import { Suspense, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Info,
  Search,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  Printer,
  AlertTriangle,
  PackageSearch,
} from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";
import { QuoteDocument } from "./QuoteDocument";
import { ProductPickerModal, type ProductHit } from "./ProductPickerModal";

const GRID_COLS =
  "grid-cols-[28px_minmax(160px,1.6fr)_minmax(140px,1.4fr)_76px_72px_76px_104px_112px_36px]";

export default function ProductSearchPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading...</div>}>
      <ProductSearchInner />
    </Suspense>
  );
}

type Customer = {
  id: number;
  name: string;
  code: string | null;
  contact_person: string | null;
  phone: string | null;
  tax_id: string | null;
  address: string | null;
  credit_limit: number;
  outstanding: number;
  credit_available: number;
  effective_limit: number;
  temp_extra: number;
  credit_notes_balance: number;
  default_credit_term_days: number;
};

type Item = {
  product_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

function ProductSearchInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const presetCust = sp.get("customer_id");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [custQuery, setCustQuery] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [creditTerm, setCreditTerm] = useState(30);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [stockInfo, setStockInfo] = useState<Record<string, number>>({});
  const [nonVatSkus, setNonVatSkus] = useState<Set<string>>(new Set());
  const [creatorName, setCreatorName] = useState<string | null>(null);
  // Stamped at print time, never during render — a render-time `new Date()` would
  // differ between SSR and client and break hydration.
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);

  // Covers Ctrl+P / browser menu printing, which bypasses the button handler.
  useEffect(() => {
    const stamp = () => flushSync(() => setIssuedAt(new Date()));
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCreatorName(d?.user?.full_name ?? null))
      .catch(() => {});
  }, []);

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
          if (c) {
            setCreditTerm(c.default_credit_term_days);
            setCustQuery(c.name);
          }
        }
      })
      .catch(console.error);
  }, [presetCust]);

  const skuKey = items
    .map((it) => it.product_name)
    .filter(Boolean)
    .join(",");

  useEffect(() => {
    const skus = skuKey ? skuKey.split(",") : [];
    // Nothing to fetch. Any leftover keys are harmless — lookups are keyed by the
    // row's current product_name, so entries for removed rows are never rendered.
    if (skus.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/inventory/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: skus.map((sku) => ({ sku, quantity: 1 })),
          }),
        });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const map: Record<string, number> = {};
        const nonVat = new Set<string>();
        d.items?.forEach((i: { sku: string; stock: number; vatable: boolean }) => {
          map[i.sku] = i.stock;
          if (!i.vatable) nonVat.add(i.sku);
        });
        if (!cancelled) {
          setStockInfo(map);
          setNonVatSkus(nonVat);
        }
      } catch {
        /* stock display is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skuKey]);

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
  const overLimit = selected && total > Number(selected.credit_available || 0);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  // Picks from the modal land here as new rows (qty defaults to 1, editable inline).
  function addProducts(picked: ProductHit[]) {
    setItems((prev) => [
      ...prev,
      ...picked.map((p) => ({
        product_name: p.sku,
        description: p.description,
        quantity: 1,
        unit: "ชิ้น",
        unit_price: Number(p.current_price),
      })),
    ]);
    setShowPicker(false);
    setErr(null);
  }

  function validateItems(): boolean {
    if (items.length === 0) {
      setErr("กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ");
      return false;
    }
    if (items.some((it) => !it.quantity || it.quantity <= 0)) {
      setErr("กรุณาระบุจำนวนที่ถูกต้อง");
      return false;
    }
    return true;
  }

  // Print / Save PDF — renders the hidden document, no DB write at all.
  // flushSync commits the date to the DOM before the browser snapshots the page.
  function handlePrint() {
    setErr(null);
    if (!validateItems()) return;
    flushSync(() => setIssuedAt(new Date()));
    window.print();
  }

  // Saving as draft DOES need a customer (credit check + PO ownership).
  function handleSaveDraftClick() {
    setErr(null);
    if (!customerId) {
      setErr("กรุณาเลือกลูกค้าก่อนบันทึกเป็น Quotation");
      return;
    }
    if (!validateItems()) return;
    setShowConfirm(true);
  }

  async function confirmSaveDraft() {
    setShowConfirm(false);
    setLoading(true);
    setErr(null);

    const r = await fetch("/api/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        credit_term_days: creditTerm,
        notes,
        items,
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

  return (
    <div className="space-y-6">
      {/* ───── Screen UI (hidden when printing) ───── */}
      <div className="print:hidden space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-800 mt-1 flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-brand-600" />
            ค้นหาเมนูสินค้า
          </h1>
          <p className="text-sm text-muted mt-1">
            ค้นหาสินค้าและออกใบเสนอราคาให้ลูกค้าพิจารณา — พิมพ์ได้เลยโดยไม่บันทึกลงระบบ
          </p>
        </div>

        {/* Section: ข้อมูลพื้นฐาน */}
        <section className="bg-white border border-border rounded-[20px] p-7 md:p-8 space-y-5">
          <h2 className="font-semibold text-[15px] text-foreground">ข้อมูลพื้นฐาน</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 relative">
              <label className="label">ลูกค้า</label>
              <div className="relative">
                <input
                  className="input h-12 rounded-xl pr-10"
                  placeholder="พิมพ์ชื่อหรือรหัสลูกค้า... (ไม่ระบุก็พิมพ์ใบเสนอราคาได้)"
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
                          {c.code ? (
                            <span className="text-muted mr-1">[{c.code}]</span>
                          ) : null}
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
                        <span
                          className={
                            c.credit_available <= 0
                              ? "text-red-600 font-semibold"
                              : "font-semibold text-brand-700"
                          }
                        >
                          {fmtMoney(c.credit_available)} บ
                        </span>
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
              <label className="label">เครดิต (วัน)</label>
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
                    <span>
                      <strong>วงเงินชั่วคราวใช้งานอยู่:</strong> +
                      {fmtMoney(selected.temp_extra)} (วงเงินรวม{" "}
                      {fmtMoney(selected.effective_limit)})
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-gray-50 rounded-xl p-4">
                  <div>
                    <div className="text-xs text-muted">วงเงิน (effective)</div>
                    <div className="font-semibold mt-0.5">
                      {fmtMoney(selected.effective_limit)} บ
                    </div>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[15px] text-foreground">รายการสินค้า</h2>
            {items.length > 0 && (
              <span className="text-xs text-muted">{items.length} รายการ</span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <PackageSearch className="w-9 h-9 text-gray-300 mx-auto" />
              <p className="text-sm text-muted mt-3">ยังไม่มีสินค้าในรายการ</p>
              <p className="text-xs text-muted mt-1">
                กด &ldquo;เพิ่มสินค้า&rdquo; เพื่อค้นหาและเลือกสินค้า
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: grid table */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[820px]">
                  <div
                    className={`grid ${GRID_COLS} gap-3 px-2 pb-2.5 border-b border-gray-100`}
                  >
                    <div />
                    <div className="text-xs font-medium text-muted uppercase tracking-wide">
                      สินค้า (SKU)
                    </div>
                    <div className="text-xs font-medium text-muted uppercase tracking-wide">
                      รายละเอียด
                    </div>
                    <div className="text-xs font-medium text-muted uppercase tracking-wide text-right">
                      จำนวน *
                    </div>
                    <div className="text-xs font-medium text-muted uppercase tracking-wide">
                      หน่วย
                    </div>
                    <div className="text-xs font-medium text-muted uppercase tracking-wide text-right">
                      Stock
                    </div>
                    <div className="text-xs font-medium text-muted uppercase tracking-wide text-right">
                      ราคา/หน่วย *
                    </div>
                    <div className="text-xs font-medium text-muted uppercase tracking-wide text-right">
                      รวม
                    </div>
                    <div />
                  </div>

                  {items.map((it, idx) => {
                    const line =
                      Number(it.quantity || 0) * Number(it.unit_price || 0);
                    const stock = stockInfo[it.product_name];
                    return (
                      <div
                        key={idx}
                        className={`grid ${GRID_COLS} gap-3 px-2 items-center h-16 border-b border-gray-100 rounded-lg transition-colors duration-200 hover:bg-brand-50/40`}
                      >
                        <div className="text-xs text-muted">{idx + 1}</div>
                        <div className="font-mono text-xs font-semibold text-brand-800 truncate">
                          {it.product_name}
                        </div>
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
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(idx, { quantity: Number(e.target.value) })
                          }
                        />
                        <input
                          className="h-10 rounded-[10px] border border-border bg-white px-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                          value={it.unit}
                          onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        />
                        <div className="text-right text-sm">
                          {stock !== undefined ? (
                            <span
                              className={
                                stock < 0
                                  ? "text-red-600 font-semibold"
                                  : stock < Number(it.quantity || 0)
                                    ? "text-orange-600 font-semibold"
                                    : "text-success font-medium"
                              }
                            >
                              {stock < 0 ? `${stock} (ติดลบ)` : stock}
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
                          value={it.unit_price}
                          onChange={(e) =>
                            updateItem(idx, { unit_price: Number(e.target.value) })
                          }
                        />
                        <div className="text-right text-sm font-medium text-foreground">
                          {fmtMoney(line)}
                        </div>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-muted hover:text-danger hover:bg-red-50 rounded-lg p-1.5 transition"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                  const stock = stockInfo[it.product_name];
                  return (
                    <div key={idx} className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-semibold text-brand-800 break-all">
                            {it.product_name}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5">
                            รายการที่ {idx + 1}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="shrink-0 text-muted hover:text-danger hover:bg-red-50 rounded-lg p-1.5 transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(idx, { quantity: Number(e.target.value) })
                            }
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
                            value={it.unit_price}
                            onChange={(e) =>
                              updateItem(idx, { unit_price: Number(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Stock</label>
                          <div className="h-11 flex items-center text-sm">
                            {stock !== undefined ? (
                              <span
                                className={
                                  stock < 0
                                    ? "text-red-600 font-semibold"
                                    : stock < Number(it.quantity || 0)
                                      ? "text-orange-600 font-semibold"
                                      : "text-success font-medium"
                                }
                              >
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
                        <span className="text-base font-semibold text-brand-700">
                          {fmtMoney(line)} บาท
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="mt-4 w-full h-11 rounded-xl border border-dashed border-border text-sm text-muted hover:text-brand-700 hover:border-brand-300 hover:bg-brand-50/40 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            เพิ่มสินค้า
          </button>

          {items.length > 0 && (
            <div className="mt-6 flex justify-end">
              <div className="text-right">
                <div className="text-sm text-muted">รวมทั้งหมด</div>
                <div className="text-3xl font-bold text-brand-700 mt-0.5">
                  {fmtMoney(total)} บาท
                </div>
              </div>
            </div>
          )}
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
          <div className="text-sm text-warning bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              ยอดรวม ({fmtMoney(total)}) เกินวงเงินคงเหลือของลูกค้า (
              {selected ? fmtMoney(selected.credit_available) : 0}) — พิมพ์ใบเสนอราคาได้
              แต่จะบันทึกเป็น Quotation ไม่ได้จนกว่าวงเงินจะพอ
            </span>
          </div>
        )}
        {err && (
          <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {err}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="h-11 px-5 rounded-xl bg-brand-600 text-white text-sm font-medium inline-flex items-center gap-2 transition-all duration-200 hover:bg-brand-700 hover:-translate-y-px"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ / บันทึก PDF
          </button>
          <button
            type="button"
            onClick={handleSaveDraftClick}
            className="h-11 px-5 rounded-xl border border-border bg-white text-foreground text-sm font-medium inline-flex items-center gap-2 transition-all duration-200 hover:bg-gray-50 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            disabled={loading || overLimit || !customerId}
            title={!customerId ? "เลือกลูกค้าก่อนจึงจะบันทึกได้" : undefined}
          >
            <Save className="w-4 h-4" />
            {loading ? "กำลังบันทึก..." : "บันทึกเป็น Quotation (ร่าง)"}
          </button>
          <Link
            href="/dashboard"
            className="h-11 px-5 rounded-xl border border-border bg-white text-foreground text-sm font-medium inline-flex items-center gap-2 transition-all duration-200 hover:bg-gray-50 hover:-translate-y-px"
          >
            ยกเลิก
          </Link>
        </div>

        <p className="text-xs text-muted">
          การพิมพ์ / บันทึก PDF จะไม่บันทึกรายการนี้ลงระบบ — ถ้าลูกค้าตกลงซื้อ
          ค่อยกด &ldquo;บันทึกเป็น Quotation (ร่าง)&rdquo; โดยไม่ต้องกรอกใหม่
        </p>
      </div>

      {/* ───── Print-only document (no DB write) ───── */}
      <div className="hidden print:block">
        <QuoteDocument
          customer={
            selected
              ? {
                  name: selected.name,
                  contact_person: selected.contact_person,
                  address: selected.address,
                  phone: selected.phone,
                  tax_id: selected.tax_id,
                }
              : null
          }
          items={items}
          nonVatSkus={nonVatSkus}
          notes={notes}
          creditTerm={creditTerm}
          issuedAt={issuedAt}
          creatorName={creatorName}
        />
      </div>

      {/* Product picker — mounted only while open so its state resets each time */}
      {showPicker && (
        <ProductPickerModal
          existingSkus={items.map((it) => it.product_name)}
          onClose={() => setShowPicker(false)}
          onAdd={addProducts}
        />
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
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
                    {fmtMoney(total)} บาท
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">เครดิต:</span>
                  <span className="font-medium">{creditTerm} วัน</span>
                </div>
              </div>

              <p className="text-muted text-center">
                บันทึกรายการนี้เป็น Quotation สถานะ &ldquo;ร่าง&rdquo; ใช่หรือไม่?
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
              <button type="button" onClick={confirmSaveDraft} className="btn-primary">
                ยืนยัน บันทึกเป็นร่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
