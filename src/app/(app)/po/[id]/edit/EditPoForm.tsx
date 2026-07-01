"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info, X } from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";

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

export function EditPoForm({
  poId,
  poNumber,
  customerId,
  customerName,
  paidAmount,
  initialCreditTerm,
  initialNotes,
  initialItems,
}: {
  poId: number;
  poNumber: string;
  customerId: number;
  customerName: string;
  paidAmount: number;
  initialCreditTerm: number;
  initialNotes: string;
  initialItems: Item[];
}) {
  const router = useRouter();
  const [creditTerm, setCreditTerm] = useState(initialCreditTerm);
  const [notes, setNotes] = useState(initialNotes);
  const [items, setItems] = useState<Item[]>(
    initialItems.length ? initialItems : [newItem()]
  );
  const [creditAvailableForThis, setCreditAvailableForThis] = useState<number | null>(null);
  const [tempExtra, setTempExtra] = useState<number>(0);
  const [baseLimit, setBaseLimit] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load customer credit info; the credit available for *this* PO
  // is (limit - other outstanding) since this PO's remaining will be
  // recomputed from new total.
  useEffect(() => {
    fetch(`/api/customers/${customerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.customer) return;
        const effective = d.effective;
        const limit = effective ? Number(effective.effective_limit) : Number(d.customer.credit_limit);
        const totalOutstanding = Number(d.customer.outstanding);
        const thisPo = (d.pos || []).find((p: { id: number }) => p.id === poId);
        const thisOutstanding = thisPo ? Number(thisPo.remaining_amount) : 0;
        setCreditAvailableForThis(limit - (totalOutstanding - thisOutstanding));
        setTempExtra(effective ? Number(effective.temp_extra) : 0);
        setBaseLimit(Number(d.customer.credit_limit));
      })
      .catch(() => {});
  }, [customerId, poId]);

  const total = items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
    0
  );
  const newRemaining = total - paidAmount;
  const overLimit =
    creditAvailableForThis !== null &&
    newRemaining > creditAvailableForThis + 0.001;
  const belowPaid = total < paidAmount;

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (items.length === 0 || items.some((it) => !it.product_name)) {
      setErr("กรุณากรอกรายการสินค้าให้ครบ");
      return;
    }
    setLoading(true);
    const r = await fetch(`/api/po/${poId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    router.push(`/po/${poId}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/po/${poId}`}
          className="text-sm text-brand-700 hover:underline"
        >
          ← กลับ
        </Link>
        <h1 className="text-2xl font-bold text-brand-800 mt-1">
          แก้ไข {poNumber}
        </h1>
        <div className="text-sm text-muted">
          ลูกค้า: {customerName} · ชำระแล้ว {fmtMoney(paidAmount)} ฿
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="label">ลูกค้า</label>
            <input
              className="input bg-brand-50"
              value={customerName}
              disabled
            />
            <div className="text-xs text-muted mt-1">
              ไม่สามารถเปลี่ยนลูกค้าหลังออก Quotation ได้
            </div>
          </div>
          <div>
            <label className="label">เครดิต (วัน)</label>
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
          {tempExtra > 0 && (
            <div className="md:col-span-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>วงเงินชั่วคราวใช้งานอยู่:</strong> +{fmtMoney(tempExtra)} (วงเงินรวม{" "}
                {fmtMoney(baseLimit + tempExtra)}, วงเงินหลัก {fmtMoney(baseLimit)})
              </span>
            </div>
          )}
          {creditAvailableForThis !== null && (
            <div className="md:col-span-3 text-xs text-muted">
              วงเงินที่ใช้ได้สำหรับ Quotation นี้:{" "}
              <span className="font-semibold text-brand-800">{fmtMoney(creditAvailableForThis)}</span>
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
                  <th className="text-right p-2 w-32">ราคา/หน่ วย *</th>
                  <th className="text-right p-2 w-32">รวม</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const line =
                    Number(it.quantity || 0) * Number(it.unit_price || 0);
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
                            className="text-red-600 hover:bg-red-50 rounded-lg px-2 py-1"
                            title="ลบ"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td colSpan={5} className="p-2 text-right">
                    ยอดรวม
                  </td>
                  <td className="p-2 text-right text-brand-700 font-bold text-lg">
                    {fmtMoney(total)} ฿
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="p-2 text-right text-muted">
                    ชำระไปแล้ว
                  </td>
                  <td className="p-2 text-right text-brand-700">
                    {fmtMoney(paidAmount)} ฿
                  </td>
                  <td></td>
                </tr>
                <tr className="border-t font-bold">
                  <td colSpan={5} className="p-2 text-right">
                    คงค้างใหม่
                  </td>
                  <td className="p-2 text-right text-red-600">
                    {fmtMoney(newRemaining)} ฿
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

        {belowPaid && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ยอด Quotation ใหม่ ({fmtMoney(total)}) ต่ำกว่ายอดที่ชำระไปแล้ว (
            {fmtMoney(paidAmount)})
          </div>
        )}
        {overLimit && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ยอดคงค้างใหม่ ({fmtMoney(newRemaining)}) เกินวงเงินที่เหลือสำหรับ Quotation นี้
            ({creditAvailableForThis !== null ? fmtMoney(creditAvailableForThis) : "—"})
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
            disabled={loading || overLimit || belowPaid}
          >
            {loading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
          <Link href={`/po/${poId}`} className="btn-secondary">
            ยกเลิก
          </Link>
        </div>
      </form>
    </div>
  );
}
