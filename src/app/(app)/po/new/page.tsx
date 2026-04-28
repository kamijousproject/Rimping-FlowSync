"use client";
import { Suspense, useEffect, useState } from "react";
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
  default_credit_term_days: number;
};

type Item = {
  product_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

const newItem = (): Item => ({
  product_name: "",
  description: "",
  quantity: 1,
  unit: "ชิ้น",
  unit_price: 0,
});

function NewPoInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const presetCust = sp.get("customer_id");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [creditTerm, setCreditTerm] = useState(30);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.customers || []);
        if (presetCust) {
          const id = Number(presetCust);
          setCustomerId(id);
          const c = (d.customers || []).find((x: Customer) => x.id === id);
          if (c) setCreditTerm(c.default_credit_term_days);
        }
      });
  }, [presetCust]);

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
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!customerId) {
      setErr("กรุณาเลือกลูกค้า");
      return;
    }
    if (items.length === 0 || items.some((it) => !it.product_name)) {
      setErr("กรุณากรอกรายการสินค้าให้ครบ");
      return;
    }
    setLoading(true);
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
    <div className="space-y-4 max-w-5xl">
      <div>
        <Link href="/po" className="text-sm text-brand-700 hover:underline">
          ← กลับ
        </Link>
        <h1 className="text-2xl font-bold text-brand-800 mt-1">
          สร้าง Purchase Order ใหม่
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="label">ลูกค้า *</label>
            <select
              className="input"
              value={customerId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setCustomerId(id || "");
                const c = customers.find((x) => x.id === id);
                if (c) setCreditTerm(c.default_credit_term_days);
              }}
              required
            >
              <option value="">— เลือกลูกค้า —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ""}
                  {c.name} (วงเงินเหลือ {fmtMoney(c.credit_available)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">เครดิต (วัน) *</label>
            <select
              className="input"
              value={creditTerm}
              onChange={(e) => setCreditTerm(Number(e.target.value))}
            >
              <option value={7}>7 วัน</option>
              <option value={15}>15 วัน</option>
              <option value={30}>30 วัน</option>
              <option value={60}>60 วัน</option>
            </select>
          </div>
          {selected && (
            <div className="md:col-span-3 grid grid-cols-3 gap-3 text-sm bg-brand-50 rounded-lg p-3">
              <div>
                <div className="text-xs text-muted">วงเงิน</div>
                <div className="font-semibold">
                  {fmtMoney(selected.credit_limit)} ฿
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">ลูกหนี้คงค้าง</div>
                <div className="font-semibold text-red-600">
                  {fmtMoney(selected.outstanding)} ฿
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">วงเงินคงเหลือ</div>
                <div className="font-semibold text-brand-700">
                  {fmtMoney(selected.credit_available)} ฿
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
                  <th className="text-left p-2">สินค้า *</th>
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
                          className="input"
                          required
                          value={it.product_name}
                          onChange={(e) =>
                            updateItem(idx, { product_name: e.target.value })
                          }
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
                          step="0.01"
                          min="0.01"
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
    </div>
  );
}
