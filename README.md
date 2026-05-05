<div align="center">

# 🌿 FlowSync

**ระบบจัดการขายแบบสินเชื่อสำหรับ Rimping**
*Credit-Sales Management System for back-office staff*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com)
[![LINE Bot](https://img.shields.io/badge/LINE%20Bot-00C300?logo=line)](https://developers.line.biz)
[![License](https://img.shields.io/badge/license-Internal-green.svg)](#)

</div>

---

## 📖 ภาพรวม

**FlowSync** คือระบบหลังบ้านสำหรับติดตามและจัดการ **Purchase Order (PO)**
ที่ขายสินเชื่อสินค้าให้ลูกค้า ครอบคลุมฟีเจอร์ครบวงจร:

- 📝 **ออก PO** ตรวจวงเงินก่อนออกอัตโนมัติ
- 📦 **ติดตามขั้นตอน** draft → confirmed → packed → checked → delivered → received
- 💵 **ออก Invoice** + บันทึกการชำระบางส่วน/เต็มจำนวน + แนบสลิป (พร้อม preview รูป)
- ✏️ **แก้ไข PO ได้** ตราบที่ยังไม่ชำระครบ + บันทึก audit log ทุกครั้ง
- 🔐 **Permission 2 ระดับ** — `admin` / `super_admin` (เพิ่ม/แก้ไขลูกค้าเฉพาะ super_admin)
- 📊 **Dashboard** สรุปลูกหนี้คงค้าง, วงเงิน, PO เกินกำหนด (พร้อม Progress Bars)
- 🤖 **LINE Notifications** แจ้งเตือนอัตโนมัติ (ลูกค้าเลยกำหนด, ลูกค้าใหม่, วงเงิน) - รองรับ Single User และ Broadcast Mode
- 🖨️ **พิมพ์ใบเสนอราคา / ใบแจ้งหนี้** A4 พร้อมส่งออก PDF (Ctrl+P)
- 📖 **คู่มือการใช้งาน** ภาษาไทยที่ [`/manual`](http://localhost:3000/manual) (export PDF ได้)
- ⏰ **Cron Jobs** ตรวจสอบลูกค้าเลยกำหนดชำระอัตโนมัติ
- 🤖 **เตรียม field** Credit Score (0–1000) ไว้รองรับ AI ประเมินภายหลัง

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 |
| **Backend** | Next.js API Routes · `mysql2` (pool + transactions) |
| **Database** | MySQL 8 (XAMPP @ `/opt/lampp`) |
| **Auth** | bcryptjs + JWT (httpOnly cookie via `jose`) |
| **Notifications** | LINE Bot API (@line/bot-sdk) · Cron Jobs |
| **Validation** | zod |
| **UI Icons** | lucide-react |
| **Mobile** | Bottom-tab nav (app-like) + responsive cards |

---

## 📂 โครงสร้างโปรเจกต์

> 🎯 **แยก frontend / backend ชัดเจน** — backend เข้าถึงได้ผ่าน HTTP API เท่านั้น
> เพื่อให้ต่อ AI หรือ external service ภายหลังได้ง่าย

```
flowsync/
├── src/
│   ├── app/                          # 🎨 FRONTEND + API
│   │   ├── login/                    # public
│   │   ├── register/                 # public (back-office)
│   │   ├── (app)/                    # 🔒 protected routes (sidebar/bottomnav)
│   │   │   ├── dashboard/
│   │   │   ├── customers/{,new,[id]}/
│   │   │   └── po/{,new,[id],[id]/invoice}/
│   │   └── api/                      # 🌐 REST API (HTTP boundary)
│   │       ├── auth/{login,register,logout,me}/
│   │       ├── customers/{,[id]}/
│   │       ├── po/{,[id],[id]/{status,sign,payments,invoice}}/
│   │       ├── dashboard/
│   │       ├── notifications/{test}/
│   │       ├── cron/check-overdue/
│   │       └── files/[category]/[name]/   # serve uploaded slips/docs
│   │
│   ├── backend/                      # ⚙️ BACKEND ONLY (private)
│   │   ├── db.ts                     # mysql2 pool + tx helpers
│   │   ├── auth.ts                   # bcrypt + JWT cookie
│   │   ├── upload.ts                 # multipart file upload
│   │   ├── services/
│   │   │   ├── customers.ts          # + LINE notifications
│   │   │   ├── po.ts
│   │   │   ├── payments.ts
│   │   │   ├── dashboard.ts          # + overdue data
│   │   │   └── notifications.ts      # LINE Bot API service
│   │   ├── schema.sql                # โครงตาราง
│   │   ├── seed-mock.sql             # ข้อมูลตัวอย่างครบทุก status
│   │   ├── seed-mock-runner.js       # Node.js script สำหรับ seed data
│   │   └── sync_products.py          # Python script สำหรับ sync ข้อมูลสินค้า
│   │
│   ├── components/                   # 🎨 shared UI
│   │   ├── Brand.tsx
│   │   ├── Sidebar.tsx               # desktop
│   │   ├── BottomNav.tsx             # mobile (FAB ตรงกลาง)
│   │   ├── MobileTopBar.tsx
│   │   └── StatusBadge.tsx
│   │
│   └── proxy.ts                      # auth middleware (Next.js 16)
│
├── scripts/                          # 📜 Scripts สำหรับ Cron Jobs
│   └── check-overdue.sh              # ตรวจสอบลูกค้าเลยกำหนดชำระ
│
├── docs/                             # 📚 เอกสาร
│   ├── LINE_NOTIFICATION_SETUP.md    # คู่มือตั้งค่า LINE
│   └── ENVIRONMENT_VARIABLES.md      # ตัวอย่าง env variables
│
├── public/uploads/                   # uploaded files (gitignored)
├── .env.local                        # DB / JWT_SECRET / LINE settings
└── README.md
```

---

## 🚀 การติดตั้งระบบ (Full Setup)

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` (ดูตัวอย่างใน `docs/ENVIRONMENT_VARIABLES.md`):

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
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. ติดตั้งและตั้งค่าฐานข้อมูล

```bash
# สร้างฐานข้อมูล
sudo /opt/lampp/bin/mysql -uroot < src/backend/schema.sql

# ทางเลือกที่ 1: Seed mock data ครบทุก status (แนะนำ)
node src/backend/seed-mock-runner.js

# ทางเลือกที่ 2: Seed แบบ manual
mysql -uroot flowsync < src/backend/seed-mock.sql
```

### 4. ตั้งค่า LINE Official Account (สำคัญ!)

ดูคู่มือที่ `docs/LINE_NOTIFICATION_SETUP.md`:

1. **สร้าง LINE Official Account** ที่ [LINE Developers Console](https://developers.line.biz/)
2. **หา Channel Access Token**:
   - ไปที่แท็บ "Messaging API"
   - คลิก "Issue" ถ้ายังไม่มี
   - คัดลอก token (ขึ้นต้นด้วย `eyJ...`)
3. **หา Admin User ID**:
   ```bash
   curl -X GET https://api.line.me/v2/bot/info \
   -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
   ```
4. **เพิ่มใน `.env.local`**

### 5. ตั้งค่า Cron Jobs (Ubuntu 24.04)

```bash
# ทำให้สคริปต์ executeable
chmod +x scripts/check-overdue.sh

# ตั้งค่า cron job
crontab -e
```

เพิ่มบรรทัดเหล่านี้:

```bash
# FlowSync Cron Jobs
# Check overdue customers twice daily at 8:00 AM and 2:00 PM
0 8,14 * * * /home/aiadmin/FlowSync/flowsync/scripts/check-overdue.sh

# Sync products data daily at 3:00 AM (existing)
0 3 * * * cd /home/aiadmin/FlowSync/flowsync && python3 src/backend/sync_products.py >> /var/log/flowsync-sync.log 2>&1
```

### 6. รันแอปพลิเคชัน

```bash
npm run dev          # → http://localhost:3000
# production
npm run build && npm start
```

### 7. ทดสอบระบบ

```bash
# ทดสอบ LINE notification
curl -X POST http://localhost:3000/api/notifications/test

# ทดสอบ overdue check
curl -X GET http://localhost:3000/api/cron/check-overdue

# ทดสอบ health check
curl -X GET http://localhost:3000/api/health
```

### 8. เข้าสู่ระบบ

| Username     | Password         | Role          | สิทธิ์                                       |
|--------------|------------------|---------------|----------------------------------------------|
| `admin`      | `Admin@123`      | `admin`       | ทุกอย่าง **ยกเว้น** เพิ่ม/แก้ไขลูกค้า       |
| `superadmin` | `SuperAdmin@123` | `super_admin` | ทุกอย่าง รวมถึงเพิ่ม/แก้ไขข้อมูลลูกค้า      |

> 🔐 ระบบ**ไม่มี**การลงทะเบียนสำหรับลูกค้า เป็นระบบหลังบ้านอย่างเดียว
> ใช้ `/register` (เข้าจาก /login) สร้างบัญชีพนักงานเพิ่มเติม

---

## 🤖 LINE Notification System

ระบบแจ้งเตือนอัตโนมัติผ่าน LINE Official Account:

### 🚨 **ประเภทการแจ้งเตือน:**

1. **ลูกค้าเลยกำหนดชำระ** (3, 7, 14, 30 วัน)
   - แสดง PO number, ชื่อลูกค้า, ยอดค้าง, วันที่เลยกำหนด
   - มีลิงก์ตรงไปดูรายละเอียด PO

2. **ลูกค้าใหม่**
   - แจ้งทันทีเมื่อมีการสร้างลูกค้าใหม่
   - แสดงชื่อ, รหัส, วงเงิน, เบอร์โทรศัพท์

3. **ขอเพิ่มวงเงินชั่วคราว**
   - แจ้งเมื่อมีการขอเพิ่มวงเงินชั่วคราว
   - แสดงวงเงินเดิม, เพิ่ม, รวม, เหตุผล

4. **แก้ไขวงเงินลูกค้า**
   - แจ้งเมื่อมีการแก้ไขวงเงิน (เพิ่ม/ลด)
   - แสดงวงเงินเดิม, ใหม่, ผู้แก้ไข

### ⏰ **Cron Job Schedule:**
- **ทำงานวันละ 2 ครั้ง** (08:00 และ 14:00)
- **Log บันทึก** ที่ `/var/log/flowsync-overdue.log`
- **Security** ด้วย `CRON_SECRET`

---

## 🔄 PO Lifecycle

```
   ┌─────────┐    ยืนยัน      ┌───────────┐   แพ็ค     ┌────────┐
   │  draft  │ ───────────► │ confirmed │ ────────► │ packed │
   └─────────┘                └───────────┘           └────┬───┘
                                                           │ ตรวจ
                                                           ▼
   ┌──────────┐  รับของ    ┌───────────┐  ส่ง       ┌─────────┐
   │ received │ ◄────────  │ delivered │ ◄──────── │ checked │
   └────┬─────┘             └───────────┘           └─────────┘
        │ + อัปโหลดเอกสาร signed
        ▼
   ┌──────────────┐
   │ Invoice + Pay │  unpaid → partial → paid
   └──────────────┘
```

**กฎสำคัญ:**

- ✅ ตรวจ **credit limit** ก่อนสร้าง PO เสมอ (server-side)
- ✅ เปลี่ยนสถานะ "delivered" → ตั้ง `due_date = today + credit_term_days`
- ✅ ทุกการชำระคำนวณ `paid_amount` / `remaining_amount` ใน transaction เดียว
- ✅ `cancelled` ใช้ได้ทุก step (ก่อน received) แล้วล็อก

---

## 🌐 REST API

### Authentication
| Method | Path                     | คำอธิบาย                 |
|--------|--------------------------|--------------------------|
| POST   | `/api/auth/login`        | login → set cookie       |
| POST   | `/api/auth/register`     | สร้างผู้ใช้ใหม่          |
| POST   | `/api/auth/logout`       | clear cookie             |
| GET    | `/api/auth/me`           | current user             |

### Customers
| Method | Path                       | คำอธิบาย                                            | Role          |
|--------|----------------------------|-----------------------------------------------------|---------------|
| GET    | `/api/customers`           | รายการ + credit สรุป                                | any           |
| POST   | `/api/customers`           | เพิ่มลูกค้า                                         | `super_admin` |
| GET    | `/api/customers/[id]`      | รายละเอียด + PO + payments                          | any           |
| PATCH  | `/api/customers/[id]`      | แก้ไข (รวม `credit_score`)                          | `super_admin` |

### Purchase Orders
| Method | Path                              | คำอธิบาย                                         |
|--------|-----------------------------------|--------------------------------------------------|
| GET    | `/api/po?status=&payment_status=` | filter list                                      |
| POST   | `/api/po`                         | สร้าง PO + credit check                          |
| GET    | `/api/po/[id]`                    | detail + items + payments                        |
| **PUT**| **`/api/po/[id]`**                | **แก้ไข PO + บันทึก audit log (block ถ้า paid)**|
| POST   | `/api/po/[id]/status`             | `{status}`                                       |
| POST   | `/api/po/[id]/sign`               | (multipart) อัปโหลดเอกสาร                        |
| GET    | `/api/po/[id]/payments`           | ประวัติการชำระ                                   |
| POST   | `/api/po/[id]/payments`           | บันทึกชำระ + แนบสลิป                             |
| POST   | `/api/po/[id]/invoice`            | สร้างเลข Invoice                                 |

### Dashboard
| Method | Path              | คำอธิบาย                 |
|--------|-------------------|--------------------------|
| GET    | `/api/dashboard`  | สถิติ + 10 PO ล่าสุด + PO เลยกำหนดชำระ |

### Notifications & Cron
| Method | Path                           | คำอธิบาย                           |
|--------|--------------------------------|------------------------------------|
| POST   | `/api/notifications/test`      | ทดสอบ LINE notification           |
| GET    | `/api/cron/check-overdue`       | ทดสอบตรวจสอบลูกค้าเลยกำหนดชำระ    |
| POST   | `/api/cron/check-overdue`       | Cron job endpoint (ต้องมี auth)   |
| GET    | `/api/health`                   | Health check                       |

---

## 📱 Responsive

| Breakpoint | Layout |
|---|---|
| `< 768px` (mobile) | Top bar + **Bottom Nav** (FAB กลม สร้าง PO ตรงกลาง) · Card list |
| `≥ 768px` (desktop) | Sidebar ซ้าย · Table view · ปุ่ม action เต็ม |

---

## 🤖 พร้อมต่อ AI Credit Scoring

Database schema เตรียมไว้ครบ — AI สามารถอัปเดต `credit_score` ผ่าน:

```bash
PATCH /api/customers/[id]
Content-Type: application/json
{ "credit_score": 825, "credit_score_notes": "AI eval: ชำระตรงเวลา 12/12 เดือน" }
```

หรือเรียก service โดยตรงจาก background job ภายใน:

```ts
import { updateCustomer } from "@/backend/services/customers";

await updateCustomer(customerId, {
  credit_score: 825,
  credit_score_notes: "..."
});
```

---

## 🗂️ Database Schema

```
users               (id, username, email, password_hash, role['admin'|'super_admin'])
customers           (id, code, name, credit_limit, credit_score, ...)
purchase_orders     (id, po_number, customer_id, status, payment_status,
                     subtotal, total, paid_amount, remaining_amount,
                     credit_term_days, due_date, signed_doc_path, ...)
po_items            (id, po_id, product_name, quantity, unit_price, line_total)
po_edit_logs        (id, po_id, edited_by, summary, changes JSON, created_at)
payments            (id, po_id, amount, paid_at, method, slip_path, ...)
invoices            (id, invoice_number, po_id, amount, generated_at)
quotations          (id, quote_number, po_id, generated_at)
```

ดูเต็มที่ [`src/backend/schema.sql`](src/backend/schema.sql)

---

## 🛠️ Scripts & Tools

### Development Scripts
```bash
npm run dev      # dev server (http://localhost:3000)
npm run build    # production build
npm start        # serve production
npm run lint     # next lint
```

### Database Scripts
```bash
# Seed mock data ครบทุก status
node src/backend/seed-mock-runner.js

# Sync products data (cron job)
python3 src/backend/sync_products.py
```

### Cron Job Scripts
```bash
# ตรวจสอบลูกค้าเลยกำหนดชำระ (อัตโนมัติ)
./scripts/check-overdue.sh

# ตรวจสอบสถานะ cron jobs
crontab -l
cat /var/log/flowsync-overdue.log
```

---

## 🔧 การแก้ไขปัญหา

### LINE Notification ไม่ทำงาน
1. ตรวจสอบว่า `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_ADMIN_USER_ID` ถูกต้อง
2. ทดสอบด้วย `curl -X POST http://localhost:3000/api/notifications/test`
3. ตรวจสอบ logs ใน console

### Cron Job ไม่ทำงาน
1. ตรวจสอบว่า `CRON_SECRET` ถูกต้อง
2. ตรวจสอบ cron jobs: `crontab -l`
3. ดู logs: `cat /var/log/flowsync-overdue.log`

### Database Connection Error
1. ตรวจสอบว่า XAMPP MySQL ทำงาน: `sudo /opt/lampp/lampp status`
2. ตรวจสอบ credentials ใน `.env.local`
3. ตรวจสอบว่า database `flowsync` มีอยู่

---

## 📖 คู่มือการใช้งาน (User Manual)

คู่มือภาษาไทยอยู่ที่ **`/manual`** (เข้าได้หลัง login):

```
http://localhost:3000/manual
```

- มีปุ่ม **📥 Export PDF** — กดแล้วเรียก print dialog → Save as PDF
- หรือเปิดไฟล์ HTML ตรงๆ ที่ [`public/manual.html`](public/manual.html)
- ธีมสีเขียวเหมือนเว็บ พิมพ์ A4 จัดหน้าให้พร้อม

---

## � เอกสารเพิ่มเติม

- **[`docs/LINE_NOTIFICATION_SETUP.md`](docs/LINE_NOTIFICATION_SETUP.md)** - คู่มือตั้งค่า LINE Official Account
- **[`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md)** - ตัวอย่าง environment variables

---

## �� License

Internal use — Rimping FlowSync project
