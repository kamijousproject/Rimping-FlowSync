import { NextResponse } from "next/server";
import { requireUser } from "../../../_helpers";
import { readUpload } from "@/backend/upload";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ category: string; name: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const { category, name } = await ctx.params;
  const f = await readUpload(category, name);
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(f.buf), {
    headers: { "Content-Type": f.mime },
  });
}
