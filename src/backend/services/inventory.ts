import { query, exec } from "../db";

export type InventoryItem = {
  id: number;
  store: number;
  sku: string;
  upc: string | null;
  description: string;
  vendor: number | null;
  vendor_name: string | null;
  sc: string | null; // 100 = ราคารวม VAT, 200 = ไม่มี VAT
  on_hand: number;
  on_order: number;
  on_transfer: number;
  in_transit: number;
  hold_qty: number;
  date_last_sold: Date | null;
  synced_at: Date;
};

export async function getInventoryBySKU(sku: string, store: number = 500): Promise<InventoryItem | null> {
  const rows = await query(
    "SELECT * FROM inventory WHERE sku = ? AND store = ?",
    [sku, store]
  );
  return (rows as InventoryItem[])[0] ?? null;
}

export async function getInventoryBySKUs(skus: string[], store: number = 500): Promise<InventoryItem[]> {
  if (skus.length === 0) return [];
  
  const placeholders = skus.map(() => "?").join(",");
  const rows = await query(
    `SELECT * FROM inventory WHERE sku IN (${placeholders}) AND store = ?`,
    [...skus, store]
  );
  return rows as InventoryItem[];
}

/** SKU ที่ไม่มี VAT (sc = 200). SKU ที่ไม่พบใน inventory ถือว่ารวม VAT */
export async function getNonVatSkus(skus: string[], store: number = 500): Promise<Set<string>> {
  const rows = await getInventoryBySKUs(skus, store);
  return new Set(rows.filter((r) => String(r.sc).trim() === "200").map((r) => r.sku));
}

export async function checkStockAvailability(
  sku: string, 
  quantity: number, 
  store: number = 500
): Promise<{ available: boolean; stock: number; message: string }> {
  const inventory = await getInventoryBySKU(sku, store);
  
  if (!inventory) {
    return {
      available: false,
      stock: 0,
      message: `ไม่พบข้อมูลสินค้า ${sku} ในระบบ inventory`
    };
  }
  
  const availableStock = inventory.on_hand;
  
  if (availableStock < 0) {
    return {
      available: false,
      stock: availableStock,
      message: `สินค้า ${sku} มี stock เป็นค่าลบ (${availableStock} ชิ้น) ไม่สามารถสั่งได้`
    };
  }
  
  if (availableStock < quantity) {
    return {
      available: false,
      stock: availableStock,
      message: `สินค้า ${sku} มี stock เพียง ${availableStock} ชิ้น ไม่เพียงพอสำหรับสั่ง ${quantity} ชิ้น`
    };
  }
  
  return {
    available: true,
    stock: availableStock,
    message: `สินค้า ${sku} มี stock ${availableStock} ชิ้น สามารถสั่ง ${quantity} ชิ้นได้`
  };
}

export async function checkMultipleStockAvailability(
  items: { sku: string; quantity: number }[],
  store: number = 500
): Promise<{ sku: string; available: boolean; stock: number; message: string; vatable: boolean }[]> {
  const skus = items.map(item => item.sku);
  const inventoryMap = new Map(
    (await getInventoryBySKUs(skus, store)).map(item => [item.sku, item])
  );
  
  const results = items.map(item => {
    const inventory = inventoryMap.get(item.sku);
    
    if (!inventory) {
      return {
        sku: item.sku,
        available: false,
        stock: 0,
        message: `ไม่พบข้อมูลสินค้า ${item.sku} ในระบบ inventory`
      };
    }
    
    const availableStock = inventory.on_hand;
    
    if (availableStock < 0) {
      return {
        sku: item.sku,
        available: false,
        stock: availableStock,
        message: `สินค้า ${item.sku} มี stock เป็นค่าลบ (${availableStock} ชิ้น)`
      };
    }
    
    if (availableStock < item.quantity) {
      return {
        sku: item.sku,
        available: false,
        stock: availableStock,
        message: `มี stock เพียง ${availableStock} ชิ้น ไม่เพียงพอสำหรับสั่ง ${item.quantity} ชิ้น`
      };
    }
    
    return {
      sku: item.sku,
      available: true,
      stock: availableStock,
      message: `มี stock ${availableStock} ชิ้น`
    };
  });

  // vatable: sc = 200 ไม่มี VAT, อย่างอื่น (รวมถึงไม่พบ) ถือว่ารวม VAT
  return results.map(r => ({ ...r, vatable: String(inventoryMap.get(r.sku)?.sc).trim() !== "200" }));
}
