// Migration script to add billing_note_due_days column
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
    // Check if column exists
    const [columns] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'billing_note_due_days'`,
      ['flowsync']
    );

    if (columns.length === 0) {
      console.log('Adding billing_note_due_days column...');
      await conn.query(
        `ALTER TABLE customers ADD COLUMN billing_note_due_days INT DEFAULT 5`
      );
      console.log('Column added successfully');
    } else {
      console.log('Column already exists');
    }

    // Set default value for existing customers
    const [result] = await conn.query(
      `UPDATE customers SET billing_note_due_days = 5 WHERE billing_note_due_days IS NULL`
    );
    console.log(`Updated ${result.affectedRows} existing customers to have billing_note_due_days = 5`);

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runMigration();
