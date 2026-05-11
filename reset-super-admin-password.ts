// Script สำหรับ reset password super_admin
// ใช้: npx ts-node reset-super-admin-password.ts <new_password>

import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

async function resetSuperAdminPassword(newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    console.error("❌ Password ต้องมีอย่างน้อย 6 ตัวอักษร");
    process.exit(1);
  }

  // สร้าง bcrypt hash
  const passwordHash = await bcrypt.hash(newPassword, 10);
  console.log("🔐 Generated hash:", passwordHash);

  // เชื่อมต่อ database
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "flowsync",
  });

  try {
    // หา super_admin
    const [rows] = await conn.execute(
      "SELECT id, username, email, full_name FROM users WHERE role = 'super_admin'"
    );

    if ((rows as any[]).length === 0) {
      console.error("❌ ไม่พบ super_admin user");
      process.exit(1);
    }

    const superAdmin = (rows as any[])[0];
    console.log("👤 Super Admin found:");
    console.log("   ID:", superAdmin.id);
    console.log("   Username:", superAdmin.username);
    console.log("   Email:", superAdmin.email);
    console.log("   Name:", superAdmin.full_name);

    // Reset password
    await conn.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [passwordHash, superAdmin.id]
    );

    console.log("\n✅ Password reset successful!");
    console.log("📝 New password:", newPassword);
    console.log("🔐 Hash:", passwordHash);
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

const newPassword = process.argv[2];
resetSuperAdminPassword(newPassword);
