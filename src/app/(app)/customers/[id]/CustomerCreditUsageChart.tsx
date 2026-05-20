"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Point = {
  date: string;
  outstanding: number;
  creditLimit: number;
};

type Props = {
  data: Point[];
};

const PERIODS = [
  { label: "1 เดือน", months: 1 },
  { label: "3 เดือน", months: 3 },
  { label: "6 เดือน", months: 6 },
  { label: "12 เดือน", months: 12 },
] as const;

function fmtThb(val: number) {
  if (val >= 1_000_000) return `฿${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `฿${(val / 1_000).toFixed(0)}k`;
  return `฿${val.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function fmtThbFull(val: number) {
  return `฿${val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

type TooltipPayloadEntry = {
  dataKey: string;
  value: number;
  color: string;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const outstanding = payload.find((p) => p.dataKey === "outstanding")?.value ?? 0;
  const creditLimit = payload.find((p) => p.dataKey === "creditLimit")?.value ?? 1;
  const pct = creditLimit > 0 ? ((outstanding / creditLimit) * 100).toFixed(1) : "0.0";
  const overLimit = outstanding > creditLimit;

  return (
    <div className="bg-white border border-border rounded-lg shadow-md px-3 py-2 text-xs space-y-1 min-w-[180px]">
      <p className="font-medium text-foreground border-b border-border pb-1 mb-1">
        {fmtDate(label)}
      </p>
      <div className="flex justify-between gap-4">
        <span className="text-muted">ลูกหนี้คงค้าง</span>
        <span className={`font-semibold ${overLimit ? "text-red-600" : "text-red-500"}`}>
          {fmtThbFull(outstanding)}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">วงเงินสินเชื่อ</span>
        <span className="font-semibold text-brand-700">{fmtThbFull(creditLimit)}</span>
      </div>
      <div className="flex justify-between gap-4 border-t border-border pt-1 mt-1">
        <span className="text-muted">ใช้ไป</span>
        <span className={`font-semibold ${overLimit ? "text-red-600" : Number(pct) > 80 ? "text-amber-600" : "text-brand-700"}`}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

export function CustomerCreditUsageChart({ data }: Props) {
  const [months, setMonths] = useState(6);

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.filter((p) => p.date >= cutoffStr);
  }, [data, months]);

  const hasData = data.length > 1;

  const maxVal = filtered.reduce(
    (m, p) => Math.max(m, p.outstanding, p.creditLimit),
    0
  );
  const yMax = Math.ceil((maxVal * 1.15) / 1000) * 1000 || 1000;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-brand-800">กราฟการใช้วงเงินสินเชื่อ</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.months}
              onClick={() => setMonths(p.months)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                months === p.months
                  ? "bg-brand-700 text-white border-brand-700"
                  : "border-brand-200 text-brand-700 hover:bg-brand-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-40 text-sm text-muted">
          ยังไม่มีข้อมูลการใช้วงเงิน
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={filtered} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="outstandingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e1e8df" vertical={false} />

            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 10, fill: "#6b7d70" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />

            <YAxis
              tickFormatter={fmtThb}
              tick={{ fontSize: 10, fill: "#6b7d70" }}
              tickLine={false}
              axisLine={false}
              domain={[0, yMax]}
              width={52}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              iconType="plainline"
              iconSize={18}
              formatter={(value) =>
                value === "outstanding" ? "ลูกหนี้คงค้าง" : "วงเงินสินเชื่อ"
              }
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />

            {/* Credit limit line (green dashed) — rendered first so outstanding sits on top */}
            <Area
              type="stepAfter"
              dataKey="creditLimit"
              stroke="#2f8b46"
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="none"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />

            {/* Outstanding area */}
            <Area
              type="stepAfter"
              dataKey="outstanding"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#outstandingGrad)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#ef4444" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
