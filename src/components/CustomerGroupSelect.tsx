"use client";
import { useEffect, useState } from "react";

type Group = { id: number; name: string; member_count: number };

// เลือกกลุ่มลูกค้า (เช่น 7-11) — ว่าง = ลูกค้าเดี่ยว, สร้างกลุ่มใหม่ได้ในตัว
export function CustomerGroupSelect({
  value,
  onChange,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/customer-groups");
    if (r.ok) setGroups((await r.json()).groups || []);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function addGroup() {
    const name = window.prompt("ชื่อกลุ่มลูกค้าใหม่")?.trim();
    if (!name) return;
    setErr(null);
    const r = await fetch("/api/customer-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(d.error || "สร้างกลุ่มไม่สำเร็จ");
      return;
    }
    await load();
    onChange(d.id);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label">กลุ่มลูกค้า</label>
        <button type="button" onClick={addGroup} className="text-xs text-brand-700 hover:underline">
          + สร้างกลุ่มใหม่
        </button>
      </div>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
      >
        <option value="">— ไม่มี (ลูกค้าเดี่ยว) —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.member_count} ร้าน)
          </option>
        ))}
      </select>
      {err && <p className="text-xs text-danger mt-1">{err}</p>}
    </div>
  );
}
