-- Migration: เลขที่ใบเสร็จรับเงิน (1 ใบต่อการชำระ 1 ครั้ง) รูปแบบ RC{YYMM}-{NNNN} ออกตอนเปิดใบเสร็จครั้งแรก
-- Run once against the flowsync database

USE flowsync;

ALTER TABLE payments
  ADD COLUMN receipt_number VARCHAR(32) NULL DEFAULT NULL AFTER po_id,
  ADD UNIQUE KEY uq_payment_receipt_number (receipt_number);
