"use client";
import { useState } from "react";

type Log = {
  id: number;
  editor_name: string;
  summary: string;
  changes: string;
  created_at: string;
};

function DiffView({ changes }: { changes: string }) {
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(changes); } catch { return null; }

  if (data.type === "credit_limit_adjustment") {
    return (
      <div className="text-xs space-y-1 mt-2">
        <div className="flex gap-4">
          <span className="text-muted">วงเงินเดิม:</span>
          <span className="font-medium">{Number(Number(data.old_limit)).toLocaleString()} บาท</span>
        </div>
        <div className="flex gap-4">
          <span className="text-muted">วงเงินใหม่:</span>
          <span className="font-medium text-brand-700">{Number(Number(data.new_limit)).toLocaleString()} บาท</span>
        </div>
        {data.reason ? (
          <div className="flex gap-4">
            <span className="text-muted">เหตุผล:</span>
            <span>{String(data.reason)}</span>
          </div>
        ) : null}
      </div>
    );
  }

  if (data.type === "temp_credit_limit") {
    return (
      <div className="text-xs space-y-1 mt-2">
        <div className="flex gap-4">
          <span className="text-muted">วงเงินเพิ่มเติม:</span>
          <span className="font-medium">+{Number(Number(data.extra_amount)).toLocaleString()} บาท</span>
        </div>
        <div className="flex gap-4">
          <span className="text-muted">ช่วงเวลา:</span>
          <span>{String(data.start_date)} ถึง {String(data.end_date)}</span>
        </div>
        {data.reason ? (
          <div className="flex gap-4">
            <span className="text-muted">เหตุผล:</span>
            <span>{String(data.reason)}</span>
          </div>
        ) : null}
      </div>
    );
  }

  const before = data.before as Record<string, unknown> | undefined;
  const after = data.after as Record<string, unknown> | undefined;
  if (!before || !after) return null;

  const fields = [
    { key: "name", label: "ชื่อ" },
    { key: "code", label: "รหัส" },
    { key: "contact_person", label: "ผู้ติดต่อ" },
    { key: "phone", label: "โทรศัพท์" },
    { key: "email", label: "Email" },
    { key: "address", label: "ที่อยู่" },
    { key: "default_credit_term_days", label: "เครดิต (วัน)" },
    { key: "credit_score", label: "Credit Score" },
    { key: "credit_score_notes", label: "หมายเหตุ Credit" },
    { key: "notes", label: "หมายเหตุ" },
  ] as const;

  const changed = fields.filter((f) => String(before[f.key] ?? "") !== String(after[f.key] ?? ""));

  if (!changed.length) return null;

  return (
    <div className="mt-2 text-xs border rounded overflow-hidden">
      <div className="grid grid-cols-3 bg-gray-50 px-3 py-1 text-muted font-medium">
        <span>ฟิลด์</span>
        <span>ก่อน</span>
        <span>หลัง</span>
      </div>
      {changed.map((f) => (
        <div key={f.key} className="grid grid-cols-3 px-3 py-1.5 border-t">
          <span className="text-muted">{f.label}</span>
          <span className="line-through text-red-500 truncate">{String(before[f.key] ?? "—")}</span>
          <span className="text-green-700 truncate">{String(after[f.key] ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}

export function CustomerEditLogsSection({ logs }: { logs: Log[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!logs.length) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold mb-2">ประวัติการแก้ไข</h3>
        <p className="text-sm text-muted">ยังไม่มีประวัติการแก้ไข</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3">ประวัติการแก้ไข ({logs.length})</h3>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-start justify-between px-4 py-2.5 hover:bg-brand-50 text-left"
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{log.summary}</p>
                <p className="text-xs text-muted">
                  {log.editor_name} · {new Date(log.created_at).toLocaleString("th-TH")}
                </p>
              </div>
              <span className="text-muted text-xs ml-2 shrink-0">{expanded === log.id ? "▲" : "▼"}</span>
            </button>
            {expanded === log.id && (
              <div className="px-4 pb-3 bg-gray-50 border-t">
                <DiffView changes={log.changes} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
