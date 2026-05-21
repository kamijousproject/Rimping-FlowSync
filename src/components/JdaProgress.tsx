"use client";

export type JdaPollData = {
  status: "pending" | "success" | "not_triggered" | "error";
  step?: string;
  step_label?: string;
  progress?: number;
  remaining_seconds?: number;
  jda_po_number?: string;
};

function fmtRemaining(sec: number): string {
  if (sec <= 0) return "เกือบเสร็จแล้ว...";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `ประมาณ ${m} นาที ${s > 0 ? `${s} วินาที` : ""}`;
  return `ประมาณ ${s} วินาที`;
}

export function JdaProgressBar({ data }: { data: JdaPollData }) {
  const pct = data.progress ?? 0;

  return (
    <div className="space-y-2">
      {/* Step label */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-amber-800 font-medium">{data.step_label ?? "กำลังดำเนินการ..."}</span>
        <span className="text-muted">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-amber-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Time remaining */}
      {data.remaining_seconds !== undefined && (
        <div className="text-[11px] text-muted">{fmtRemaining(data.remaining_seconds)}</div>
      )}
    </div>
  );
}
