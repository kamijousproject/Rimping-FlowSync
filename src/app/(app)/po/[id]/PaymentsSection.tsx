"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/components/StatusBadge";
import { Edit2, RefreshCw, Check } from "lucide-react";
import { PaymentEditModal } from "./PaymentEditModal";
import { JdaProgressBar, type JdaPollData } from "@/components/JdaProgress";

type Payment = {
  id: number;
  amount: number;
  paid_at: Date;
  method: string;
  reference: string | null;
  slip_path: string | null;
  notes: string | null;
  is_overpayment?: boolean;
  jda_job_id: string | null;
  jda_synced_at: Date | string | null;
};

type JdaState = "not_triggered" | "pending" | "success" | "error";

function JdaBadge({
  payment,
  poId,
  onSynced,
}: {
  payment: Payment;
  poId: number;
  onSynced: (paymentId: number) => void;
}) {
  const [state, setState] = useState<JdaState>(
    payment.jda_synced_at
      ? "success"
      : payment.jda_job_id
      ? "pending"
      : "not_triggered"
  );
  const [busy, setBusy] = useState(false);
  const [pollData, setPollData] = useState<JdaPollData | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state !== "pending") return;

    async function poll() {
      const r = await fetch(`/api/po/${poId}/payments/${payment.id}/jda-status`);
      if (!r.ok) return;
      const d: JdaPollData = await r.json();
      setPollData(d);
      if (d.status === "success") {
        setState("success");
        onSynced(payment.id);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }

    poll();
    pollRef.current = setInterval(poll, 15_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state, payment.id, poId, onSynced]);

  async function triggerNow() {
    setBusy(true);
    try {
      const r = await fetch(`/api/po/${poId}/payments/${payment.id}/jda-trigger`, {
        method: "POST",
      });
      const d = await r.json();
      if (d.already_synced) { setState("success"); return; }
      if (r.ok) setState("pending");
      else setState("error");
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
    setBusy(true);
    try {
      const r = await fetch(`/api/po/${poId}/payments/${payment.id}/jda-status`);
      const d: JdaPollData = await r.json();
      setPollData(d);
      if (d.status === "success") {
        setState("success");
        onSynced(payment.id);
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === "success") {
    return (
      <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-md px-1.5 py-0.5 inline-flex items-center gap-0.5">
        JDA <Check className="w-2.5 h-2.5" />
      </span>
    );
  }

  if (state === "pending") {
    return (
      <div className="flex flex-col items-start gap-1.5 min-w-[160px]">
        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 flex items-center gap-1">
          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> กำลังส่งเข้า JDA
        </span>
        {pollData ? (
          <JdaProgressBar data={pollData} />
        ) : (
          <div className="text-[10px] text-muted">รอข้อมูล...</div>
        )}
        <button
          onClick={checkNow}
          disabled={busy}
          className="text-[10px] text-muted hover:text-brand-700 underline"
        >
          เช็คสถานะ
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={triggerNow}
      disabled={busy}
      className="text-[10px] text-muted hover:text-brand-700 underline flex items-center gap-0.5"
    >
      <RefreshCw className={`w-2.5 h-2.5 ${busy ? "animate-spin" : ""}`} />
      ส่ง JDA
    </button>
  );
}

type PaymentsSectionProps = {
  payments: Payment[];
  poId: number;
};

export function PaymentsSection({ payments: initialPayments, poId }: PaymentsSectionProps) {
  const router = useRouter();
  const [payments, setPayments] = useState(initialPayments);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  function handleSaved() {
    setEditingPayment(null);
    router.refresh();
  }

  function handleDeleted() {
    setEditingPayment(null);
    router.refresh();
  }

  function handleSynced(paymentId: number) {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId ? { ...p, jda_synced_at: new Date() } : p
      )
    );
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
              <th className="text-center">JDA</th>
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
                      <a href={p.slip_path} target="_blank" rel="noreferrer" title="คลิกเพื่อดูเต็ม">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.slip_path}
                          alt="สลิป"
                          className="w-12 h-12 object-cover rounded border border-border inline-block hover:ring-2 hover:ring-brand-400 transition"
                        />
                      </a>
                    ) : (
                      <a href={p.slip_path} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline text-xs">
                        ดูไฟล์ (PDF)
                      </a>
                    )
                  ) : (
                    <span className="text-muted text-xs">-</span>
                  )}
                </td>
                <td className="text-xs text-muted">{p.notes || "-"}</td>
                <td className="text-center">
                  <JdaBadge payment={p} poId={poId} onSynced={handleSynced} />
                </td>
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
                <td colSpan={8} className="text-center py-6 text-muted">
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
