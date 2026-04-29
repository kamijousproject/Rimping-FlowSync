"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";

type Log = {
  id: number;
  edited_by: number;
  editor_name: string;
  summary: string;
  changes: string;
  created_at: string | Date;
};

type Snapshot = {
  credit_term_days: number;
  notes: string | null;
  subtotal: number;
  total: number;
  items: {
    product_name: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    line_total: number;
  }[];
};

function parseChanges(json: string): { before: Snapshot; after: Snapshot } | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function ItemTable({ items }: { items: Snapshot["items"] }) {
  return (
    <table className="w-full text-xs border border-border">
      <thead className="bg-brand-50 text-muted">
        <tr>
          <th className="text-left p-1.5">สินค้า</th>
          <th className="text-right p-1.5">จำนวน</th>
          <th className="text-left p-1.5">หน่วย</th>
          <th className="text-right p-1.5">ราคา/หน่วย</th>
          <th className="text-right p-1.5">รวม</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i} className="border-t border-border">
            <td className="p-1.5">
              {it.product_name}
              {it.description && (
                <div className="text-[10px] text-muted">{it.description}</div>
              )}
            </td>
            <td className="text-right p-1.5">{it.quantity}</td>
            <td className="p-1.5">{it.unit}</td>
            <td className="text-right p-1.5">{fmtMoney(it.unit_price)}</td>
            <td className="text-right p-1.5">{fmtMoney(it.line_total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LogRow({ log }: { log: Log }) {
  const [open, setOpen] = useState(false);
  const diff = parseChanges(log.changes);
  return (
    <div className="border border-border rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-3 hover:bg-brand-50 text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{log.summary}</div>
          <div className="text-xs text-muted">
            {new Date(log.created_at).toLocaleString("th-TH")} · โดย{" "}
            {log.editor_name}
          </div>
        </div>
      </button>
      {open && diff && (
        <div className="p-3 border-t border-border bg-brand-50/30 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="font-semibold text-muted mb-1">ก่อน</div>
              <div className="space-y-1">
                <div>
                  เครดิต:{" "}
                  <span className="font-mono">
                    {diff.before.credit_term_days} วัน
                  </span>
                </div>
                <div>
                  ยอดรวม:{" "}
                  <span className="font-mono">
                    {fmtMoney(diff.before.total)} ฿
                  </span>
                </div>
                <div>
                  หมายเหตุ:{" "}
                  <span className="text-muted">
                    {diff.before.notes || "—"}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <ItemTable items={diff.before.items} />
              </div>
            </div>
            <div>
              <div className="font-semibold text-brand-700 mb-1">หลัง</div>
              <div className="space-y-1">
                <div>
                  เครดิต:{" "}
                  <span className="font-mono">
                    {diff.after.credit_term_days} วัน
                  </span>
                </div>
                <div>
                  ยอดรวม:{" "}
                  <span className="font-mono font-semibold text-brand-700">
                    {fmtMoney(diff.after.total)} ฿
                  </span>
                </div>
                <div>
                  หมายเหตุ:{" "}
                  <span className="text-muted">
                    {diff.after.notes || "—"}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <ItemTable items={diff.after.items} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EditLogsSection({ logs }: { logs: Log[] }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <History className="w-4 h-4 text-brand-700" />
        ประวัติการแก้ไข PO
        <span className="text-xs text-muted font-normal">
          ({logs.length} ครั้ง)
        </span>
      </h3>
      {logs.length === 0 ? (
        <div className="text-sm text-muted text-center py-4">
          ยังไม่มีการแก้ไข
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <LogRow key={l.id} log={l} />
          ))}
        </div>
      )}
    </div>
  );
}
