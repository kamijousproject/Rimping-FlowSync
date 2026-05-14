"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/components/StatusBadge";
import { Edit2, Trash2 } from "lucide-react";
import { PaymentEditModal } from "./PaymentEditModal";

type Payment = {
  id: number;
  amount: number;
  paid_at: Date;
  method: string;
  reference: string | null;
  slip_path: string | null;
  notes: string | null;
  is_overpayment?: boolean;
};

type PaymentsSectionProps = {
  payments: Payment[];
  poId: number;
};

export function PaymentsSection({ payments, poId }: PaymentsSectionProps) {
  const router = useRouter();
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  function handleSaved() {
    setEditingPayment(null);
    router.refresh();
  }

  function handleDeleted() {
    setEditingPayment(null);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3">ประวัติการชำระเงิน</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b">
            <tr>
              <th className="text-left p-2">วันที่</th>
              <th className="text-right">ยอด</th>
              <th>วิธี</th>
              <th>อ้างอิง</th>
              <th>สลิป</th>
              <th>หมายเหตุ</th>
              <th className="text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-2">
                  {new Date(p.paid_at).toLocaleString("th-TH")}
                </td>
                <td className="text-right text-brand-700 font-medium">
                  {fmtMoney(p.amount)}
                </td>
                <td className="text-center text-xs">{p.method}</td>
                <td className="text-xs">{p.reference || "-"}</td>
                <td className="text-center">
                  {p.slip_path ? (
                    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p.slip_path) ? (
                      <a
                        href={p.slip_path}
                        target="_blank"
                        rel="noreferrer"
                        title="คลิกเพื่อดูเต็ม"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.slip_path}
                          alt="สลิป"
                          className="w-12 h-12 object-cover rounded border border-border inline-block hover:ring-2 hover:ring-brand-400 transition"
                        />
                      </a>
                    ) : (
                      <a
                        href={p.slip_path}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-700 hover:underline text-xs"
                      >
                        ดูไฟล์ (PDF)
                      </a>
                    )
                  ) : (
                    <span className="text-muted text-xs">-</span>
                  )}
                </td>
                <td className="text-xs text-muted">{p.notes || "-"}</td>
                <td className="text-center">
                  {!p.is_overpayment ? (
                    <button
                      onClick={() => setEditingPayment(p)}
                      className="text-brand-600 hover:text-brand-800 p-1"
                      title="แก้ไข"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-orange-600" title="ไม่สามารถแก้ไขรายการ overpayment ได้">
                      (เครดิตโน๊ต)
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-muted">
                  ยังไม่มีการชำระเงิน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingPayment && (
        <PaymentEditModal
          payment={editingPayment}
          poId={poId}
          onClose={() => setEditingPayment(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
