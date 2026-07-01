"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const BE_OFFSET = 543;

function parseIso(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function formatIso(y: number, m: number, d: number) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatThaiDisplay(value: string) {
  const parsed = parseIso(value);
  if (!parsed) return "";
  return `${parsed.d} ${THAI_MONTHS[parsed.m - 1]} ${parsed.y + BE_OFFSET}`;
}

/**
 * Drop-in replacement for <input type="date">: displays Thai month names + พ.ศ.
 * but value/onChange still carry plain ISO (ค.ศ.) "YYYY-MM-DD" strings, so
 * storage/API/backend contracts are unchanged.
 */
export function ThaiDateInput({
  value,
  onChange,
  className = "",
  placeholder = "เลือกวันที่",
  disabled = false,
  readOnly = false,
  id,
}: {
  value: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const parsed = parseIso(value);
  const today = new Date();
  const [viewY, setViewY] = useState(parsed?.y ?? today.getFullYear());
  const [viewM, setViewM] = useState(parsed?.m ?? today.getMonth() + 1);

  useEffect(() => {
    if (parsed) {
      setViewY(parsed.y);
      setViewM(parsed.m);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const isInert = disabled || readOnly;

  function selectDay(d: number) {
    onChange?.({ target: { value: formatIso(viewY, viewM, d) } });
    setOpen(false);
  }

  function selectToday() {
    const t = new Date();
    onChange?.({ target: { value: formatIso(t.getFullYear(), t.getMonth() + 1, t.getDate()) } });
    setViewY(t.getFullYear());
    setViewM(t.getMonth() + 1);
    setOpen(false);
  }

  function clearDate() {
    onChange?.({ target: { value: "" } });
    setOpen(false);
  }

  function prevMonth() {
    if (viewM === 1) {
      setViewM(12);
      setViewY(viewY - 1);
    } else {
      setViewM(viewM - 1);
    }
  }

  function nextMonth() {
    if (viewM === 12) {
      setViewM(1);
      setViewY(viewY + 1);
    } else {
      setViewM(viewM + 1);
    }
  }

  const daysInMonth = new Date(viewY, viewM, 0).getDate();
  const firstWeekday = new Date(viewY, viewM - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const yearOptions: number[] = [];
  const baseYear = parsed?.y ?? today.getFullYear();
  for (let y = baseYear - 10; y <= baseYear + 10; y++) yearOptions.push(y);

  const display = formatThaiDisplay(value);

  return (
    <div className="relative" ref={ref}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !isInert && setOpen((v) => !v)}
        className={`${className} text-left inline-flex items-center justify-between gap-2 ${isInert ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={display ? "" : "text-gray-400"}>{display || placeholder}</span>
        <CalendarIcon className="w-3.5 h-3.5 text-muted shrink-0" />
      </button>

      {open && !isInert && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-white shadow-lg p-3">
          <div className="flex items-center gap-1 mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-gray-100 text-muted hover:text-foreground shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={viewM}
              onChange={(e) => setViewM(Number(e.target.value))}
              className="flex-1 text-sm rounded-lg border border-border px-1.5 py-1 bg-white outline-none focus:border-brand-500"
            >
              {THAI_MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={viewY}
              onChange={(e) => setViewY(Number(e.target.value))}
              className="text-sm rounded-lg border border-border px-1.5 py-1 bg-white outline-none focus:border-brand-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y + BE_OFFSET}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-gray-100 text-muted hover:text-foreground shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted mb-1">
            {THAI_DAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const isSelected = !!d && !!parsed && parsed.y === viewY && parsed.m === viewM && parsed.d === d;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!d}
                  onClick={() => d && selectDay(d)}
                  className={`h-7 w-7 rounded-lg text-xs flex items-center justify-center transition ${
                    !d
                      ? "invisible"
                      : isSelected
                      ? "bg-brand-600 text-white font-medium"
                      : "hover:bg-brand-50 text-foreground"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border">
            <button
              type="button"
              onClick={clearDate}
              className="text-xs text-muted hover:text-danger transition"
            >
              ล้าง
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="text-xs text-brand-700 hover:text-brand-800 font-medium transition"
            >
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
