"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function DateRangeFilter() {
  const router = useRouter();
  const sp = useSearchParams();

  const startDate = sp.get("start_date") ?? "";
  const endDate = sp.get("end_date") ?? "";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/po?${params.toString()}`);
    },
    [router, sp]
  );

  const clear = useCallback(() => {
    const params = new URLSearchParams(sp.toString());
    params.delete("start_date");
    params.delete("end_date");
    router.push(`/po?${params.toString()}`);
  }, [router, sp]);

  const hasDate = startDate || endDate;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted shrink-0">วันที่:</span>
      <input
        type="date"
        value={startDate}
        onChange={(e) => update("start_date", e.target.value)}
        className="text-xs border border-brand-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-foreground"
        placeholder="เริ่มต้น"
      />
      <span className="text-xs text-muted">—</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => update("end_date", e.target.value)}
        className="text-xs border border-brand-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-foreground"
        placeholder="สิ้นสุด"
      />
      {hasDate && (
        <button
          onClick={clear}
          className="text-xs text-red-500 hover:text-red-700 underline shrink-0"
        >
          ล้าง
        </button>
      )}
    </div>
  );
}
