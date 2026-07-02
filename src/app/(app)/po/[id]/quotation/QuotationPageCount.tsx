"use client";
import { useEffect, useState } from "react";

// A4 printable area with the 12mm @page margins defined in globals.css.
const PX_PER_MM = 96 / 25.4;
const PAGE_CONTENT_W = (210 - 24) * PX_PER_MM; // A4 width minus L/R margins
const PAGE_CONTENT_H = (297 - 24) * PX_PER_MM; // A4 height minus T/B margins

/**
 * Estimates how many A4 pages the quotation document will span when printed
 * and renders a "เอกสารทั้งหมด N หน้า" indicator. The count is measured off an
 * off-screen clone sized to the real print width so the estimate matches the
 * printed output as closely as possible.
 */
export function QuotationPageCount() {
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const measure = () => {
      const doc = document.getElementById("quotation-doc");
      if (!doc) return;

      const clone = doc.cloneNode(true) as HTMLElement;
      // Strip the on-screen chrome so the clone matches the print box.
      clone.style.position = "absolute";
      clone.style.left = "-99999px";
      clone.style.top = "0";
      clone.style.visibility = "hidden";
      clone.style.width = `${PAGE_CONTENT_W}px`;
      clone.style.maxWidth = "none";
      clone.style.padding = "0";
      clone.style.border = "0";
      clone.style.boxShadow = "none";
      document.body.appendChild(clone);
      const height = clone.scrollHeight;
      document.body.removeChild(clone);

      setPages(Math.max(1, Math.ceil(height / PAGE_CONTENT_H)));
    };

    // Fonts affect line height, so wait for them before measuring.
    if (document.fonts?.ready) {
      document.fonts.ready.then(measure);
    } else {
      measure();
    }
    window.addEventListener("resize", measure);
    window.addEventListener("beforeprint", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("beforeprint", measure);
    };
  }, []);

  return (
    <div className="text-xs text-muted mt-1">
      เอกสารทั้งหมด <span className="font-semibold text-foreground">{pages}</span> หน้า
    </div>
  );
}
