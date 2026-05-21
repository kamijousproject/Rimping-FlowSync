import { NextResponse } from "next/server";
import { requireUser, badRequest, serverError } from "../../_helpers";
import { checkStockAvailability, checkMultipleStockAvailability } from "@/backend/services/inventory";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("body ไม่ถูกต้อง");
    
    const { sku, quantity, items, store = 500 } = body;
    
    // ตรวจสอบ stock สำหรับ SKU เดียว
    if (sku && quantity) {
      if (typeof sku !== "string" || typeof quantity !== "number" || quantity <= 0) {
        return badRequest("sku ต้องเป็น string และ quantity ต้องเป็น number > 0");
      }
      
      const result = await checkStockAvailability(sku, quantity, store);
      return NextResponse.json(result);
    }
    
    // ตรวจสอบ stock สำหรับหลายรายการ
    if (items && Array.isArray(items)) {
      const validItems = items.filter(item => 
        item.sku && typeof item.sku === "string" && 
        item.quantity && typeof item.quantity === "number" && item.quantity > 0
      );
      
      if (validItems.length === 0) {
        return badRequest("items ต้องเป็น array ที่มี sku (string) และ quantity (number > 0)");
      }
      
      const results = await checkMultipleStockAvailability(validItems, store);
      return NextResponse.json({ items: results });
    }
    
    return badRequest("ต้องระบุ sku และ quantity หรือ items array");
    
  } catch (e) {
    return serverError(e);
  }
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  
  try {
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get("sku");
    const quantity = parseInt(searchParams.get("quantity") || "0");
    const store = parseInt(searchParams.get("store") || "500");
    
    if (!sku || quantity <= 0) {
      return badRequest("ต้องระบุ sku และ quantity > 0");
    }
    
    const result = await checkStockAvailability(sku, quantity, store);
    return NextResponse.json(result);
    
  } catch (e) {
    return serverError(e);
  }
}
