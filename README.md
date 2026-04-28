<div align="center">

# 🌿 FlowSync

**ระบบจัดการขายแบบสินเชื่อสำหรับ Rimping**
*Credit-Sales Management System for back-office staff*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com)
[![License](https://img.shields.io/badge/license-Internal-green.svg)](#)

</div>

---

## 📖 ภาพรวม

**FlowSync** คือระบบหลังบ้านสำหรับติดตามและจัดการ **Purchase Order (PO)**
ที่ขายสินค้าให้ลูกค้าแบบสินเชื่อ ครอบคลุมตั้งแต่:

- 📝 **ออก PO** ตรวจวงเงินก่อนออกอัตโนมัติ
- 📦 **ติดตามขั้นตอน** draft → confirmed → packed → checked → delivered → received
- 💵 **ออก Invoice** + บันทึกการชำระบางส่วน/เต็มจำนวน + แนบสลิป
- 📊 **Dashboard** สรุปลูกหนี้คงค้าง, วงเงิน, PO เกินกำหนด
- 🤖 **เตรียม field** Credit Score (0–1000) ไว้รองรับ AI ประเมินภายหลัง

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 |
| **Backend** | Next.js API Routes · `mysql2` (pool + transactions) |
| **Database** | MySQL 8 (XAMPP @ `/opt/lampp`) |
| **Auth** | bcryptjs + JWT (httpOnly cookie via `jose`) |
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
│   │       └── files/[category]/[name]/   # serve uploaded slips/docs
│   │
│   ├── backend/                      # ⚙️ BACKEND ONLY (private)
│   │   ├── db.ts                     # mysql2 pool + tx helpers
│   │   ├── auth.ts                   # bcrypt + JWT cookie
│   │   ├── upload.ts                 # multipart file upload
│   │   ├── services/
│   │   │   ├── customers.ts
│   │   │   ├── po.ts
│   │   │   ├── payments.ts
│   │   │   └── dashboard.ts
│   │   ├── schema.sql                # โครงตาราง
│   │   └── seed-mock.sql             # ข้อมูลตัวอย่างครบทุก status
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
├── public/uploads/                   # uploaded files (gitignored)
├── .env.local                        # DB / JWT_SECRET / UPLOAD_DIR
└── README.md
```

---

## 🚀 เริ่มใช้งาน

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า environment

`.env.local` (มีไฟล์ตัวอย่างให้แล้ว):

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=flowsync
JWT_SECRET=change-me-in-production-please-use-a-long-random-string
UPLOAD_DIR=public/uploads
```

### 3. สร้าง database

```bash
# ใช้ MySQL ของ XAMPP
sudo /opt/lampp/bin/mysql -uroot < src/backend/schema.sql

# (ทางเลือก) seed mock data ครบทุก status
node -e "const m=require('mysql2/promise'),f=require('fs');\
m.createConnection({host:'127.0.0.1',user:'root',database:'flowsync',multipleStatements:true})\
.then(c=>c.query(f.readFileSync('src/backend/seed-mock.sql','utf8')).then(()=>c.end()))"
```

### 4. รัน

```bash
npm run dev          # → http://localhost:3000
# production
npm run build && npm start
```

### 5. เข้าสู่ระบบ

| Username | Password    | Role  |
|----------|-------------|-------|
| `admin`  | `admin1234` | admin |

> 🔐 ระบบ**ไม่มี**การลงทะเบียนสำหรับลูกค้า เป็นระบบหลังบ้านอย่างเดียว
> ใช้ `/register` (เข้าจาก /login) สร้างบัญชีพนักงานเพิ่มเติม

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
| Method | Path                       | คำอธิบาย                       |
|--------|----------------------------|--------------------------------|
| GET    | `/api/customers`           | รายการ + credit สรุป           |
| POST   | `/api/customers`           | เพิ่มลูกค้า                    |
| GET    | `/api/customers/[id]`      | รายละเอียด + PO + payments     |
| PATCH  | `/api/customers/[id]`      | แก้ไข (รวม `credit_score`)     |

### Purchase Orders
| Method | Path                              | คำอธิบาย                   |
|--------|-----------------------------------|----------------------------|
| GET    | `/api/po?status=&payment_status=` | filter list                |
| POST   | `/api/po`                         | สร้าง PO + credit check    |
| GET    | `/api/po/[id]`                    | detail + items + payments  |
| POST   | `/api/po/[id]/status`             | `{status}`                 |
| POST   | `/api/po/[id]/sign`               | (multipart) อัปโหลดเอกสาร  |
| GET    | `/api/po/[id]/payments`           | ประวัติการชำระ             |
| POST   | `/api/po/[id]/payments`           | บันทึกชำระ + แนบสลิป       |
| POST   | `/api/po/[id]/invoice`            | สร้างเลข Invoice           |

### Dashboard
| Method | Path              | คำอธิบาย                 |
|--------|-------------------|--------------------------|
| GET    | `/api/dashboard`  | สถิติ + 10 PO ล่าสุด     |

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
users               (id, username, email, password_hash, role)
customers           (id, code, name, credit_limit, credit_score, ...)
purchase_orders     (id, po_number, customer_id, status, payment_status,
                     subtotal, total, paid_amount, remaining_amount,
                     credit_term_days, due_date, signed_doc_path, ...)
po_items            (id, po_id, product_name, quantity, unit_price, line_total)
payments            (id, po_id, amount, paid_at, method, slip_path, ...)
invoices            (id, invoice_number, po_id, amount, generated_at)
```

ดูเต็มที่ [`src/backend/schema.sql`](src/backend/schema.sql)

---

## 🛠️ Scripts

```bash
npm run dev      # dev server (http://localhost:3000)
npm run build    # production build
npm start        # serve production
npm run lint     # next lint
```

---

## 📝 License

Internal use — Rimping FlowSync project
