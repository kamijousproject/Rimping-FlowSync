"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { X } from "lucide-react";
import { ThaiDateInput } from "@/components/ThaiDateInput";

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
      <span className="text-xs text-muted shrink-0">วันที่</span>
      <ThaiDateInput
        value={startDate}
        onChange={(e) => update("start_date", e.target.value)}
        className="h-8 w-[148px] text-xs border border-border rounded-lg px-2.5 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-foreground"
        placeholder="เริ่มต้น"
      />
      <span className="text-xs text-muted">—</span>
      <ThaiDateInput
        value={endDate}
        onChange={(e) => update("end_date", e.target.value)}
        className="h-8 w-[148px] text-xs border border-border rounded-lg px-2.5 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-foreground"
        placeholder="สิ้นสุด"
      />
      {hasDate && (
        <button
          onClick={clear}
          className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-red-50 transition"
          title="ล้างวันที่"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
