-- Migration: ข้อมูลผู้ซื้อ (นิติบุคคล) ของกลุ่มลูกค้า — ใช้แทนชื่อ/ที่อยู่/เลขภาษีของร้านบนใบเสนอราคา/ใบกำกับภาษี
-- สาขาต่อท้ายเลขภาษีมาจากรหัสร้าน (customers.code เช่น 711-23374 → สาขาที่ 23374)
-- Run once against the flowsync database

USE flowsync;

ALTER TABLE customer_groups
  ADD COLUMN billing_name VARCHAR(191) NULL DEFAULT NULL AFTER notes,
  ADD COLUMN billing_address TEXT NULL AFTER billing_name,
  ADD COLUMN billing_tax_id VARCHAR(32) NULL DEFAULT NULL AFTER billing_address;

UPDATE customer_groups
SET billing_name = 'บริษัท ซีพี ออลล์ จำกัด (มหาชน)',
    billing_address = 'เลขที่ 313 อาคารซี.พี.ทาวเวอร์ ชั้น24 ถนนสีลม แขวงสีลม เขตบางรัก กรุงเทพมหานคร 10500',
    billing_tax_id = '0107542000011'
WHERE name = '7-11 (เซเว่นอีเลเว่น)';
