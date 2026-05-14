"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fmtMoney } from "@/components/StatusBadge";

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
      });
  }, [presetCust]);

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

  const recalcPos = useCallback((idx: number) => {
    const el = inputRefs.current[idx];
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDropdownPos({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width });
  }, []);

  function onProdQueryChange(idx: number, val: string) {
    const cleared = !val.trim();
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, _prodQuery: val, _prodOpen: true, product_name: val, _prodHits: cleared ? [] : it._prodHits }
          : it
      )
    );
    setOpenIdx(idx);
    recalcPos(idx);
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
    <div className="space-y-4">
      <div>
        <Link href="/po" className="text-sm text-brand-700 hover:underline">
          ← กลับ
        </Link>
        <h1 className="text-2xl font-bold text-brand-800 mt-1">
          สร้าง Purchase Order ใหม่
        </h1>
      </div>

      <form onSubmit={handleSubmitClick} className="space-y-4">
        <div className="card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <label className="label">ลูกค้า *</label>
            <input
              className="input"
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
            {custOpen && custMatches.length > 0 && (
              <ul className="absolute z-30 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto text-sm">
                {custMatches.map((c) => (
                  <li
                    key={c.id}
                    onMouseDown={() => selectCustomer(c)}
                    className={`px-3 py-2 cursor-pointer hover:bg-brand-50 ${
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
              <div className="absolute z-30 mt-1 w-full bg-white border border-border rounded-lg shadow-lg px-3 py-2 text-sm text-muted">
                ไม่พบลูกค้าที่ตรงกัน
              </div>
            )}
          </div>
          <div>
            <label className="label">เครดิต (วัน) *</label>
            <input
              className="input bg-gray-50 text-muted cursor-not-allowed"
              value={creditTerm ? `${creditTerm} วัน` : "—"}
              readOnly
              tabIndex={-1}
            />
            <p className="text-[11px] text-muted mt-0.5">ตามเครดิตเริ่มต้นของร้าน</p>
          </div>
          {selected && (
            <div className="md:col-span-3 space-y-2">
              {selected.temp_extra > 0 && (
                <div className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  🔵 <strong>วงเงินชั่วคราวใช้งานอยู่:</strong> +{fmtMoney(selected.temp_extra)} (วงเงินรวม {fmtMoney(selected.effective_limit)})
                </div>
              )}
              <div className="grid grid-cols-4 gap-3 text-sm bg-brand-50 rounded-lg p-3">
                <div>
                  <div className="text-xs text-muted">วงเงิน (effective)</div>
                  <div className="font-semibold">
                    {fmtMoney(selected.effective_limit)} บ
                  </div>
                  {selected.temp_extra > 0 && (
                    <div className="text-xs text-muted">หลัก {fmtMoney(selected.credit_limit)}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted">ลูกหนี้คงค้าง</div>
                  <div className="font-semibold text-red-600">
                    {fmtMoney(selected.outstanding)} บ
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">เครดิตโน๊ต</div>
                  <div className="font-semibold text-green-600">
                    {fmtMoney(selected.credit_notes_balance)} บ
                  </div>
                  <div className="text-[10px] text-muted">ใช้ก่อนเสมอ</div>
                </div>
                <div>
                  <div className="text-xs text-muted">วงเงินคงเหลือ</div>
                  <div className="font-semibold text-brand-700">
                    {fmtMoney(selected.credit_available)} บ
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">รายการสินค้า</h3>
            <button
              type="button"
              onClick={() => setItems([...items, newItem()])}
              className="btn-secondary text-sm"
            >
              + เพิ่มรายการ
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="text-left p-2">สินค้า (SKU) *</th>
                  <th className="text-left p-2">รายละเอียด</th>
                  <th className="text-right p-2 w-24">จำนวน *</th>
                  <th className="text-left p-2 w-24">หน่วย</th>
                  <th className="text-right p-2 w-32">ราคา/หน่วย *</th>
                  <th className="text-right p-2 w-32">รวม</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const line = Number(it.quantity || 0) * Number(it.unit_price || 0);
                  return (
                    <tr key={idx} className="border-t">
                      <td className="p-1">
                        <input
                          ref={(el) => { inputRefs.current[idx] = el; }}
                          className="input"
                          required
                          placeholder="ค้น SKU..."
                          autoComplete="off"
                          value={it._prodQuery ?? it.product_name}
                          onFocus={() => { setOpenIdx(idx); recalcPos(idx); updateItem(idx, { _prodOpen: true }); }}
                          onBlur={() => setTimeout(() => { updateItem(idx, { _prodOpen: false }); setOpenIdx(null); setDropdownPos(null); }, 150)}
                          onChange={(e) => onProdQueryChange(idx, e.target.value)}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="input"
                          value={it.description}
                          onChange={(e) =>
                            updateItem(idx, { description: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          className="input text-right"
                          required
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(idx, {
                              quantity: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="input"
                          value={it.unit}
                          onChange={(e) =>
                            updateItem(idx, { unit: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input text-right"
                          required
                          value={it.unit_price}
                          onChange={(e) =>
                            updateItem(idx, {
                              unit_price: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        {fmtMoney(line)}
                      </td>
                      <td className="p-1 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-600 hover:bg-red-50 rounded px-2 py-1"
                            title="ลบ"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={5} className="p-2 text-right">
                    รวมทั้งหมด
                  </td>
                  <td className="p-2 text-right text-brand-700 text-lg">
                    {fmtMoney(total)} ฿
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <label className="label">หมายเหตุ</label>
          <textarea
            className="input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {overLimit && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ยอด PO ({fmtMoney(total)}) เกินวงเงินคงเหลือของลูกค้า (
            {selected ? fmtMoney(selected.credit_available) : 0}) ไม่สามารถออก PO ได้
          </div>
        )}
        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="btn-primary"
            disabled={loading || overLimit || !customerId}
          >
            {loading ? "กำลังบันทึก..." : "บันทึก PO (สถานะ: ร่าง)"}
          </button>
          <Link href="/po" className="btn-secondary">
            ยกเลิก
          </Link>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-brand-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              ยืนยันการสร้าง PO
            </h2>
            
            <div className="space-y-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
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
                ต้องการสร้าง PO นี้ใช่หรือไม่?
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
                ยืนยัน สร้าง PO
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
                  {p.dept && (
                    <div className="text-[10px] text-muted">
                      {p.dept}{p.vendor_name ? ` · ${p.vendor_name}` : ""}
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
