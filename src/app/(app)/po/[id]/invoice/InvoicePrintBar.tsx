"use client";
import { Printer, Download } from "lucide-react";
import { useEffect, useState } from "react";

interface InvoicePrintBarProps {
  invoiceId?: number;
}

export function InvoicePrintBar({ invoiceId }: InvoicePrintBarProps) {
  const [downloadCount, setDownloadCount] = useState<number | null>(null);

  // Fetch download count on mount
  useEffect(() => {
    if (invoiceId) {
      fetch(`/api/invoices/${invoiceId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.invoice) {
            setDownloadCount(data.invoice.download_count || 0);
          }
        })
        .catch(() => {});
    }
  }, [invoiceId]);

  const handlePrint = async () => {
    // Log the print/download action
    if (invoiceId) {
      try {
        await fetch(`/api/invoices/${invoiceId}/logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "downloaded" }),
        });
        // Update local count
        setDownloadCount((prev) => (prev !== null ? prev + 1 : 1));
      } catch (e) {
        console.error("Failed to log download:", e);
      }
    }
    window.print();
  };

  return (
    <div className="flex items-center justify-between mb-4 print:hidden">
      <button
        onClick={() => history.back()}
        className="btn-secondary text-sm"
      >
        ← กลับ
      </button>
      <div className="flex items-center gap-3">
        {downloadCount !== null && downloadCount > 0 && (
          <span className="text-xs text-muted">
            ดาวน์โหลดแล้ว {downloadCount} ครั้ง
          </span>
        )}
        <button onClick={handlePrint} className="btn-primary text-sm">
          <Printer className="w-4 h-4" />
          พิมพ์ / บันทึก PDF
        </button>
      </div>
    </div>
  );
}
