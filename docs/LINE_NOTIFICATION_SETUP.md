# การตั้งค่า LINE Notification สำหรับ FlowSync

## ภาพรวม
ระบบแจ้งเตือน LINE สำหรับ FlowSync จะส่งข้อความแจ้งเตือนไปยัง LINE Official Account ในกรณีต่อไปนี้:
- 🚨 ลูกค้าเลยกำหนดชำระ (3, 7, 14, 30 วัน)
- 👥 มีลูกค้าใหม่
- 📈 ขอเพิ่มวงเงินชั่วคราว
- 📊 แก้ไขวงเงินลูกค้า

## ขั้นตอนการตั้งค่า

### 1. สร้าง LINE Official Account
1. ไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง Provider ใหม่
3. สร้าง LINE Official Account ใหม่
4. ตั้งค่า Messaging API

### 2. ตั้งค่า Environment Variables
เพิ่มบรรทัดต่อไปนี้ในไฟล์ `.env.local`:

```env
# LINE Notification Settings
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here

# เลือกโหมดการส่ง notification:
# Option 1: Single User (default) - ส่งให้คนเดียว
LINE_ADMIN_USER_ID=your_admin_user_id_here
LINE_USE_BROADCAST=false

# Option 2: Broadcast - ส่งให้ทุกคนที่เพิ่มเป็นเพื่อน LINE OA
# LINE_ADMIN_USER_ID=ไม่ต้องระบุเมื่อใช้ broadcast
# LINE_USE_BROADCAST=true

# Cron Job Security
CRON_SECRET=your_cron_secret_here

# Base URL for links in notifications
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 3. หา Channel Access Token
1. ใน LINE Developers Console → ไปที่แท็บ "Messaging API"
2. หาส่วน "Channel access token (Long-lived)"
3. ถ้ายังไม่มี ให้คลิก **"Issue"** เพื่อสร้าง token ใหม่
4. คัดลอก token ที่ได้ (จะขึ้นต้นด้วย `eyJ...`)
5. **⚠️ ข้อควรระวัง:** Token นี้เป็นความลับ อย่าเปิดเผยต่อผู้อื่น

### 4. เลือกโหมดการส่ง Notification

#### Single User Mode (ค่าเริ่มต้น)
- **ผู้รับ**: คนเดียวที่ระบุใน `LINE_ADMIN_USER_ID`
- **เหมาะสำหรับ**: ทีมขนาดเล็ก หรือต้องการควบคุมผู้รับแจ้งเตือน
- **ต้องการ**: `LINE_ADMIN_USER_ID`

#### Broadcast Mode
- **ผู้รับ**: ทุกคนที่เพิ่ม LINE Official Account เป็นเพื่อน
- **เหมาะสำหรับ**: ทีมขนาดใหญ่ หรือต้องการแจ้งทุกคน
- **ต้องการ**: เพียง `LINE_USE_BROADCAST=true`
- **⚠️ ข้อควรระวัง**: 
  - ต้องมีสิทธิ์ Broadcast ใน LINE OA
  - ทุกคนจะได้รับ notification โปรดใช้ระวัง
  - ไม่ควรส่งข้อความที่ไม่จำเป็น

### 5. หา Admin User ID (สำหรับ Single User Mode)
มี 2 วิธีในการหา User ID:

#### วิธีที่ 1: ใช้ Webhook (แนะนำ)
1. ใน LINE Developers Console → แท็บ "Messaging API" → "Webhook settings"
2. ตั้งค่า Webhook URL: `https://your-domain.com/api/line/webhook`
3. เปิดใช้งาน "Use webhook"
4. ส่งข้อความไปที่ LINE Official Account ของคุณ
5. ดูใน Webhook logs จะเห็น `userId` ของผู้ส่ง

#### วิธีที่ 2: ใช้ LINE Bot API
1. ใช้ Postman หรือ curl ส่ง request:
```bash
curl -X POST https://api.line.me/v2/bot/info \
-H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```
2. ดูใน response จะมี `userId` ของ bot

### 5. ความแตกต่างระหว่าง Token:
- **Channel Secret**: ใช้สำหรับตรวจสอบ webhook signature (ไม่ใช้ในการส่งข้อความ)
- **Channel Access Token**: ใช้สำหรับส่งข้อความและเรียก API (ต้องการสำหรับระบบแจ้งเตือน)
- **User ID**: ID ของผู้ใช้ที่จะรับการแจ้งเตือน

