-- Migration: Create credit_limit_requests table for manager approval workflow
-- Date: 2024-05-14

-- Create credit limit approval requests table
CREATE TABLE IF NOT EXISTS credit_limit_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_type ENUM('permanent_increase', 'temporary') NOT NULL,
  customer_id INT NOT NULL,
  -- For permanent increase: amount to add to base credit_limit
  amount DECIMAL(14,2) DEFAULT NULL,
  -- For temporary: extra_amount, start_date, end_date
  extra_amount DECIMAL(14,2) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  reason VARCHAR(255),
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  requested_by INT NOT NULL,
  approved_by INT DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  rejection_reason VARCHAR(255) DEFAULT NULL,
  approval_token VARCHAR(64) UNIQUE NOT NULL,  -- for secure approval link
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clr_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_clr_requested_by FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_clr_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_clr_customer (customer_id),
  INDEX idx_clr_status (status),
  INDEX idx_clr_token (approval_token)
) ENGINE=InnoDB;

-- Add request_id column to temp_credit_limits table (if not exists)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.columns 
  WHERE table_name = 'temp_credit_limits' 
  AND column_name = 'request_id'
  AND table_schema = DATABASE()
);

SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE temp_credit_limits ADD COLUMN request_id INT DEFAULT NULL AFTER created_at, ADD CONSTRAINT fk_tcl_request FOREIGN KEY (request_id) REFERENCES credit_limit_requests(id) ON DELETE SET NULL',
  'SELECT "Column request_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify tables created successfully
SELECT 
  'credit_limit_requests' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'credit_limit_requests' AND table_schema = DATABASE()
UNION ALL
SELECT 
  'temp_credit_limits (with request_id)' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'temp_credit_limits' AND table_schema = DATABASE();
