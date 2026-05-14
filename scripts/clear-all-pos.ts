#!/usr/bin/env ts-node
/**
 * Script ล้าง PO ทั้งหมดในระบบ
 * รัน: npx ts-node scripts/clear-all-pos.ts
 */
import { exec } from "../src/backend/db";

async function clearAllPos() {
  console.log("🧹 เริ่มล้าง PO ทั้งหมด...\n");

  try {
    // ดึงจำนวน PO ก่อนลบ
    const countResult = await exec(
      "SELECT COUNT(*) as cnt FROM purchase_orders WHERE status != 'cancelled'"
    );
    const count = (countResult as any)?.cnt ?? 0;

    if (count === 0) {
      console.log("✅ ไม่มี PO ที่ต้องยกเลิก (ทั้งหมดถูกยกเลิกแล้ว)");
      return;
    }

    console.log(`📊 พบ PO ที่ยังไม่ถูกยกเลิก: ${count} ใบ`);

    // ยกเลิกทุก PO
    await exec(`
      UPDATE purchase_orders 
      SET 
        status = 'cancelled',
        payment_status = 'unpaid',
        remaining_amount = 0,
        paid_amount = 0,
        updated_at = NOW()
      WHERE status != 'cancelled'
    `);

    console.log(`✅ ยกเลิก PO ทั้งหมด ${count} ใบสำเร็จ`);
    console.log("\n💡 หมายเหตุ: PO ทั้งหมดถูกเปลี่ยนสถานะเป็น 'ยกเลิก' แต่ยังคงข้อมูลไว้ในระบบ");
    console.log("   หากต้องการลบถาวรจริง ๆ ให้ใช้ไฟล์ clear_all_pos.sql (ตัวเลือก 2)");

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    process.exit(1);
  }

  process.exit(0);
}

clearAllPos();
