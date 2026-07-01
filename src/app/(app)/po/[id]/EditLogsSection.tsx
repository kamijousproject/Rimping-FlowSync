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
  logType?: "po" | "cn";
};

type PoSnapshot = {
  credit_term_days?: number;
  notes?: string | null;
  subtotal?: number;
  total?: number;
  items?: {
    product_name: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    line_total: number;
  }[];
  [key: string]: unknown;
};

function parseChanges(json: string): { before: PoSnapshot; after: PoSnapshot } | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && "before" in parsed && "after" in parsed) {
      return parsed as { before: PoSnapshot; after: PoSnapshot };
    }
    return null;
  } catch {
    return null;
  }
}

function ItemTable({ items }: { items: NonNullable<PoSnapshot["items"]> }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <table className="w-full text-xs border border-border">
      <thead className="bg-gray-50 text-muted">
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

const FIELD_LABELS: Record<string, string> = {
  status: "สถานะ",
  tax_invoice_number: "เลขใบกำกับภาษี",
  credit_term_days: "เครดิต (วัน)",
  notes: "หมายเหตุ",
  total: "ยอดรวม",
  subtotal: "ยอดก่อนภาษี",
};

function SnapshotPanel({
  snapshot,
  label,
  labelClass,
}: {
  snapshot: PoSnapshot;
  label: string;
  labelClass: string;
}) {
  const hasItems = Array.isArray(snapshot.items) && snapshot.items.length > 0;
  const scalarKeys = Object.keys(snapshot).filter((k) => k !== "items");
  return (
    <div>
      <div className={`font-semibold mb-1 ${labelClass}`}>{label}</div>
      <div className="space-y-1">
        {scalarKeys.map((k) => {
          const val = snapshot[k];
          const display =
            val === null || val === undefined || val === ""
              ? "—"
              : typeof val === "number" && (k === "total" || k === "subtotal")
              ? `${fmtMoney(val)} ฿`
              : String(val);
          return (
            <div key={k}>
              <span className="text-muted">{FIELD_LABELS[k] ?? k}:</span>{" "}
              <span className="font-mono">{display}</span>
            </div>
          );
        })}
      </div>
      {hasItems && (
        <div className="mt-2">
          <ItemTable items={snapshot.items!} />
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: Log }) {
  const [open, setOpen] = useState(false);
  const diff = parseChanges(log.changes);
  const isCn = log.logType === "cn";
  const borderCls = isCn ? "border border-orange-200 rounded-lg" : "border border-border rounded-lg";
  const btnCls = isCn
    ? "w-full flex items-center gap-2 p-3 text-left hover:bg-orange-50"
    : "w-full flex items-center gap-2 p-3 text-left hover:bg-brand-50";
  return (
    <div className={borderCls}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={btnCls}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {isCn && <span className="inline-block text-[10px] bg-orange-100 text-orange-700 border border-orange-300 px-1.5 py-0.5 rounded-full font-semibold mr-1.5">ใบลดหนี้</span>}
            {log.summary}
          </div>
          <div className="text-xs text-muted">
            {new Date(log.created_at).toLocaleString("th-TH")} · โดย{" "}
            {log.editor_name}
          </div>
        </div>
      </button>
      {open && diff && (
        <div className="p-3 border-t border-border bg-brand-50/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <SnapshotPanel snapshot={diff.before} label="ก่อน" labelClass="text-muted" />
            <SnapshotPanel snapshot={diff.after} label="หลัง" labelClass="text-brand-700" />
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
        ประวัติการแก้ไข Quotation
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
