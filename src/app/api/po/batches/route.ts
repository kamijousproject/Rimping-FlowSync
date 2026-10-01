import { NextResponse } from "next/server";
import { requireUser, serverError } from "../../_helpers";
import { listPoBatches } from "@/backend/services/po";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  try {
    const batches = await listPoBatches();
    return NextResponse.json({ batches });
  } catch (e) {
    return serverError(e);
  }
}
