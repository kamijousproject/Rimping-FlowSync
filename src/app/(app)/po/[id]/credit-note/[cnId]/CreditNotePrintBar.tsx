"use client";
import { Printer } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export function CreditNotePrintBar() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/po/${params.id}`);
    }
  }

  return (
    <div className="flex items-center justify-between mb-4 print:hidden">
      <button onClick={goBack} className="btn-secondary text-sm">
        ← กลับ
      </button>
      <button onClick={() => window.print()} className="btn-primary text-sm">
        <Printer className="w-4 h-4" />
        พิมพ์ / บันทึก PDF
      </button>
    </div>
  );
}
