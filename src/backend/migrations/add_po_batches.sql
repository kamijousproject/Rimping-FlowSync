-- Migration: ชุดใบเสนอราคากลุ่ม — ใบที่สร้างพร้อมกันจาก 1 ครั้ง (1 ร้าน = 1 ใบ) ผูกด้วย batch_id
-- Run once against the flowsync database

USE flowsync;

CREATE TABLE IF NOT EXISTS po_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pob_group FOREIGN KEY (group_id) REFERENCES customer_groups(id) ON DELETE SET NULL,
  CONSTRAINT fk_pob_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE purchase_orders
  ADD COLUMN batch_id INT NULL DEFAULT NULL AFTER customer_id,
  ADD CONSTRAINT fk_po_batch FOREIGN KEY (batch_id) REFERENCES po_batches(id) ON DELETE SET NULL,
  ADD INDEX idx_po_batch (batch_id);
