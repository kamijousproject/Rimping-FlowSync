"use client";
import { useEffect, useState } from "react";
import { Search, X, Check, Loader2, PackageSearch } from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";

export type ProductHit = {
  id: number;
  sku: string;
  upc: string | null;
  description: string;
  current_price: number;
  dept: string | null;
  vendor_name: string | null;
};

/**
 * Product picker for the ค้นหาเมนูสินค้า page. Results render as a card grid
 * (rather than the narrow inline dropdown used on /po/new) so many products are
 * visible at once. Multi-select, then "เพิ่ม" pushes the picks back as rows.
 *
 * Mounted only while open — unmounting resets search/selection state for free.
 */
export function ProductPickerModal({
  existingSkus,
  onClose,
  onAdd,
}: {
  existingSkus: string[];
  onClose: () => void;
  onAdd: (products: ProductHit[]) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ProductHit[]>([]);

  const term = q.trim();

  // Debounced search. State only changes inside the async callback, never
  // synchronously in the effect body.
  useEffect(() => {
    if (!term) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products?q=${encodeURIComponent(term)}`);
        if (cancelled) return;
        const d = r.ok ? await r.json() : { products: [] };
        if (!cancelled) setHits(d.products ?? []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onQueryChange(v: string) {
    setQ(v);
    const t = v.trim();
    setLoading(Boolean(t));
    if (!t) setHits([]);
  }

  function toggle(p: ProductHit) {
    setSelected((prev) =>
      prev.some((s) => s.id === p.id)
        ? prev.filter((s) => s.id !== p.id)
        : [...prev, p]
    );
  }

  const isSelected = (p: ProductHit) => selected.some((s) => s.id === p.id);
  const isAdded = (p: ProductHit) => existingSkus.includes(p.sku);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <PackageSearch className="w-[18px] h-[18px] text-brand-600" />
            เพิ่มสินค้า
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground hover:bg-gray-100 rounded-lg p-1.5 transition"
            aria-label="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
            <input
              autoFocus
              className="w-full h-12 rounded-xl border border-border bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="ค้น SKU / UPC / ชื่อสินค้า..."
              value={q}
              autoComplete="off"
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[240px]">
          {!term ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <PackageSearch className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-muted mt-3">พิมพ์เพื่อค้นหาสินค้า</p>
              <p className="text-xs text-muted mt-1">
                ค้นได้ด้วย SKU, บาร์โค้ด (UPC) หรือชื่อสินค้า
              </p>
            </div>
          ) : loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
              <p className="text-sm text-muted mt-3">กำลังค้นหา...</p>
            </div>
          ) : hits.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <p className="text-sm text-muted">ไม่พบสินค้าที่ตรงกับ “{term}”</p>
              <p className="text-xs text-muted mt-1">ลองค้นด้วย SKU, UPC หรือชื่ออื่น</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {hits.map((p) => {
                const added = isAdded(p);
                const sel = isSelected(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={added}
                    onClick={() => toggle(p)}
                    className={`relative text-left rounded-xl border p-3.5 transition ${
                      added
                        ? "border-border bg-gray-50 opacity-60 cursor-default"
                        : sel
                          ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-100"
                          : "border-border bg-white hover:border-brand-300 hover:bg-brand-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-brand-800 break-all">
                        {p.sku}
                      </span>
                      {added ? (
                        <span className="shrink-0 text-[10px] font-medium text-muted bg-gray-200 rounded-full px-2 py-0.5">
                          เพิ่มแล้ว
                        </span>
                      ) : (
                        <span
                          className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition ${
                            sel
                              ? "bg-brand-600 border-brand-600 text-white"
                              : "border-border bg-white"
                          }`}
                        >
                          {sel && <Check className="w-3 h-3" />}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-foreground mt-1.5 line-clamp-2 min-h-[2.5rem]">
                      {p.description}
                    </p>

                    {(p.upc || p.dept) && (
                      <p className="text-[10px] text-muted mt-1 truncate">
                        {p.upc ? `UPC ${p.upc}` : ""}
                        {p.upc && p.dept ? " · " : ""}
                        {p.dept ?? ""}
                        {p.dept && p.vendor_name ? ` · ${p.vendor_name}` : ""}
                      </p>
                    )}

                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 text-right">
                      <span className="text-base font-semibold text-brand-700">
                        {fmtMoney(p.current_price)}
                      </span>
                      <span className="text-xs text-muted ml-1">บาท</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-gray-50 shrink-0">
          <p className="text-sm text-muted">
            {selected.length > 0 ? (
              <>
                เลือกแล้ว{" "}
                <span className="font-semibold text-foreground">
                  {selected.length}
                </span>{" "}
                รายการ
              </>
            ) : (
              "ยังไม่ได้เลือกสินค้า"
            )}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => onAdd(selected)}
              disabled={selected.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              เพิ่ม{selected.length > 0 ? ` ${selected.length} รายการ` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
