"use client";
import { useState } from "react";

type CustomerFile = {
  id: number;
  original_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploader_name: string;
  created_at: string;
};

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/"))
    return <span className="text-2xl">🖼️</span>;
  if (mime === "application/pdf")
    return <span className="text-2xl">📄</span>;
  return <span className="text-2xl">📎</span>;
}

export function CustomerFilesModal({
  customerId,
  initialFiles,
  canDelete,
}: {
  customerId: number;
  initialFiles: CustomerFile[];
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<CustomerFile[]>(initialFiles);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [preview, setPreview] = useState<CustomerFile | null>(null);

  async function deleteFile(id: number) {
    if (!confirm("ลบไฟล์นี้ใช่หรือไม่?")) return;
    setDeleting(id);
    await fetch(`/api/customers/${customerId}/files`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: id }),
    });
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setDeleting(null);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary relative"
      >
        📁 ไฟล์ประกอบ
        {files.length > 0 && (
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white text-xs">
            {files.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => { setOpen(false); setPreview(null); }}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="font-bold text-brand-800 text-lg">ไฟล์ประกอบลูกค้า</h2>
            <button
              onClick={() => { setOpen(false); setPreview(null); }}
              className="text-muted hover:text-foreground text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-4 space-y-2">
            {files.length === 0 && (
              <p className="text-center text-muted py-8">ยังไม่มีไฟล์</p>
            )}
            {files.map((f) => (
              <div key={f.id} className="border rounded-lg p-3 flex items-start gap-3 hover:bg-brand-50">
                <div className="shrink-0 mt-0.5">
                  {f.mime_type.startsWith("image/") ? (
                    <img
                      src={f.file_path}
                      alt={f.original_name}
                      className="w-12 h-12 object-cover rounded cursor-pointer border"
                      onClick={() => setPreview(f)}
                    />
                  ) : (
                    <div
                      className="w-12 h-12 flex items-center justify-center bg-brand-50 rounded border cursor-pointer"
                      onClick={() => setPreview(f)}
                    >
                      <FileIcon mime={f.mime_type} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.original_name}</p>
                  <p className="text-xs text-muted">
                    {(f.file_size / 1024).toFixed(0)} KB · {f.uploader_name} ·{" "}
                    {new Date(f.created_at).toLocaleDateString("th-TH")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a
                    href={f.file_path}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs btn-secondary py-1 px-2"
                  >
                    เปิด
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => deleteFile(f.id)}
                      disabled={deleting === f.id}
                      className="text-xs text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1 disabled:opacity-50"
                    >
                      {deleting === f.id ? "..." : "ลบ"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {preview && preview.mime_type.startsWith("image/") && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview.file_path}
            alt={preview.original_name}
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
