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
  billing_note_due_days INT DEFAULT 5,
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
  download_count INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_inv_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_user FOREIGN KEY (generated_by) REFERENCES users(id),
  INDEX idx_inv_po (po_id)
) ENGINE=InnoDB;

-- Invoice logs (creation and download tracking)
CREATE TABLE IF NOT EXISTS invoice_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  action ENUM('created', 'downloaded', 'printed', 'viewed') NOT NULL DEFAULT 'viewed',
  user_id INT NOT NULL,
  user_name VARCHAR(128) NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_il_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_il_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_il_invoice (invoice_id),
  INDEX idx_il_user (user_id),
  INDEX idx_il_created (created_at)
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

-- Credit notes (ใบลดหนี้) — only allowed when PO status = received
CREATE TABLE IF NOT EXISTS credit_notes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  cn_number         VARCHAR(32) UNIQUE NOT NULL,          -- เลขที่ใบลดหนี้ เช่น CN202605-0001
  po_id             INT NOT NULL,
  customer_id       INT NOT NULL,
  created_by        INT NOT NULL,
  reason            VARCHAR(500),
  total_original    DECIMAL(14,2) NOT NULL DEFAULT 0,     -- ยอดรวมราคาเดิมของรายการที่ลด
  total_new         DECIMAL(14,2) NOT NULL DEFAULT 0,     -- ยอดรวมราคาใหม่
  total_diff        DECIMAL(14,2) NOT NULL DEFAULT 0,     -- ส่วนต่างที่คืนเครดิต (original - new)
  status            ENUM('active','voided') NOT NULL DEFAULT 'active',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cn_po       FOREIGN KEY (po_id)       REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cn_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_cn_user     FOREIGN KEY (created_by)  REFERENCES users(id),
  INDEX idx_cn_po (po_id),
  INDEX idx_cn_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Credit note line items
CREATE TABLE IF NOT EXISTS credit_note_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  credit_note_id  INT NOT NULL,
  po_item_id      INT NOT NULL,                           -- อ้างอิง po_items
  product_name    VARCHAR(255) NOT NULL,
  description     VARCHAR(500),
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit            VARCHAR(50),
  original_price  DECIMAL(14,2) NOT NULL,                 -- ราคาเดิม/หน่วย
  new_price       DECIMAL(14,2) NOT NULL,                 -- ราคาใหม่/หน่วย
  diff_amount     DECIMAL(14,2) NOT NULL,                 -- (original - new) * quantity
  CONSTRAINT fk_cni_cn      FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cni_poitem  FOREIGN KEY (po_item_id)     REFERENCES po_items(id) ON DELETE RESTRICT,
  INDEX idx_cni_cn (credit_note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Credit note audit log
CREATE TABLE IF NOT EXISTS credit_note_logs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  credit_note_id INT NOT NULL,
  action         ENUM('created','updated','voided') NOT NULL,
  performed_by   INT NOT NULL,
  summary        VARCHAR(255),
  changes        MEDIUMTEXT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cnl_cn   FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cnl_user FOREIGN KEY (performed_by)  REFERENCES users(id),
  INDEX idx_cnl_cn (credit_note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer credit notes (เครดิตโน๊ตจากการชำระเกิน) — can be used for future purchases
CREATE TABLE IF NOT EXISTS customer_credit_notes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  ccn_number        VARCHAR(32) UNIQUE NOT NULL,          -- เลขที่เครดิตโน๊ต เช่น CCN202605-0001
  customer_id       INT NOT NULL,
  po_id             INT NOT NULL,                         -- อ้างอิง PO ที่ชำระเกิน
  payment_id        INT NOT NULL,                         -- อ้างอิง payment ที่เกิด overpayment
  amount            DECIMAL(14,2) NOT NULL,               -- ยอดชำระเกิน
  status            ENUM('active','used','refunded','expired') NOT NULL DEFAULT 'active',
  usage_type        ENUM('keep_as_credit','refund_to_customer') NOT NULL DEFAULT 'keep_as_credit', -- เก็บเป็นเครดิตหรือโอนคืน
  used_amount       DECIMAL(14,2) NOT NULL DEFAULT 0,     -- ยอดที่ใช้ไปแล้ว
  refunded_at       DATETIME,                             -- วันที่โอนคืน (ถ้าเลือก refund)
  notes             VARCHAR(500),
  created_by        INT NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at        DATE,                                 -- วันหมดอายุ (null = ไม่หมดอายุ)
  CONSTRAINT fk_ccn_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ccn_po       FOREIGN KEY (po_id)       REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ccn_payment  FOREIGN KEY (payment_id)  REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_ccn_user     FOREIGN KEY (created_by)  REFERENCES users(id),
  INDEX idx_ccn_customer (customer_id),
  INDEX idx_ccn_po (po_id),
  INDEX idx_ccn_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer credit note usage log (track การใช้เครดิตโน๊ต)
CREATE TABLE IF NOT EXISTS customer_credit_note_usages (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  ccn_id            INT NOT NULL,
  po_id             INT,                                  -- ใช้กับ PO ไหน (null ถ้าเป็นการ refund)
  amount_used       DECIMAL(14,2) NOT NULL,               -- ยอดที่ใช้/คืน
  usage_type        ENUM('applied_to_po','refunded') NOT NULL,
  notes             VARCHAR(255),
  created_by        INT NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ccnu_ccn   FOREIGN KEY (ccn_id)   REFERENCES customer_credit_notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_ccnu_po    FOREIGN KEY (po_id)    REFERENCES purchase_orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_ccnu_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_ccnu_ccn (ccn_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products / price catalog (synced from store CSV, refreshed daily at 02:00)
CREATE TABLE IF NOT EXISTS products (
  id            INT AUTO_INCREMENT PRIMARY KEY,

  -- Identity
  store         SMALLINT NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'THB',
  sku           VARCHAR(32) NOT NULL,
  description   VARCHAR(512) NOT NULL DEFAULT '',

  -- Current pricing
  price_use         VARCHAR(32),
  current_price     DECIMAL(12,3) NOT NULL DEFAULT 0,
  price_type        VARCHAR(64),
  current_start     DATE,
  current_end       DATE,
  current_event     VARCHAR(64),

  -- Original pricing (before any promotion)
  original_use      VARCHAR(32),
  original_price    DECIMAL(12,3),
  original_start    DATE,
  original_end      DATE,
  original_type     VARCHAR(64),
  original_event    VARCHAR(64),

  -- Department hierarchy
  d                 SMALLINT,
  sd                SMALLINT,
  c                 SMALLINT,
  dept              VARCHAR(64),
  sub_dept          VARCHAR(64),
  class             VARCHAR(64),
  mer               VARCHAR(16),
  ishida            VARCHAR(16),

  -- Vendor
  vendor            INT,
  vendor_name       VARCHAR(255),

  -- Metadata
  synced_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_store_sku (store, sku),
  KEY idx_sku (sku),
  KEY idx_dept (dept),
  KEY idx_vendor (vendor),
  FULLTEXT KEY ft_sku_desc (sku, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
