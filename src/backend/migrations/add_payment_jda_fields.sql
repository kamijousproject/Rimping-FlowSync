-- Add JDA sync fields to payments
ALTER TABLE payments
  ADD COLUMN jda_job_id   VARCHAR(64) DEFAULT NULL AFTER notes,
  ADD COLUMN jda_synced_at DATETIME   DEFAULT NULL AFTER jda_job_id;
