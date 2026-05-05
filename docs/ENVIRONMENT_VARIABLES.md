# Environment Variables for FlowSync

## คัดลอกไฟล์นี้เป็น `.env.local` และแก้ไขค่าตามต้องการ

```env
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=flowsync

# JWT Secret
JWT_SECRET=dev-secret-change-me

# Upload Directory
UPLOAD_DIR=uploads

# LINE Notification Settings
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_ADMIN_USER_ID=your_admin_user_id_here

# Cron Job Security
CRON_SECRET=flowsync-cron-secret-2024

# Base URL for links in notifications
NEXT_PUBLIC_BASE_URL=http://localhost:3001
```

## คำอธิบาย

### Database Configuration
- `DB_HOST`: Host ของฐานข้อมูล MySQL/MariaDB
- `DB_PORT`: Port ของฐานข้อมูล (default: 3306)
- `DB_USER`: Username สำหรับเชื่อมต่อฐานข้อมูล
- `DB_PASSWORD`: Password สำหรับเชื่อมต่อฐานข้อมูล
- `DB_NAME`: ชื่อฐานข้อมูล

### JWT Secret
- `JWT_SECRET`: Secret key สำหรับ JWT token (ควรเปลี่ยนใน production)

### Upload Directory
- `UPLOAD_DIR`: โฟลเดอร์สำหรับเก็บไฟล์ที่อัปโหลด

### LINE Notification Settings
- `LINE_CHANNEL_ACCESS_TOKEN`: Channel Access Token จาก LINE Developers Console
- `LINE_ADMIN_USER_ID`: User ID ของ admin ที่จะรับการแจ้งเตือน

### Cron Job Security
- `CRON_SECRET`: Secret key สำหรับป้องกันการเรียก cron endpoint โดยไม่ได้รับอนุญาต

### Base URL
- `NEXT_PUBLIC_BASE_URL`: URL ของแอปพลิเคชัน (ใช้สำหรับลิงก์ใน notifications)

## วิธีตั้งค่า

1. คัดลอกข้างบนและบันทึกเป็น `.env.local`
2. แก้ไขค่าตามความเหมาะสม
3. รีสตาร์ทแอปพลิเคชัน

## การตั้งค่า LINE Notification

ดูวิธีการตั้งค่า LINE Official Account ในไฟล์ `LINE_NOTIFICATION_SETUP.md`
