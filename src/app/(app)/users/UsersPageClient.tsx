"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ChevronDown, ChevronUp, Pencil, Trash2, ShieldCheck, ShieldOff } from "lucide-react";

type User = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role: string;
  created_at: Date;
  temp_role: string | null;
  temp_expires_at: string | null;
  temp_granted_by_name: string | null;
};

const TEMP_DAYS_OPTIONS = [
  { label: "1 วัน", value: 1 },
  { label: "3 วัน", value: 3 },
  { label: "7 วัน", value: 7 },
  { label: "14 วัน", value: 14 },
  { label: "30 วัน", value: 30 },
  { label: "60 วัน", value: 60 },
  { label: "90 วัน", value: 90 },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
};

const ROLE_CLASS: Record<string, string> = {
  super_admin: "bg-brand-100 text-brand-800",
  admin: "bg-gray-100 text-gray-700",
};

const EMPTY_CREATE = { full_name: "", username: "", email: "", password: "", role: "admin" as "admin" | "super_admin" };
const EMPTY_EDIT = { full_name: "", email: "", role: "admin" as "admin" | "super_admin", password: "" };

export function UsersPageClient({ users: initialUsers, meId }: { users: User[]; meId: number }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_CREATE);
  const [createLoading, setCreateLoading] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  // Delete
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  // Temp role
  const [tempTarget, setTempTarget] = useState<User | null>(null);
  const [tempDays, setTempDays] = useState(7);
  const [tempLoading, setTempLoading] = useState(false);
  const [tempErr, setTempErr] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState<number | null>(null);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateLoading(true);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreateLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setCreateErr(d.error || "สร้างบัญชีไม่สำเร็จ");
      return;
    }
    setCreateOk(true);
    setForm(EMPTY_CREATE);
    setTimeout(() => { setCreateOk(false); setShowForm(false); router.refresh(); }, 1200);
  }

  function openEdit(u: User) {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name, email: u.email, role: u.role as "admin" | "super_admin", password: "" });
    setEditErr(null);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditErr(null);
    setEditLoading(true);
    const payload: Record<string, string> = {
      full_name: editForm.full_name,
      email: editForm.email,
      role: editForm.role,
    };
    if (editForm.password) payload.password = editForm.password;
    const r = await fetch(`/api/auth/users/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setEditErr(d.error || "แก้ไขไม่สำเร็จ");
      return;
    }
    const updated = await r.json();
    setUsers((prev) => prev.map((u) => (u.id === editTarget.id ? { ...u, ...updated } : u)));
    setEditTarget(null);
  }

  async function deleteUser(u: User) {
    if (!confirm(`ยืนยันลบบัญชี "${u.full_name}" (@${u.username})?`)) return;
    setDeleteLoading(u.id);
    const r = await fetch(`/api/auth/users/${u.id}`, { method: "DELETE" });
    setDeleteLoading(null);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "ลบไม่สำเร็จ");
      return;
    }
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
  }

  async function submitTempRole(e: React.FormEvent) {
    e.preventDefault();
    if (!tempTarget) return;
    setTempErr(null);
    setTempLoading(true);
    const r = await fetch(`/api/auth/users/${tempTarget.id}/temp-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: tempDays }),
    });
    setTempLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setTempErr(d.error || "ให้สิทธิ์ไม่สำเร็จ");
      return;
    }
    const d = await r.json();
    setUsers((prev) =>
      prev.map((u) =>
        u.id === tempTarget.id
          ? { ...u, temp_role: "super_admin", temp_expires_at: d.expires_at, temp_granted_by_name: "คุณ" }
          : u
      )
    );
    setTempTarget(null);
  }

  async function revokeTemp(u: User) {
    if (!confirm(`ยืนยันถอนสิทธิ์ชั่วคราวของ "${u.full_name}"?`)) return;
    setRevokeLoading(u.id);
    const r = await fetch(`/api/auth/users/${u.id}/temp-role`, { method: "DELETE" });
    setRevokeLoading(null);
    if (!r.ok) { alert("ถอนสิทธิ์ไม่สำเร็จ"); return; }
    setUsers((prev) =>
      prev.map((x) =>
        x.id === u.id ? { ...x, temp_role: null, temp_expires_at: null, temp_granted_by_name: null } : x
      )
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">ผู้ใช้ในระบบ</h1>
          <p className="text-sm text-muted">{users.length} บัญชี</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setCreateErr(null); setCreateOk(false); }}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          สร้างผู้ใช้ใหม่
          {showForm ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="font-semibold text-brand-800 mb-4">สร้างบัญชีผู้ใช้ใหม่</h2>
          <form onSubmit={submitCreate} className="space-y-3">
            <div>
              <label className="label">ชื่อ-นามสกุล</label>
              <input
                className="input"
                required
                placeholder="เช่น สมชาย ใจดี (จะแสดงในช่องเซ็นชื่อบนเอกสาร PO และ Invoice)"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Username</label>
                <input className="input" required minLength={3} value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
                <input type="password" className="input" required minLength={6} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="label">สิทธิ์การใช้งาน</label>
                <select className="input" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "super_admin" })}>
                  <option value="admin">Admin — ใช้งานทั่วไป</option>
                  <option value="super_admin">Super Admin — จัดการลูกค้าและระบบ</option>
                </select>
              </div>
            </div>
            {createErr && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createErr}</div>}
            {createOk && <div className="text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">สร้างบัญชีสำเร็จ</div>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setCreateErr(null); }} className="btn-secondary">ยกเลิก</button>
              <button className="btn-primary" disabled={createLoading}>{createLoading ? "กำลังบันทึก..." : "สร้างบัญชี"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted bg-brand-50">
            <tr>
              <th className="text-left p-3">ชื่อ-นามสกุล</th>
              <th className="text-left p-3">Username</th>
              <th className="text-left p-3">Email</th>
              <th className="text-center p-3">สิทธิ์</th>
              <th className="text-center p-3">สิทธิ์ชั่วคราว</th>
              <th className="text-left p-3">สร้างเมื่อ</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-t ${u.id === meId ? "bg-brand-50/50" : "hover:bg-brand-50/30"}`}>
                <td className="p-3">
                  <div className="font-medium">{u.full_name}</div>
                  {u.id === meId && <div className="text-[10px] text-brand-600 font-medium">● บัญชีของคุณ</div>}
                </td>
                <td className="p-3 text-muted font-mono text-xs">@{u.username}</td>
                <td className="p-3 text-muted text-xs">{u.email || "—"}</td>
                <td className="p-3 text-center">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_CLASS[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {u.role === "super_admin" ? (
                    <span className="text-[11px] text-muted">—</span>
                  ) : u.temp_role ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Super Admin (ชั่วคราว)
                      </span>
                      <span className="text-[10px] text-muted">
                        หมด {new Date(u.temp_expires_at!).toLocaleDateString("th-TH")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted">ไม่มี</span>
                  )}
                </td>
                <td className="p-3 text-xs text-muted">{new Date(u.created_at).toLocaleDateString("th-TH")}</td>
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-1.5 rounded hover:bg-brand-50 text-muted hover:text-brand-700"
                      title="แก้ไข"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== meId && u.role !== "super_admin" && (
                      u.temp_role ? (
                        <button
                          onClick={() => revokeTemp(u)}
                          disabled={revokeLoading === u.id}
                          className="p-1.5 rounded hover:bg-amber-50 text-muted hover:text-amber-700"
                          title="ถอนสิทธิ์ชั่วคราว"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setTempTarget(u); setTempDays(7); setTempErr(null); }}
                          className="p-1.5 rounded hover:bg-brand-50 text-muted hover:text-brand-700"
                          title="ให้สิทธิ์ชั่วคราว"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                    {u.id !== meId && (
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={deleteLoading === u.id}
                        className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600"
                        title="ลบ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Temp role modal */}
      {tempTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="text-lg font-semibold">ให้สิทธิ์ชั่วคราว</h2>
            </div>
            <p className="text-sm text-muted">
              ให้สิทธิ์ <span className="font-medium text-brand-800">Super Admin</span> ชั่วคราวแก่{" "}
              <span className="font-medium">{tempTarget.full_name}</span> (@{tempTarget.username})
            </p>
            <form onSubmit={submitTempRole} className="space-y-3">
              <div>
                <label className="label">ระยะเวลาที่ให้สิทธิ์</label>
                <select
                  className="input"
                  value={tempDays}
                  onChange={(e) => setTempDays(Number(e.target.value))}
                >
                  {TEMP_DAYS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                สิทธิ์จะหมดอายุใน {tempDays} วัน นับจากวันนี้ และสามารถถอนได้ทุกเมื่อ
              </div>
              {tempErr && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{tempErr}</div>}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setTempTarget(null)} className="btn-secondary">ยกเลิก</button>
                <button className="btn-primary bg-amber-600 hover:bg-amber-700" disabled={tempLoading}>
                  {tempLoading ? "กำลังบันทึก..." : "ยืนยันให้สิทธิ์"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-brand-800">แก้ไขบัญชี @{editTarget.username}</h2>
            <form onSubmit={submitEdit} className="space-y-3">
              <div>
                <label className="label">ชื่อ-นามสกุล</label>
                <input className="input" required value={editForm.full_name}
                  placeholder="จะแสดงในช่องเซ็นชื่อบนเอกสาร"
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" required value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className="label">สิทธิ์การใช้งาน</label>
                <select className="input" value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "admin" | "super_admin" })}>
                  <option value="admin">Admin — ใช้งานทั่วไป</option>
                  <option value="super_admin">Super Admin — จัดการลูกค้าและระบบ</option>
                </select>
              </div>
              <div>
                <label className="label">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
                <input type="password" className="input" minLength={6} value={editForm.password}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
              </div>
              {editErr && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editErr}</div>}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary">ยกเลิก</button>
                <button className="btn-primary" disabled={editLoading}>{editLoading ? "กำลังบันทึก..." : "บันทึก"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