### 5. ตั้งค่า Cron Job (สำหรับตรวจสอบลูกค้าเลยกำหนดชำระ)
เพิ่ม cron job ในระบบของคุณ:

```bash
# ตรวจสอบทุกวันเวลา 08:00 และ 14:00
0 8,14 * * * curl -X POST https://your-domain.com/api/cron/check-overdue -H "Authorization: Bearer your_cron_secret_here"
```

## การทดสอบระบบ

### ทดสอบการเชื่อมต่อ LINE
```bash
curl -X POST https://your-domain.com/api/notifications/test
```

### ทดสอบการตรวจสอบลูกค้าเลยกำหนดชำระ
```bash
curl -X GET https://your-domain.com/api/cron/check-overdue
```

## รูปแบบข้อความที่แจ้งเตือน

### ลูกค้าเลยกำหนดชำระ
```
🚨 แจ้งเตือนลูกค้าเลยกำหนดชำระ
⏰ 05/05/2567 14:30
📋 เลขที่ PO: PO202603-0009
👤 ลูกค้า: ร้านน้องนุ้ย
💰 ยอดค้าง: 6,000 บาท
⚠️ เลยกำหนด: 18 วัน
🔗 ตรวจสอบ: https://your-domain.com/po/9
```

### ลูกค้าใหม่
```
👥 ลูกค้าใหม่
⏰ 05/05/2567 14:30
🏢 ชื่อ: ร้านใหม่
📋 รหัส: C006
💳 วงเงิน: 50,000 บาท
📞 เบอร์: 081-234-5678
🔗 ดูรายละเอียด: https://your-domain.com/customers/6
```

### ขอเพิ่มวงเงินชั่วคราว
```
📈 ขอเพิ่มวงเงินชั่วคราว
⏰ 05/05/2567 14:30
👤 ลูกค้า: ร้านสมหมาย
📋 รหัส: C001
💰 วงเงินเดิม: 80,000 บาท
💰 เพิ่ม: 20,000 บาท
💰 รวม: 100,000 บาท
📝 เหตุผล: สั่งสินค้าจำนวนมาก
🔗 อนุมัติ: https://your-domain.com/customers/1
```

### แก้ไขวงเงินลูกค้า
```
📊 แก้ไขวงเงินลูกค้า
⏰ 05/05/2567 14:30
👤 ลูกค้า: ร้านสมหมาย
📋 รหัส: C001
🔄 การแก้ไข: เพิ่มวงเงิน
💰 จาก: 80,000 บาท
💰 เป็น: 100,000 บาท
📝 ผู้แก้ไข: admin
🔗 ดูรายละเอียด: https://your-domain.com/customers/1
```

## API Endpoints

### POST `/api/notifications/test`
ทดสอบการส่งข้อความ LINE

### POST `/api/customers/[id]/temporary-credit`
เพิ่มวงเงินชั่วคราว (จะส่ง notification อัตโนมัติ)

### POST `/api/cron/check-overdue`
ตรวจสอบลูกค้าเลยกำหนดชำระ (ต้องมี authorization header)

### GET `/api/cron/check-overdue`
ทดสอบการตรวจสอบลูกค้าเลยกำหนดชำระ (ไม่ต้องมี authorization)

## การแก้ไขปัญหา

### ข้อความไม่ส่ง
1. ตรวจสอบว่า `LINE_CHANNEL_ACCESS_TOKEN` ถูกต้อง
2. ตรวจสอบว่า `LINE_ADMIN_USER_ID` ถูกต้อง
3. ตรวจสอบว่า LINE Official Account ถูกเปิดใช้งานแล้ว

### Cron job ไม่ทำงาน
1. ตรวจสอบว่า `CRON_SECRET` ถูกต้อง
2. ตรวจสอบว่า URL ถูกต้องและสามารถเข้าถึงได้
3. ตรวจสอบ logs ของ cron service

### ข้อความซ้ำซ้อน
ระบบจะแจ้งเตือนลูกค้าเลยกำหนดชำระเฉพาะที่ 3, 7, 14, และ 30 วัน เพื่อป้องกันการส่งซ้ำซ้อน

## ข้อควรระวัง
- เก็บรักษา Channel Access Token และ Cron Secret อย่างปลอดภัย
- อย่าแชร์ข้อมูลการเข้าถึง LINE Developers Console
- ตรวจสอบว่า LINE Official Account ไม่ถูก block โดยผู้ใช้
- ควรมีการ backup ข้อมูล notification หากจำเป็นต้องตรวจสอบย้อนหลัง
