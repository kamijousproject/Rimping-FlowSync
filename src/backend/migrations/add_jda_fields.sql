-- Add JDA sync fields to purchase_orders
ALTER TABLE purchase_orders
  ADD COLUMN jda_job_id    VARCHAR(64)  DEFAULT NULL AFTER tax_invoice_number,
  ADD COLUMN jda_po_number VARCHAR(64)  DEFAULT NULL AFTER jda_job_id,
  ADD COLUMN jda_synced_at DATETIME     DEFAULT NULL AFTER jda_po_number;
