-- FlowSync database schema
CREATE DATABASE IF NOT EXISTS flowsync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flowsync;

-- Users (back-office staff)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(128) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  role ENUM('admin','super_admin') NOT NULL DEFAULT 'admin',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) UNIQUE,
  name VARCHAR(191) NOT NULL,
  contact_person VARCHAR(128),
  phone VARCHAR(32),
  email VARCHAR(128),
  tax_id VARCHAR(32),
  address TEXT,
  -- Credit (manual now; AI scoring in future)
  credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit_score INT DEFAULT NULL,           -- placeholder, AI later
  credit_score_notes TEXT DEFAULT NULL,    -- placeholder
  default_credit_term_days INT DEFAULT 30,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Purchase Orders (PO)
-- status flow:
--   draft -> confirmed -> packed -> checked -> delivered -> received
--   payment status: unpaid / partial / paid (computed but stored for index)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(32) UNIQUE NOT NULL,
  customer_id INT NOT NULL,
  status ENUM('draft','confirmed','packed','checked','delivered','received','cancelled') NOT NULL DEFAULT 'draft',
  payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  credit_term_days INT NOT NULL DEFAULT 30,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  signed_doc_path VARCHAR(255) DEFAULT NULL, -- proof of delivery (signed)
  signed_at DATETIME DEFAULT NULL,
  due_date DATE DEFAULT NULL,
  notes TEXT,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_po_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_po_customer (customer_id),
  INDEX idx_po_status (status),
  INDEX idx_po_payment_status (payment_status)
) ENGINE=InnoDB;

-- PO line items
CREATE TABLE IF NOT EXISTS po_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  description VARCHAR(255),
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit VARCHAR(32) DEFAULT 'pcs',
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_items_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  INDEX idx_items_po (po_id)
) ENGINE=InnoDB;

-- Payments (each transfer slip)
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  paid_at DATETIME NOT NULL,
  method VARCHAR(32) DEFAULT 'transfer',
  reference VARCHAR(128),
  slip_path VARCHAR(255),
  notes TEXT,
  recorded_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_user FOREIGN KEY (recorded_by) REFERENCES users(id),
  INDEX idx_pay_po (po_id)
) ENGINE=InnoDB;

-- Invoices (generated for payment requests)
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(32) UNIQUE NOT NULL,
  po_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_by INT NOT NULL,
  CONSTRAINT fk_inv_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_user FOREIGN KEY (generated_by) REFERENCES users(id),
  INDEX idx_inv_po (po_id)
) ENGINE=InnoDB;

-- Audit log of PO edits
CREATE TABLE IF NOT EXISTS po_edit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  edited_by INT NOT NULL,
  summary VARCHAR(255) NOT NULL,
  changes MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pel_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pel_user FOREIGN KEY (edited_by) REFERENCES users(id),
  INDEX idx_pel_po (po_id)
) ENGINE=InnoDB;

-- Customer profile files (multiple files per customer)
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

-- Audit log of customer edits
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

-- Credit limit adjustment log (incremental changes)
CREATE TABLE IF NOT EXISTS credit_limit_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  adjusted_by INT NOT NULL,
  delta DECIMAL(14,2) NOT NULL,        -- positive = increase, negative = decrease
  new_limit DECIMAL(14,2) NOT NULL,
  reason VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cla_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cla_user FOREIGN KEY (adjusted_by) REFERENCES users(id),
  INDEX idx_cla_customer (customer_id)
) ENGINE=InnoDB;

-- Temporary credit limit grants
CREATE TABLE IF NOT EXISTS temp_credit_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  extra_amount DECIMAL(14,2) NOT NULL,  -- additional credit on top of base
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

-- Quotations (sale-side document offered to customer; one per PO, lazily created when first viewed)
CREATE TABLE IF NOT EXISTS quotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_number VARCHAR(32) UNIQUE NOT NULL,
  po_id INT NOT NULL UNIQUE,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qt_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;
