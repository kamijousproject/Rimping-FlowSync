"use client";
import { useState, useEffect } from "react";

type Log = {
  id: number;
  editor_name: string;
  summary: string;
  changes: string;
  created_at: string;
};

type LogsResponse = {
  logs: Log[];
  total: number;
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

// Pagination component
function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        ก่อนหน้า
      </button>
      
      {start > 1 && (
        <>
          <button
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            onClick={() => onPageChange(1)}
          >
            1
          </button>
          {start > 2 && <span className="px-2 text-gray-400">...</span>}
        </>
      )}
      
      {pages.map(page => (
        <button
          key={page}
          className={`px-3 py-1 text-sm border rounded hover:bg-gray-50 ${
            page === currentPage ? 'bg-brand-500 text-white border-brand-500' : ''
          }`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
          <button
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            onClick={() => onPageChange(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}
      
      <button
        className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        ถัดไป
      </button>
    </div>
  );
}

export function CustomerEditLogsSection({ customerId }: { customerId: number }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const limit = 5;

  const fetchLogs = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/logs?page=${page}&limit=${limit}`);
      const data: LogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(currentPage);
  }, [customerId, currentPage]);

  const totalPages = Math.ceil(total / limit);

  if (loading && currentPage === 1) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold mb-2">ประวัติการแก้ไข</h3>
        <p className="text-sm text-muted">กำลังโหลด...</p>
      </div>
    );
  }

  if (!logs.length && !loading) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold mb-2">ประวัติการแก้ไข</h3>
        <p className="text-sm text-muted">ยังไม่มีประวัติการแก้ไข</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3">
        ประวัติการแก้ไข ({total.toLocaleString()} รายการ)
      </h3>
      
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

      {loading && (
        <div className="text-center py-2 text-sm text-muted">
          กำลังโหลด...
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
