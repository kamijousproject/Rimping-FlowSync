"use client";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";

ChartJS.register(ArcElement, Tooltip);

const COLORS: Record<string, string> = {
  draft: "#9CA3AF",
  confirmed: "#60A5FA",
  packed: "#818CF8",
  checked: "#22D3EE",
  delivered: "#FBBF24",
  received: "#15803D",
  cancelled: "#F87171",
};

export function PoStatusDonut({
  items,
}: {
  items: { key: string; label: string; count: number }[];
}) {
  const total = items.reduce((s, i) => s + i.count, 0);

  const chartData = {
    labels: items.map((i) => i.label),
    datasets: [
      {
        data: items.map((i) => i.count),
        backgroundColor: items.map((i) => COLORS[i.key] || "#9CA3AF"),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    cutout: "72%",
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#111827",
        padding: 8,
        cornerRadius: 8,
        titleFont: { family: "Inter" },
        bodyFont: { family: "Inter" },
      },
    },
  };

  return (
    <div className="relative h-[160px] w-[160px] mx-auto">
      <Doughnut data={chartData} options={options} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-semibold text-foreground">{total}</div>
        <div className="text-xs text-muted">ทั้งหมด</div>
      </div>
    </div>
  );
}
