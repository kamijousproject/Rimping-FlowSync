"use client";

import { ArrowLeft, FileText, Info } from "lucide-react";
import Link from "next/link";

export default function NewInvoicePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/invoices"
          className="p-2 hover:bg-brand-50 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          สร้าง Invoice ใหม่
        </h1>
      </div>

      {/* Content */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800 mb-2">
              การสร้าง Invoice
            </h3>
            <p className="text-amber-700 text-sm mb-3">
              ปัจจุบันระบบสร้าง Invoice ได้จากหน้า PO โดยตรง
            </p>
            <div className="space-y-2 text-sm text-amber-600">
              <p>1. ไปที่หน้า &quot;Purchase Orders&quot;</p>
              <p>2. เลือก PO ที่ต้องการออก Invoice</p>
              <p>3. คลิกปุ่ม &quot;ออกใบแจ้งหนี้&quot;</p>
            </div>
            <Link
              href="/po"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition"
            >
              ไปที่หน้า PO
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
