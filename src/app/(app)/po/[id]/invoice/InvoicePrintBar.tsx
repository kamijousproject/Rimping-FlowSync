"use client";
import { Printer } from "lucide-react";

export function InvoicePrintBar() {
  return (
    <div className="flex items-center justify-between mb-4 print:hidden">
      <button
        onClick={() => history.back()}
        className="btn-secondary text-sm"
      >
        ← กลับ
      </button>
      <button onClick={() => window.print()} className="btn-primary text-sm">
        <Printer className="w-4 h-4" />
        พิมพ์ / บันทึก PDF
      </button>
    </div>
  );
}
