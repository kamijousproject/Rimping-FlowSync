import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export async function saveUpload(
  category: "slips" | "signed" | "customer-files",
  file: File
): Promise<string> {
  const dir = path.join(BASE, category);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.name) || ".bin";
  const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const full = path.join(dir, safe);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(full, buf);
  return `/api/files/${category}/${safe}`;
}

export async function readUpload(
  category: string,
  name: string
): Promise<{ buf: Buffer; mime: string } | null> {
  if (!/^[\w.-]+$/.test(name)) return null;
  if (!["slips", "signed", "customer-files"].includes(category)) return null;
  const full = path.join(BASE, category, name);
  try {
    const buf = await fs.readFile(full);
    const ext = path.extname(name).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".pdf"
        ? "application/pdf"
        : "application/octet-stream";
    return { buf, mime };
  } catch {
    return null;
  }
}
