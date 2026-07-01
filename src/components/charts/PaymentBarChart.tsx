"use client";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const COLORS: Record<string, string> = {
  unpaid: "#DC2626",
  partial: "#F59E0B",
  paid: "#16A34A",
};

export function PaymentBarChart({
  items,
}: {
  items: { key: string; label: string; count: number }[];
}) {
  const chartData = {
    labels: items.map((i) => i.label),
    datasets: [
      {
        data: items.map((i) => i.count),
        backgroundColor: items.map((i) => COLORS[i.key] || "#9CA3AF"),
        borderRadius: 6,
        barThickness: 20,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
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
    scales: {
      x: {
        beginAtZero: true,
        ticks: { precision: 0, font: { family: "Inter", size: 11 } },
        grid: { color: "#F3F4F6" },
      },
      y: {
        grid: { display: false },
        ticks: { font: { family: "Inter", size: 12 } },
      },
    },
  };

  return (
    <div className="h-[160px]">
      <Bar data={chartData} options={options} />
    </div>
  );
}
