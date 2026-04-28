import { NextResponse } from "next/server";
import { requireUser, serverError } from "../_helpers";
import { getDashboardStats, getRecentPos } from "@/backend/services/dashboard";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  try {
    const [stats, recent] = await Promise.all([
      getDashboardStats(),
      getRecentPos(10),
    ]);
    return NextResponse.json({ stats, recent });
  } catch (e) {
    return serverError(e);
  }
}
