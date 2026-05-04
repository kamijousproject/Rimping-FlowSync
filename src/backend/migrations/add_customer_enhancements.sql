-- Migration: Customer Profile Enhancements
-- Run once against the flowsync database

USE flowsync;

CREATE TABLE IF NOT EXISTS customer_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
  file_size INT NOT NULL DEFAULT 0,
  uploaded_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cf_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cf_user FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_cf_customer (customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_edit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  edited_by INT NOT NULL,
  summary VARCHAR(255) NOT NULL,
  changes MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cel_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cel_user FOREIGN KEY (edited_by) REFERENCES users(id),
  INDEX idx_cel_customer (customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS credit_limit_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  adjusted_by INT NOT NULL,
  delta DECIMAL(14,2) NOT NULL,
  new_limit DECIMAL(14,2) NOT NULL,
  reason VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cla_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cla_user FOREIGN KEY (adjusted_by) REFERENCES users(id),
  INDEX idx_cla_customer (customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS temp_credit_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  extra_amount DECIMAL(14,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255),
  created_by INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tcl_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_tcl_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_tcl_customer (customer_id)
) ENGINE=InnoDB;
