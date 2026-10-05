"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

/** เลขที่เอกสาร/อ้างอิง ที่กรอกเอง (ลูกค้ากลุ่ม เช่น 7-11) — แสดง + แก้ไขได้ */
export function DocRefEditor({
  poId,
  docNumber,
  docReference,
}: {
  poId: number;
  docNumber: string | null;
  docReference: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [num, setNum] = useState(docNumber ?? "");
  const [ref, setRef] = useState(docReference ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!num.trim() || !ref.trim()) {
      setErr("กรุณากรอกให้ครบทั้ง 2 ช่อง");
      return;
    }
    setSaving(true);
    setErr(null);
    const r = await fetch(`/api/po/${poId}/doc-ref`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_number: num.trim(), doc_reference: ref.trim() }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "บันทึกไม่สำเร็จ");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="text-sm flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
        <span>
          <span className="text-muted">เลขที่เอกสาร:</span>{" "}
          <span className="font-mono font-semibold">{docNumber || "-"}</span>
        </span>
        <span>
          <span className="text-muted">อ้างอิง:</span>{" "}
          <span className="font-mono font-semibold">{docReference || "-"}</span>
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-brand-700 hover:underline inline-flex items-center gap-1"
        >
          <Pencil className="w-3 h-3" />
          {docNumber ? "แก้ไข" : "กรอกเลขที่เอกสาร"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div>
        <label className="label text-xs">เลขที่เอกสาร</label>
        <input className="input text-sm w-44" value={num} onChange={(e) => setNum(e.target.value)} />
      </div>
      <div>
        <label className="label text-xs">อ้างอิง</label>
        <input className="input text-sm w-44" value={ref} onChange={(e) => setRef(e.target.value)} />
      </div>
      <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm">
        {saving ? "กำลังบันทึก..." : "บันทึก"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setNum(docNumber ?? "");
          setRef(docReference ?? "");
          setErr(null);
        }}
        className="btn-secondary text-sm"
      >
        ยกเลิก
      </button>
      {err && <div className="w-full text-xs text-red-600">{err}</div>}
    </div>
  );
}
