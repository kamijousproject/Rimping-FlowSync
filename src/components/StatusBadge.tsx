const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "ร่าง", cls: "bg-gray-100 text-gray-700" },
  confirmed: { label: "ยืนยันแล้ว", cls: "bg-blue-100 text-blue-700" },
  packed: { label: "แพ็คของแล้ว", cls: "bg-indigo-100 text-indigo-700" },
  checked: { label: "ตรวจของแล้ว", cls: "bg-cyan-100 text-cyan-700" },
  delivered: { label: "ส่งของแล้ว", cls: "bg-amber-100 text-amber-800" },
  received: { label: "ลูกค้ารับของ", cls: "bg-brand-100 text-brand-800" },
  cancelled: { label: "ยกเลิก", cls: "bg-red-100 text-red-700" },
};

const PAY_LABELS: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "ยังไม่ชำระ", cls: "bg-red-100 text-red-700" },
  partial: { label: "ชำระบางส่วน", cls: "bg-amber-100 text-amber-800" },
  paid: { label: "ชำระครบ", cls: "bg-brand-100 text-brand-800" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_LABELS[status] || { label: status, cls: "bg-gray-100" };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export function PaymentBadge({ status }: { status: string }) {
  const m = PAY_LABELS[status] || { label: status, cls: "bg-gray-100" };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export function fmtMoney(n: number | string | null | undefined) {
  const v = Number(n || 0);
  return v.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
