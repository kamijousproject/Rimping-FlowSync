-- Migration: add fully_paid_at to purchase_orders
-- Purpose: track exact timestamp when PO became fully paid (payment_status='paid')
--          Used as label for future credit scoring ML model
-- Run once: mysql flowsync < src/backend/migrations/add_fully_paid_at.sql

USE flowsync;

ALTER TABLE purchase_orders
  ADD COLUMN fully_paid_at DATETIME DEFAULT NULL
    COMMENT 'Timestamp when payment_status became paid (fully settled). Used for credit ML label.'
  AFTER paid_amount;

-- Back-fill: estimate fully_paid_at from the latest payment for already-paid POs
UPDATE purchase_orders po
JOIN (
  SELECT po_id, MAX(paid_at) AS last_paid_at
  FROM payments
  GROUP BY po_id
) p ON p.po_id = po.id
SET po.fully_paid_at = p.last_paid_at
WHERE po.payment_status = 'paid'
  AND po.fully_paid_at IS NULL;
