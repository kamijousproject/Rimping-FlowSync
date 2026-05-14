"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/components/StatusBadge";
import { AlertCircle, CheckCircle, Clock, RotateCcw } from "lucide-react";

type CreditNote = {
  id: number;
  ccn_number: string;
  po_id: number;
  po_number?: string;
  payment_id: number;
  amount: number;
  status: "active" | "used" | "refunded" | "expired";
  usage_type: "keep_as_credit" | "refund_to_customer";
  used_amount: number;
  refunded_at: string | null;
  notes: string | null;
  created_at: string;
  expires_at: string | null;
  remaining?: number;
};

export function CustomerCreditNotesSection({ customerId }: { customerId: number }) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [availableCredit, setAvailableCredit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/${customerId}/credit-notes`)
      .then((r) => r.json())
      .then((data) => {
        setCreditNotes(data.credit_notes || []);
        setAvailableCredit(data.available_credit || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold mb-3">เครดิตโน๊ต (จากการชำระเกิน)</h3>
        <div className="text-sm text-muted">กำลังโหลด...</div>
      </div>
    );
  }

  if (creditNotes.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold mb-3">เครดิตโน๊ต (จากการชำระเกิน)</h3>
        <div className="text-sm text-muted">ไม่มีเครดิตโน๊ต</div>
      </div>
    );
  }

  const activeNotes = creditNotes.filter((n) => n.status === "active");
  const totalActive = activeNotes.reduce((sum, n) => sum + (n.remaining || n.amount - n.used_amount), 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">เครดิตโน๊ต (จากการชำระเกิน)</h3>
        {totalActive > 0 && (
          <div className="text-sm">
            <span className="text-muted">ใช้ได้ทั้งหมด: </span>
            <span className="font-bold text-green-600">{fmtMoney(totalActive)} บาท</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b">
            <tr>
              <th className="text-left py-2">เลขที่</th>
              <th className="text-left">PO ต้นทาง</th>
              <th className="text-right">ยอดเครดิต</th>
              <th className="text-right">ใช้ไป</th>
              <th className="text-right">คงเหลือ</th>
              <th className="text-center">สถานะ</th>
              <th className="text-left">วันที่สร้าง</th>
            </tr>
          </thead>
          <tbody>
            {creditNotes.map((note) => {
              const remaining = note.remaining ?? note.amount - note.used_amount;
              return (
                <tr key={note.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{note.ccn_number}</td>
                  <td>
                    <Link
                      href={`/po/${note.po_id}`}
                      className="text-brand-700 hover:underline text-xs"
                    >
                      {note.po_number || `PO #${note.po_id}`}
                    </Link>
                  </td>
                  <td className="text-right">{fmtMoney(note.amount)}</td>
                  <td className="text-right text-muted">{fmtMoney(note.used_amount)}</td>
                  <td className="text-right">
                    <span className={remaining > 0 ? "font-medium text-green-600" : "text-muted"}>
                      {fmtMoney(remaining)}
                    </span>
                  </td>
                  <td className="text-center">
                    <StatusBadge status={note.status} />
                  </td>
                  <td className="text-xs text-muted">
                    {new Date(note.created_at).toLocaleDateString("th-TH")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CreditNote["status"] }) {
  const styles = {
    active: "bg-green-100 text-green-700",
    used: "bg-blue-100 text-blue-700",
    refunded: "bg-orange-100 text-orange-700",
    expired: "bg-gray-100 text-gray-500",
  };

  const labels = {
    active: "ใช้งานได้",
    used: "ใช้หมดแล้ว",
    refunded: "โอนคืนแล้ว",
    expired: "หมดอายุ",
  };

  const icons = {
    active: <CheckCircle className="w-3 h-3" />,
    used: <Clock className="w-3 h-3" />,
    refunded: <RotateCcw className="w-3 h-3" />,
    expired: <AlertCircle className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {labels[status]}
    </span>
  );
}
