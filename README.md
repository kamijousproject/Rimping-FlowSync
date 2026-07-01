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

> ℹ️ **หมายเหตุการตั้งชื่อ:** ฝั่ง UI จะแสดงคำว่า **"Quotation"** แทน "Purchase Order/PO" ทั่วทั้งระบบ
> แต่โค้ด, database, route, และ REST API (`/api/po/...`) ยังใช้คำว่า `po`/`PO` เหมือนเดิมทั้งหมด
> (เปลี่ยนเฉพาะข้อความที่ผู้ใช้เห็น ไม่กระทบ backend/flow)

- 📝 **ออก PO (แสดงเป็น "Quotation" บนหน้าจอ)** ตรวจวงเงินก่อนออกอัตโนมัติ (server-side)
- 📦 **ติดตามขั้นตอน** draft → confirmed → packed → checked → delivered → received
- 💵 **ออก Invoice / ใบกำกับภาษี** + บันทึกการชำระบางส่วน/เต็มจำนวน + แนบสลิป (พร้อม preview รูป)
- 📄 **ใบเสนอราคา / ใบวางบิล (Billing Note) / ใบลดหนี้ (Credit Note)** ออกเอกสารและพิมพ์ได้ครบ
- ✏️ **แก้ไข PO ได้** ตราบที่ยังไม่ชำระครบ + บันทึก audit log ทุกครั้ง
- 🔐 **Permission 2 ระดับ** — `admin` / `super_admin` (เพิ่ม/แก้ไขลูกค้าเฉพาะ super_admin) + temporary role grant
- 📊 **Dashboard** สรุปลูกหนี้คงค้าง, วงเงิน, PO เกินกำหนด (กราฟด้วย Chart.js)
- 🤖 **LINE Notifications** แจ้งเตือนอัตโนมัติ (ลูกค้าเลยกำหนด, ลูกค้าใหม่, วงเงิน) - รองรับ Single User และ Broadcast Mode
- 🔄 **JDA/ERP Sync** ผ่าน RPA bot ภายนอก (FastAPI แยก service) — ยิง job แบบ async แล้ว poll สถานะ
- 📦 **Sync สินค้า/สต๊อก** รายวันจาก Google Drive (CSV) เข้าตาราง `products`
- 🖨️ **พิมพ์เอกสาร** A4 พร้อมส่งออก PDF (Ctrl+P)
- 📖 **คู่มือการใช้งาน** ภาษาไทยที่ [`/manual`](http://localhost:3000/manual) (export PDF ได้)
- ⏰ **Cron Jobs** ตรวจสอบลูกค้าเลยกำหนดชำระอัตโนมัติ
- 🤖 **เตรียม field** Credit Score (0–1000) ไว้รองรับ AI ประเมินภายหลัง

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 |
| **Backend (TS)** | Next.js API Routes (`src/app/api`) · `mysql2` (pool + transactions) |
| **RPA / JDA Bot** | Python · FastAPI (แยก service, `backend/`) — mock ได้ด้วย `rpa_mock.py` |
| **Database** | MySQL 8 (XAMPP @ `/opt/lampp`) |
| **Auth** | bcryptjs + JWT (httpOnly cookie `fs_session`, signed ด้วย `jose`) |
| **Notifications** | LINE Bot API (@line/bot-sdk) · Cron Jobs |
| **Charts** | Chart.js + react-chartjs-2 |
| **Validation** | zod |
| **UI Icons** | lucide-react |
| **Mobile** | Bottom-tab nav (app-like) + responsive cards |

> ⚠️ **ไม่มี test runner ที่ตั้งค่าไว้** — Playwright ติดตั้งไว้แต่ไม่มี `test` script/test suite อย่าสมมติว่ามี `npm test`

---

## 📂 โครงสร้างโปรเจกต์

> 🎯 **แยก frontend / backend ชัดเจน** — `src/backend/` เข้าถึงได้จาก API route handler เท่านั้น (ผ่าน `@/backend/*`)
> เพื่อให้ต่อ AI หรือ external service ภายหลังได้ง่าย
>
> ⚠️ อย่าสับสน `src/backend/` (TypeScript, private, ใช้ใน Next.js) กับ `backend/` ที่ root
> (Python FastAPI, RPA/JDA bot แยก service คนละตัว คุยกันผ่าน HTTP เท่านั้น)

```
FlowSync/
├── src/
│   ├── app/                          # 🎨 FRONTEND + API (App Router)
│   │   ├── login/                    # public
│   │   ├── register/                 # public (สร้างบัญชีพนักงาน)
│   │   ├── credit-approval/[token]/  # public (ลิงก์อนุมัติวงเงินชั่วคราว)
│   │   ├── (app)/                    # 🔒 protected routes (sidebar/bottomnav)
│   │   │   ├── dashboard/
│   │   │   ├── customers/{,new,[id],[id]/edit,[id]/billing-notes}/
│   │   │   ├── po/{,new,[id],[id]/edit,[id]/invoice,[id]/quotation,[id]/credit-note}/
│   │   │   ├── invoices/{,new}/
│   │   │   ├── receipts/
│   │   │   ├── billing-notes/
│   │   │   └── users/{,new}/
│   │   └── api/                      # 🌐 REST API (HTTP boundary)
│   │       ├── auth/{login,register,logout,me,users/[id]}/
│   │       ├── customers/{,[id],[id]/{files,credit,logs,billing-notes,temporary-credit,credit-notes,pos}}/
│   │       ├── po/{,[id],[id]/{status,sign,payments,invoice,tax-invoice,credit-notes,jda-trigger,jda-status}}/
│   │       ├── invoices/{,[id],[id]/logs}/
│   │       ├── products/, inventory/check/
│   │       ├── dashboard/
│   │       ├── credit-approval/[token]/
│   │       ├── notifications/{test}/
│   │       ├── cron/check-overdue/
│   │       ├── health/
│   │       └── files/[category]/[name]/   # serve uploaded slips/docs
│   │
│   ├── backend/                      # ⚙️ BACKEND ONLY (private, TypeScript)
│   │   ├── db.ts                     # mysql2 pool + tx helpers (getPool/query/exec/withTx)
│   │   ├── auth.ts                   # bcrypt + JWT cookie helpers
│   │   ├── upload.ts                 # multipart file upload
│   │   ├── services/                 # domain logic (one per domain)
│   │   │   ├── po.ts, payments.ts, customers.ts
│   │   │   ├── invoices.ts (quotations.ts), credit-notes.ts, billing-notes.ts
│   │   │   ├── customer-credit-notes.ts, dashboard.ts, inventory.ts, products.ts
│   │   │   ├── notifications.ts      # LINE Bot API service
│   │   │   └── email.ts
│   │   ├── migrations/               # one-off SQL, applied manually
│   │   ├── schema.sql                # โครงตารางทั้งหมด (24 ตาราง)
│   │   ├── seed-mock.sql             # ข้อมูลตัวอย่างครบทุก status
│   │   ├── seed-mock-runner.js       # Node.js script สำหรับ seed data
│   │   └── sync_products.py          # Python: sync สินค้า/สต๊อกจาก Google Drive (CSV)
│   │
│   ├── components/                   # 🎨 shared UI (Sidebar, Navbar, BottomNav, charts, ...)
│   ├── lib/                          # shared helpers (เช่น bahtText.ts)
│   └── proxy.ts                      # 🔑 edge auth guard (Next.js 16 เปลี่ยนชื่อจาก middleware.ts)
│
├── backend/                           # 🐍 RPA / JDA bot — Python FastAPI, แยก service เต็มตัว
│   ├── rpa/                           # ตัว bot จริง (โปรดักชัน)
│   ├── rpa_mock.py                    # mock bot สำหรับ dev/test (จำลอง delay 5 นาที)
│   └── requirements.txt
│
├── migrations/                        # SQL migration เพิ่มเติม (root-level)
│   └── 001_credit_limit_requests.sql
│
├── scripts/                           # 📜 Ops / cron scripts
│   ├── check-overdue.sh               # ตรวจสอบลูกค้าเลยกำหนดชำระ (cron)
│   ├── clear-all-pos.ts
│   ├── migrate-billing-note-due-days.js
│   └── migrate-customer-credit-notes.js
│
├── docs/                              # 📚 เอกสาร
│   ├── LINE_NOTIFICATION_SETUP.md     # คู่มือตั้งค่า LINE
│   ├── ENVIRONMENT_VARIABLES.md       # ตัวอย่าง env variables
│   └── FlowSync-System-Spec-Client-TH.md
│
├── reset-super-admin-password.ts      # ops script: reset password super_admin
├── public/uploads/                    # uploaded files (gitignored)
├── .env.local                         # DB / JWT_SECRET / LINE / RPA / CRON settings (gitignored)
├── flowsync-<project-id>-<key>.json   # 🔑 Google service account (gitignored — ต้อง copy เองตอน deploy)
└── README.md
```

---

## 🚀 การติดตั้งระบบ (Full Setup — สำหรับ deploy environment ใหม่)

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` ที่ root (ดูตัวอย่างใน `docs/ENVIRONMENT_VARIABLES.md`):

```env
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=flowsync

# JWT Secret — เปลี่ยนเป็นค่าสุ่มยาวๆ ก่อนขึ้น production
JWT_SECRET=change-me-in-production

# Upload Directory
UPLOAD_DIR=uploads

# LINE Notification Settings
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_ADMIN_USER_ID=your_admin_user_id_here

# Cron Job Security
CRON_SECRET=change-me-random-secret

# RPA / JDA Bot (external FastAPI service)
RPA_BOT_URL=http://localhost:8001

# Base URL for links in notifications
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

> ⚠️ `.env*` ถูก gitignore ไว้ทั้งหมด — ต้องสร้าง/copy ไฟล์นี้เองที่ environment ใหม่เสมอ ไม่ได้มากับ `git clone`

### 3. ติดตั้งและตั้งค่าฐานข้อมูล

```bash
# สร้างฐานข้อมูล + ตารางทั้งหมด (24 ตาราง)
sudo /opt/lampp/bin/mysql -uroot < src/backend/schema.sql

# ใช้ migration เพิ่มเติมทีละไฟล์ (ไม่มี migration framework, apply เอง)
mysql -uroot flowsync < migrations/001_credit_limit_requests.sql
mysql -uroot flowsync < src/backend/migrations/add_customer_enhancements.sql
mysql -uroot flowsync < src/backend/migrations/add_fully_paid_at.sql
mysql -uroot flowsync < src/backend/migrations/add_jda_fields.sql
mysql -uroot flowsync < src/backend/migrations/add_payment_jda_fields.sql

# ทางเลือก: Seed mock data ครบทุก status (สำหรับ dev/staging เท่านั้น — ข้ามได้ถ้าเป็น production จริง)
node src/backend/seed-mock-runner.js
```

หลัง seed หรือ deploy ครั้งแรก ระบบจะมี user เริ่มต้นตาม default logins ด้านล่าง — ใช้
`reset-super-admin-password.ts` ถ้าต้องการเปลี่ยนรหัสผ่าน `super_admin`:

```bash
npx tsx reset-super-admin-password.ts "NewStrongP@ssw0rd"
```

### 4. Google Service Account (สำหรับ sync สินค้า/สต๊อก)

`src/backend/sync_products.py` ดึงไฟล์ CSV ราคา/สต๊อกจาก Google Drive โดยใช้ service account —
ไฟล์ credential (`flowsync-<project-id>-<key>.json`) เป็นความลับ **ไม่อยู่ใน git**
ต้อง **copy ไฟล์นี้มาวางที่ root ของโปรเจกต์เอง** ตอน deploy environment ใหม่ (ขอจากทีมที่ดูแล Google Cloud project)

ติดตั้ง Python deps (แยกจาก RPA bot):
```bash
pip install mysql-connector-python google-api-python-client google-auth
```

### 5. ตั้งค่า RPA / JDA Bot (แยก service, จำเป็นถ้าใช้ฟีเจอร์ sync JDA)

```bash
cd backend
pip install -r requirements.txt
uvicorn rpa_mock:app --port 8001 --reload   # mock bot (dev) — โปรดักชันใช้ bot จริงใน rpa/
```

ตรวจว่า `RPA_BOT_URL` ใน `.env.local` ชี้มาที่ service นี้ถูกต้อง (`POST /rpa/trigger`, `GET /rpa/jobs/{job_id}`)

### 6. ตั้งค่า LINE Official Account (สำคัญ!)

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

### 7. ตั้งค่า Cron Jobs

```bash
chmod +x scripts/check-overdue.sh
crontab -e
```

เพิ่มบรรทัดเหล่านี้ (แก้ `/path/to/FlowSync` เป็น path จริงของ environment ใหม่):

```bash
# FlowSync Cron Jobs
# ตรวจสอบลูกค้าเลยกำหนดชำระ วันละ 2 ครั้ง 08:00 และ 14:00
0 8,14 * * * /path/to/FlowSync/scripts/check-overdue.sh

# Sync สินค้า/สต๊อกจาก Google Drive ทุกวันตีสอง
0 2 * * * cd /path/to/FlowSync && python3 src/backend/sync_products.py >> /var/log/flowsync-sync.log 2>&1
```

### 8. รันแอปพลิเคชัน

```bash
npm run dev          # → http://localhost:3000
# production
npm run build && npm start
```

### 9. ทดสอบระบบ

```bash
# ทดสอบ LINE notification
curl -X POST http://localhost:3000/api/notifications/test

# ทดสอบ overdue check
curl -X GET http://localhost:3000/api/cron/check-overdue

# ทดสอบ health check
curl -X GET http://localhost:3000/api/health

# ทดสอบ RPA bot (ต้องรัน uvicorn ไว้ก่อน)
curl -X GET http://localhost:8001/health
```

### 10. เข้าสู่ระบบ

| Username     | Password         | Role          | สิทธิ์                                       |
|--------------|------------------|---------------|----------------------------------------------|
| `admin`      | `Admin@123`      | `admin`       | ทุกอย่าง **ยกเว้น** เพิ่ม/แก้ไขลูกค้า       |
| `superadmin` | `SuperAdmin@123` | `super_admin` | ทุกอย่าง รวมถึงเพิ่ม/แก้ไขข้อมูลลูกค้า      |

> 🔐 ระบบ**ไม่มี**การลงทะเบียนสำหรับลูกค้า เป็นระบบหลังบ้านอย่างเดียว
> ใช้ `/register` (เข้าจาก /login) สร้างบัญชีพนักงานเพิ่มเติม
>
> ⚠️ **เปลี่ยนรหัสผ่าน default ทันทีก่อนขึ้น production จริง** (ดู `reset-super-admin-password.ts` ข้อ 3)

---

## 🤖 LINE Notification System

ระบบแจ้งเตือนอัตโนมัติผ่าน LINE Official Account:

### 🚨 **ประเภทการแจ้งเตือน:**

1. **ลูกค้าเลยกำหนดชำระ** (3, 7, 14, 30 วัน)
   - แสดงเลขที่เอกสาร, ชื่อลูกค้า, ยอดค้าง, วันที่เลยกำหนด
   - มีลิงก์ตรงไปดูรายละเอียด

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

## 🔄 PO Lifecycle (แสดงบน UI เป็น "Quotation")

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

- ✅ ตรวจ **credit limit** ก่อนสร้าง PO เสมอ (server-side, ห้าม trust client)
- ✅ เปลี่ยนสถานะ "delivered" → ตั้ง `due_date = today + credit_term_days`
- ✅ ทุกการชำระคำนวณ `paid_amount` / `remaining_amount` ใน transaction เดียว (`withTx`)
- ✅ `cancelled` ใช้ได้ทุก step (ก่อน received) แล้วล็อก
- ✅ แก้ไข PO ได้ (`PUT /api/po/[id]`) เฉพาะตอนยังไม่ชำระครบ + บันทึก audit log ทุกครั้ง

---

## 🌐 REST API

### Authentication & Users
| Method | Path                            | คำอธิบาย                 |
|--------|----------------------------------|--------------------------|
| POST   | `/api/auth/login`               | login → set cookie `fs_session` |
| POST   | `/api/auth/register`            | สร้างผู้ใช้ใหม่          |
| POST   | `/api/auth/logout`              | clear cookie             |
| GET    | `/api/auth/me`                  | current user             |
| GET/PATCH/DELETE | `/api/auth/users/[id]`  | จัดการผู้ใช้ (`super_admin`) |
| POST   | `/api/auth/users/[id]/temp-role`| ให้สิทธิ์ role ชั่วคราว   |

### Customers
| Method | Path                                      | คำอธิบาย                                    | Role          |
|--------|--------------------------------------------|-----------------------------------------------|---------------|
| GET    | `/api/customers`                          | รายการ + credit สรุป                          | any           |
| POST   | `/api/customers`                          | เพิ่มลูกค้า                                   | `super_admin` |
| GET    | `/api/customers/[id]`                     | รายละเอียด + PO + payments                    | any           |
| PATCH  | `/api/customers/[id]`                     | แก้ไข (รวม `credit_score`)                    | `super_admin` |
| GET    | `/api/customers/[id]/files`               | เอกสารแนบของลูกค้า                            | any           |
| GET/PATCH | `/api/customers/[id]/credit`           | วงเงินเครดิต                                  | `super_admin` |
| GET    | `/api/customers/[id]/logs`                | audit log การแก้ไขลูกค้า                      | any           |
| GET/POST | `/api/customers/[id]/billing-notes`     | ใบวางบิลของลูกค้า                             | any           |
| GET/POST | `/api/customers/[id]/billing-notes/[bnId]` | รายละเอียดใบวางบิล                        | any           |
| POST   | `/api/customers/[id]/temporary-credit`    | ขอเพิ่มวงเงินชั่วคราว                          | any           |
| GET/POST | `/api/customers/[id]/credit-notes`      | ใบลดหนี้ของลูกค้า                             | any           |
| GET    | `/api/customers/[id]/pos`                 | รายการ PO ของลูกค้า                            | any           |

### Purchase Orders (Quotation บน UI)
| Method | Path                                       | คำอธิบาย                                         |
|--------|----------------------------------------------|----------------------------------------------------|
| GET    | `/api/po?status=&payment_status=`            | filter list                                        |
| POST   | `/api/po`                                    | สร้าง PO + credit check                            |
| GET    | `/api/po/[id]`                               | detail + items + payments                          |
| **PUT**| **`/api/po/[id]`**                           | **แก้ไข PO + บันทึก audit log (block ถ้า paid)**   |
| POST   | `/api/po/[id]/status`                        | `{status}`                                         |
| POST   | `/api/po/[id]/sign`                          | (multipart) อัปโหลดเอกสาร signed                   |
| GET/POST | `/api/po/[id]/payments`                    | ประวัติ/บันทึกการชำระ + แนบสลิป                     |
| PATCH/DELETE | `/api/po/[id]/payments/[paymentId]`    | แก้ไข/ลบรายการชำระ                                 |
| POST   | `/api/po/[id]/invoice`                       | สร้างเลข Invoice                                   |
| POST   | `/api/po/[id]/tax-invoice`                   | สร้างเลขใบกำกับภาษี                                |
| GET/POST | `/api/po/[id]/credit-notes`                | ใบลดหนี้ของ PO นี้                                  |
| GET/PATCH/DELETE | `/api/po/[id]/credit-notes/[cnId]`   | รายละเอียดใบลดหนี้                                  |
| POST   | `/api/po/[id]/jda-trigger`                   | ยิง sync ไป JDA ผ่าน RPA bot (ต้อง confirmed แล้ว) |
| GET    | `/api/po/[id]/jda-status`                    | poll สถานะ job JDA                                 |
| POST   | `/api/po/[id]/payments/[paymentId]/jda-trigger` | ยิง sync payment ไป JDA                        |
| GET    | `/api/po/[id]/payments/[paymentId]/jda-status`  | poll สถานะ job JDA ของ payment                  |

### Invoices / Products / Inventory
| Method | Path                     | คำอธิบาย                 |
|--------|--------------------------|--------------------------|
| GET/POST | `/api/invoices`        | รายการ / สร้าง invoice   |
| GET    | `/api/invoices/[id]`     | รายละเอียด invoice       |
| GET    | `/api/invoices/[id]/logs`| audit log ของ invoice    |
| GET    | `/api/products`          | รายการสินค้า (sync จาก Google Drive) |
| GET    | `/api/inventory/check`   | เช็คสต๊อกก่อนออก PO      |

### Dashboard & Credit Approval
| Method | Path                          | คำอธิบาย                                  |
|--------|--------------------------------|---------------------------------------------|
| GET    | `/api/dashboard`              | สถิติ + PO ล่าสุด + PO เลยกำหนดชำระ         |
| GET/POST | `/api/credit-approval/[token]` | อนุมัติ/ปฏิเสธคำขอเพิ่มวงเงินผ่านลิงก์ (public) |

### Notifications, Cron & Health
| Method | Path                           | คำอธิบาย                           |
|--------|---------------------------------|-------------------------------------|
| POST   | `/api/notifications/test`      | ทดสอบ LINE notification           |
| GET/POST | `/api/cron/check-overdue`    | ตรวจสอบลูกค้าเลยกำหนดชำระ (ต้องมี `CRON_SECRET`) |
| GET    | `/api/health`                   | Health check                       |

---

## 📱 Responsive

| Breakpoint | Layout |
|---|---|
| `< 768px` (mobile) | Top bar + **Bottom Nav** (FAB กลม สร้าง Quotation ตรงกลาง) · Card list |
| `≥ 768px` (desktop) | Sidebar ซ้าย + Navbar บน · Table view · ปุ่ม action เต็ม |

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

## 🗂️ Database Schema (24 ตาราง)

```
users                          (id, username, email, password_hash, role['admin'|'super_admin'])
temp_role_grants                (id, user_id, granted_role, expires_at, ...)

customers                      (id, code, name, credit_limit, credit_score, ...)
customer_files                 (id, customer_id, file_path, category, ...)
customer_edit_logs             (id, customer_id, edited_by, changes JSON, ...)
credit_limit_adjustments       (id, customer_id, old_limit, new_limit, ...)
credit_limit_requests          (id, customer_id, requested_by, status, ...)
temp_credit_limits              (id, customer_id, extra_amount, expires_at, ...)
customer_credit_notes          (id, customer_id, amount, remaining_amount, ...)
customer_credit_note_usages    (id, credit_note_id, po_id, amount_used, ...)

purchase_orders                (id, po_number, customer_id, status, payment_status,
                                 subtotal, total, paid_amount, remaining_amount,
                                 credit_term_days, due_date, signed_doc_path,
                                 jda_job_id, jda_po_number, ...)
po_items                       (id, po_id, product_name, quantity, unit_price, line_total)
po_edit_logs                   (id, po_id, edited_by, summary, changes JSON, created_at)
payments                       (id, po_id, amount, paid_at, method, slip_path, jda_job_id, ...)

invoices                       (id, invoice_number, po_id, amount, generated_at)
invoice_logs                   (id, invoice_id, action, ...)
quotations                     (id, quote_number, po_id, generated_at)

credit_notes                   (id, cn_number, po_id, amount, reason, ...)
credit_note_items              (id, credit_note_id, description, amount, ...)
credit_note_logs               (id, credit_note_id, action, ...)

billing_notes                  (id, bn_number, customer_id, issued_date, due_date, ...)
billing_note_items             (id, billing_note_id, po_id, po_number, amount, ...)

products                       (id, sku, name, price, ...)          -- sync จาก Google Drive
inventory                      (id, product_id/sku, stock_qty, ...)
```

ดูเต็มที่ [`src/backend/schema.sql`](src/backend/schema.sql) และ migration เพิ่มเติมใน
[`migrations/`](migrations/) กับ [`src/backend/migrations/`](src/backend/migrations/)

---

## 🛠️ Scripts & Tools

### Development Scripts
```bash
npm run dev      # dev server (http://localhost:3000)
npm run build    # production build
npm start        # serve production
npm run lint     # eslint (eslint-config-next)
```

### Database Scripts
```bash
# Seed mock data ครบทุก status (dev/staging เท่านั้น)
node src/backend/seed-mock-runner.js

# Sync สินค้า/สต๊อกจาก Google Drive (cron job, ต้องมี service account json)
python3 src/backend/sync_products.py

# Reset รหัสผ่าน super_admin
npx tsx reset-super-admin-password.ts "NewStrongP@ssw0rd"
```

### RPA / JDA Bot (Python FastAPI, service แยก)
```bash
cd backend
pip install -r requirements.txt
uvicorn rpa_mock:app --port 8001 --reload   # mock — โปรดักชันใช้ bot จริงใน backend/rpa/
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
3. ตรวจสอบว่า database `flowsync` มีอยู่ และรัน migration ครบทุกไฟล์แล้ว

### JDA Sync ไม่ทำงาน / ค้างที่ "syncing"
1. ตรวจสอบว่า RPA bot รันอยู่และ `RPA_BOT_URL` ใน `.env.local` ถูกต้อง
2. ทดสอบ bot ตรงๆ: `curl http://localhost:8001/health`
3. PO ต้องมีสถานะ `confirmed` และยังไม่เคย sync มาก่อนถึงจะยิง `jda-trigger` ได้

### Sync สินค้า/สต๊อกล้มเหลว
1. ตรวจว่ามีไฟล์ Google service account json อยู่ที่ root ของโปรเจกต์ (ไม่ได้มากับ git, ต้อง copy เอง)
2. ตรวจสิทธิ์การเข้าถึง Google Drive folder ของ service account นั้น
3. ดู log: `tail -f /var/log/flowsync-sync.log`

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

## 📖 เอกสารเพิ่มเติม

- **[`docs/LINE_NOTIFICATION_SETUP.md`](docs/LINE_NOTIFICATION_SETUP.md)** - คู่มือตั้งค่า LINE Official Account
- **[`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md)** - ตัวอย่าง environment variables
- **[`docs/FlowSync-System-Spec-Client-TH.md`](docs/FlowSync-System-Spec-Client-TH.md)** - system spec ฉบับเต็ม
- **[`backend/README.md`](backend/README.md)** - รายละเอียด RPA bot (endpoint, flow, config)
- **[`CLAUDE.md`](CLAUDE.md)** / **[`AGENTS.md`](AGENTS.md)** - guideline สำหรับ AI coding agent ที่ทำงานในโปรเจกต์นี้ (สถาปัตยกรรม, กฎ domain, Next.js 16 gotchas)

---

## 📄 License

Internal use — Rimping FlowSync project
