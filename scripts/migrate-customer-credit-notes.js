// Migration: Add customer_credit_notes tables
const mysql = require('mysql2/promise');

async function runMigration() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'flowsync',
  });

  try {
    // Check if customer_credit_notes table exists
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = 'flowsync' AND TABLE_NAME = 'customer_credit_notes'`
    );

    if (tables.length === 0) {
      console.log('Creating customer_credit_notes table...');
      await conn.query(`
        CREATE TABLE IF NOT EXISTS customer_credit_notes (
          id                INT AUTO_INCREMENT PRIMARY KEY,
          ccn_number        VARCHAR(32) UNIQUE NOT NULL,
          customer_id       INT NOT NULL,
          po_id             INT NOT NULL,
          payment_id        INT NOT NULL,
          amount            DECIMAL(14,2) NOT NULL,
          status            ENUM('active','used','refunded','expired') NOT NULL DEFAULT 'active',
          usage_type        ENUM('keep_as_credit','refund_to_customer') NOT NULL DEFAULT 'keep_as_credit',
          used_amount       DECIMAL(14,2) NOT NULL DEFAULT 0,
          refunded_at       DATETIME,
          notes             VARCHAR(500),
          created_by        INT NOT NULL,
          created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          expires_at        DATE,
          CONSTRAINT fk_ccn_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
          CONSTRAINT fk_ccn_po       FOREIGN KEY (po_id)       REFERENCES purchase_orders(id) ON DELETE RESTRICT,
          CONSTRAINT fk_ccn_payment  FOREIGN KEY (payment_id)  REFERENCES payments(id) ON DELETE CASCADE,
          CONSTRAINT fk_ccn_user     FOREIGN KEY (created_by)  REFERENCES users(id),
          INDEX idx_ccn_customer (customer_id),
          INDEX idx_ccn_po (po_id),
          INDEX idx_ccn_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('customer_credit_notes table created');
    } else {
      console.log('customer_credit_notes table already exists');
    }

    // Check if customer_credit_note_usages table exists
    const [usageTables] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = 'flowsync' AND TABLE_NAME = 'customer_credit_note_usages'`
    );

    if (usageTables.length === 0) {
      console.log('Creating customer_credit_note_usages table...');
      await conn.query(`
        CREATE TABLE IF NOT EXISTS customer_credit_note_usages (
          id                INT AUTO_INCREMENT PRIMARY KEY,
          ccn_id            INT NOT NULL,
          po_id             INT,
          amount_used       DECIMAL(14,2) NOT NULL,
          usage_type        ENUM('applied_to_po','refunded') NOT NULL,
          notes             VARCHAR(255),
          created_by        INT NOT NULL,
          created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_ccnu_ccn   FOREIGN KEY (ccn_id)   REFERENCES customer_credit_notes(id) ON DELETE CASCADE,
          CONSTRAINT fk_ccnu_po    FOREIGN KEY (po_id)    REFERENCES purchase_orders(id) ON DELETE SET NULL,
          CONSTRAINT fk_ccnu_user FOREIGN KEY (created_by) REFERENCES users(id),
          INDEX idx_ccnu_ccn (ccn_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('customer_credit_note_usages table created');
    } else {
      console.log('customer_credit_note_usages table already exists');
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runMigration();
