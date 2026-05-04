import { NextResponse } from "next/server";
import { requireUser } from "../_helpers";
import { searchProducts } from "@/backend/services/products";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 1) {
    return NextResponse.json({ products: [] });
  }

  const products = await searchProducts(q, 30);
  return NextResponse.json({ products });
}
