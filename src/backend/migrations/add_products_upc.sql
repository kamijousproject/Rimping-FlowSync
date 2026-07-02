-- Add UPC (barcode) to products, sourced from inventory (Inventory-500-Horeca.csv) by store+sku.
-- Apply manually:  mysql -uroot flowsync < src/backend/migrations/add_products_upc.sql
ALTER TABLE products
  ADD COLUMN upc VARCHAR(50) DEFAULT NULL AFTER sku,
  ADD KEY idx_upc (upc);

-- Backfill from already-synced inventory rows (safe to re-run).
UPDATE products p
  JOIN inventory i ON p.store = i.store AND p.sku = i.sku
  SET p.upc = i.upc
  WHERE i.upc IS NOT NULL AND i.upc <> '';
