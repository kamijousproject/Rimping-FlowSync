# FlowSync v2 — เอกสารสรุปโปรเจคเพื่อเริ่มระบบใหม่

> เอกสารนี้สรุประบบ FlowSync เวอร์ชันปัจจุบัน (v1) ทั้งหมด พร้อมระบุปัญหาเชิงโครงสร้างที่เป็นเหตุผลให้ต้องทำใหม่ และข้อเสนอสถาปัตยกรรมสำหรับ v2 ที่เชื่อมต่อ JDA ผ่าน API โดยตรง
>
> จัดทำ: 21/09/2026 · อ้างอิงจากโค้ดจริงใน repo `/home/aiadmin/FlowSync` (branch `main`, commit `55b141b`)

---

## 1. เหตุผลที่ต้องทำใหม่

### 1.1 ปัญหาหลัก: ระบบขายสองชุดที่ไม่คุยกัน

FlowSync v1 เป็น **ระบบขายแยกต่างหาก** จากหน้างานจริง หน้างานขายผ่าน **JDA (ERP)** แต่ FlowSync เก็บข้อมูลการขาย ราคา และยอดหนี้ไว้ในฐานข้อมูล MySQL ของตัวเอง ทำให้เกิด:

| ปัญหา | ผลกระทบจริง |
|---|---|
| ราคาในระบบไม่ตรงกับหน้าร้าน | ตรวจพบวันที่ 21/09/2026: SKU `100000425` (ซอสพริกไฮนซ์ 300ก) ระบบขาย 25 บาท ป้ายหน้าร้าน 33 บาท / SKU `100000431` (ซอสมะเขือเทศไฮนซ์ 300ก) ระบบ 24 บาท ป้าย 33 บาท |
| สต็อกไม่ใช่ของจริง | ตาราง `inventory` sync วันละครั้ง แล้วหักยอดขายของวันนั้นเองแบบประมาณการ (`get_today_sales()` ใน `sync_products.py`) |
| ยอดหนี้อยู่คนละที่ | FlowSync คิด `remaining_amount` เอง แต่ลูกหนี้จริงอยู่ใน JDA AR |
| การ sync เข้า JDA ใช้ RPA bot | บอทกดหน้าจอแทนคน ใช้เวลา ~5 นาทีต่อรายการ ล้มเหลวเงียบได้ ไม่มี rollback |

### 1.2 ขนาดของปัญหาราคา (วัดจากฐานข้อมูลจริง)

```
products ทั้งหมด                     172,236 SKU
ราคา current_start < 2020            103,090 SKU  (60%)
  └─ เกือบทั้งหมดเป็น price_use='Chain' ลงวันที่ 2014-07-01
SKU ที่ขายใน HoReCa (มีใน inventory)   4,393 SKU
  └─ ราคาเก่ากว่าปี 2020                  319 SKU  ← ขายต่ำกว่าป้าย เสียมาร์จิ้นทุกใบ
```

สาเหตุยืนยันแล้วว่า **ไม่ใช่บั๊กในโค้ด**: sync log อ่าน CSV ได้ 172,236 แถว ตารางมี 172,236 SKU ไม่ซ้ำ → ไม่มีแถวถูกทับ ไฟล์ `price-event-store-500.csv` ที่ JDA export ออกมาส่งราคา Chain เก่ามาเองตั้งแต่ต้นทาง

**สรุป:** ตราบใดที่ราคายังมาจากไฟล์ CSV วันละครั้ง ระบบจะขายผิดราคาต่อไป นี่คือเหตุผลหลักที่ v2 ต้องอ่านราคาจาก JDA API แบบ realtime

### 1.3 สิ่งที่เปลี่ยนไปแล้ว

ปัจจุบัน **มี API เชื่อมต่อ JDA แล้ว** — ข้อจำกัดที่ทำให้ v1 ต้องพึ่ง CSV + RPA bot หมดไป v2 จึงออกแบบใหม่ได้โดยให้ JDA เป็น source of truth

---

## 2. ระบบปัจจุบัน (v1) — สรุปแบบละเอียด

### 2.1 Tech stack

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Next.js 16.2.4 (App Router) + React 19.2.4 |
| ภาษา | TypeScript 5 |
| UI | Tailwind CSS 4, lucide-react, chart.js / react-chartjs-2 / recharts |
| Database | MySQL 8 (XAMPP) ผ่าน `mysql2` connection pool |
| Auth | JWT (`jose` HS256) ใน httpOnly cookie `fs_session`, รหัสผ่าน `bcryptjs` |
| Validation | `zod` |
| แจ้งเตือน | `@line/bot-sdk` (LINE Messaging API), `nodemailer` + `resend` (อีเมล) |
| Sync ราคา/สต็อก | Python (`google-api-python-client`) ดึง CSV จาก Google Drive |
| JDA integration | FastAPI RPA bot แยก service (`backend/rpa_mock.py`) |
| Test | **ไม่มี** (ติดตั้ง Playwright ไว้แต่ไม่มี test suite และไม่มี `npm test`) |

### 2.2 โครงสร้างไดเรกทอรี

```
src/
├── app/
│   ├── (app)/                  หน้าที่ต้อง login (มี sidebar + bottom nav)
│   ├── login/ register/        หน้าสาธารณะ
│   ├── credit-approval/[token] หน้าอนุมัติวงเงินผ่านลิงก์ (สาธารณะ)
│   └── api/.../route.ts        REST API ทั้งหมด (41 endpoints)
├── backend/                    โค้ดฝั่ง server เท่านั้น — import ได้จาก route handler เท่านั้น
│   ├── db.ts                   getPool() / query() / exec() / withTx()
│   ├── auth.ts                 JWT, bcrypt, session cookie, role check
│   ├── upload.ts               บันทึกไฟล์แนบ
│   ├── schema.sql              schema หลัก (381 บรรทัด)
│   ├── migrations/*.sql        migration แบบรันมือ
│   ├── sync_products.py        sync ราคา+สต็อกจาก Google Drive CSV (490 บรรทัด)
│   └── services/*.ts           business logic แยกตาม domain (12 ไฟล์ ~3,600 บรรทัด)
├── components/                 UI ที่ใช้ร่วม (Sidebar, BottomNav, StatusBadge, JdaProgress, ThaiDateInput, ...)
├── lib/bahtText.ts             แปลงตัวเลขเป็นคำอ่านภาษาไทย (ใช้ในเอกสาร)
└── proxy.ts                    Edge auth guard (Next 16 เปลี่ยนชื่อจาก middleware → proxy)

backend/                        Python FastAPI RPA bot (คนละระบบกับ src/backend)
scripts/                        shell/node script (cron overdue, migration ครั้งเดียว)
docs/                           เอกสารส่งมอบลูกค้า, flowchart, spec
```

**หลักการที่ยึดไว้ใน v1 และควรยึดต่อใน v2:** frontend กับ backend คุยกันผ่าน HTTP เท่านั้น ไม่มี import ข้ามฝั่ง เพื่อให้ต่อ AI/บริการภายนอกทีหลังได้

### 2.3 โมดูลและฟีเจอร์ทั้งหมด

#### A. Authentication & Users
- Login ด้วย username หรือ email → JWT ใน cookie `fs_session`
- 2 บทบาทเท่านั้น: `admin`, `super_admin`
  - `admin` — ทำได้ทุกอย่างยกเว้นเพิ่ม/แก้ไขลูกค้า และแก้วงเงิน
  - `super_admin` — ทำได้ทุกอย่าง รวมถึงจัดการผู้ใช้
- **สิทธิ์ชั่วคราว** (`temp_role_grants`) — ยก admin เป็น super_admin ชั่วคราวตาม `expires_at`
- Edge guard (`src/proxy.ts`) redirect หน้า HTML ที่ไม่มี token ไป `/login` ส่วน API ตรวจสิทธิ์รายเส้นทางด้วย `requireUser()` / `requireRole()`

#### B. Customer Management
- CRUD ลูกค้า (สร้าง/แก้ไข/ลบ = super_admin เท่านั้น) — ปัจจุบันมีลูกค้าจริง **89 ราย**
- ฟิลด์: `code`, `name`, `contact_person`, `phone`, `email`, `tax_id`, `address`, `credit_limit`, `default_credit_term_days` (default 30), `billing_note_due_days` (default 5)
- ช่อง `credit_score` / `credit_score_notes` เตรียมไว้สำหรับ AI scoring ในอนาคต — ยังไม่ใช้งาน
- แนบไฟล์เอกสารลูกค้าได้หลายไฟล์ (`customer_files`)
- Audit log ทุกการแก้ไข (`customer_edit_logs`) เก็บ before/after เป็น JSON
- กราฟประวัติการใช้วงเงิน (`getCreditUsageHistory`)

#### C. Credit Management (ซับซ้อนที่สุดใน v1)
วงเงินที่ใช้ได้จริงคำนวณจาก 3 ชั้นซ้อนกัน:

```
วงเงินที่ใช้ได้ = credit_limit (ฐาน)
               + temp_credit_limits.extra_amount (วงเงินชั่วคราวที่ active ตามช่วงวันที่)
               + ยอดคงเหลือของ customer_credit_notes (เครดิตจากการชำระเกิน)
```

- **ปรับวงเงินถาวร** → บันทึก delta ลง `credit_limit_adjustments` + แจ้ง LINE
- **วงเงินชั่วคราว** → `temp_credit_limits` มี `start_date`/`end_date`/`is_active`
- **ขออนุมัติวงเงิน** (`credit_limit_requests`) → สร้างคำขอ → ส่งอีเมลหาผู้จัดการพร้อม `approval_token` → ผู้จัดการกดลิงก์ `/credit-approval/[token]` อนุมัติ/ปฏิเสธได้โดยไม่ต้อง login
- ยอดคงค้าง = `SUM(remaining_amount)` ของ PO ที่ไม่ถูกยกเลิก

#### D. Purchase Order (PO)
**วงจรสถานะ:**
```
draft → confirmed → packed → checked → delivered → received
                                                      └→ ล็อก แก้ไม่ได้
cancelled: ยกเลิกได้ทุกขั้นก่อน received
payment_status: unpaid → partial → paid (แยกจาก status)
```

- เลขที่รูปแบบ `PO{YYYYMM}-{NNNN}` สร้างจาก `COUNT(*)` ของเดือนนั้น
- **ตรวจวงเงินฝั่ง server ก่อนสร้าง PO เสมอ** — ไม่เชื่อ client (กฎสำคัญที่ต้องคงไว้)
- สร้าง PO แล้ว **หักเครดิตโน๊ตของลูกค้าอัตโนมัติ** (ใบเก่าก่อน) ลด `remaining_amount`
- เมื่อถึง `delivered` → `due_date = วันนี้ + credit_term_days`
- แก้ไข PO ได้ตราบใดที่ยังไม่ชำระครบ ทุกครั้งเขียน `po_edit_logs` พร้อม before/after
- แนบไฟล์เอกสารเซ็นรับของได้หลายไฟล์ (`signed_doc_path` เก็บเป็น list)
- บันทึกเลขใบกำกับภาษี (`tax_invoice_number`) แยกจากเลข PO
- เลือกสินค้าจาก catalog ได้ด้วย SKU / บาร์โค้ด UPC / ชื่อสินค้า (FULLTEXT) — ราคาเติมอัตโนมัติจาก `products.current_price` **แต่แก้มือได้**
- ตรวจสต็อกจากตาราง `inventory` ก่อนขาย (`checkStockAvailability`)

#### E. Payments
- รับชำระหลายงวดต่อ 1 PO แนบสลิปได้
- ทุกการบันทึกชำระทำใน transaction เดียว (`withTx`) + `SELECT ... FOR UPDATE` ล็อกแถว PO
- คำนวณ `paid_amount` / `remaining_amount` / `payment_status` / `fully_paid_at` ใหม่ทุกครั้ง
- **ชำระเกิน** → บังคับให้เลือกวิธีจัดการ: เก็บเป็นเครดิต (`keep_as_credit`) หรือโอนคืน (`refund_to_customer`) → ออกเลข `CCN{YYMM}-{NNNN}`
- แก้ไข/ลบรายการชำระได้ พร้อมคำนวณยอดใหม่

#### F. เอกสาร (พิมพ์/PDF ผ่านหน้าเว็บ)
| เอกสาร | รูปแบบเลขที่ | หมายเหตุ |
|---|---|---|
| ใบเสนอราคา (Quotation) | `QT{YYYYMM}-{NNNN}` | สร้างอัตโนมัติครั้งแรกที่เปิดดู |
| ใบแจ้งหนี้ (Invoice) | `INV{YYYYMM}-{NNNN}` | แปลงจากเลข PO |
| ใบวางบิล (Billing Note) | `BN...` | รวมหลาย PO ของลูกค้ารายเดียว + อัปเดต due_date ของทุก PO ในใบ |
| ใบลดหนี้ (Credit Note) | `CN{YYYYMM}-{NNNN}` | ออกได้เฉพาะ PO สถานะ `received` เท่านั้น |
| เครดิตโน๊ตลูกค้า | `CCN{YYMM}-{NNNN}` | เกิดจากการชำระเกิน |
| ใบเสร็จ (Receipt) | — | หน้าแสดงรายการชำระ |

- ทุกเอกสารมีตัวเลขเป็นคำอ่านภาษาไทย (`lib/bahtText.ts`)
- Invoice บันทึก log ทุกครั้งที่ดู/ดาวน์โหลด/พิมพ์ (`invoice_logs` เก็บ IP + user agent)

#### G. Dashboard
ยอดลูกค้า / ลูกหนี้ / ยอดค้างรวม / วงเงินรวม / PO แยกตามสถานะ / PO เกินกำหนด 10 อันดับแรก

#### H. Notifications & Cron
- **LINE** (`@line/bot-sdk`) — แจ้งเตือน 6 เหตุการณ์: ลูกค้าเกินกำหนดชำระ, ลูกค้าใหม่, ลบลูกค้า, ให้วงเงินชั่วคราว, ยกเลิกวงเงินชั่วคราว, แก้วงเงิน
- แจ้งลูกค้าเกินกำหนดเฉพาะวันที่ **3, 7, 14, 30** วันหลังครบกำหนด
- `GET /api/cron/check-overdue` ป้องกันด้วย `CRON_SECRET` เรียกจาก `scripts/check-overdue.sh` บน crontab
- **อีเมล** — ส่งลิงก์อนุมัติวงเงินหาผู้จัดการ (Resend หรือ SMTP)
- **Sync ราคา/สต็อก** — `sync_products.py` ตี 2 ทุกวัน

#### I. JDA Sync ผ่าน RPA bot (ของเดิม — v2 จะเลิกใช้)
```
POST /api/po/[id]/jda-trigger  → POST {function_id: 1, data} ไปที่ RPA_BOT_URL/rpa/trigger
                                → เก็บ job_id ลง purchase_orders.jda_job_id
GET  /api/po/[id]/jda-status   → poll /rpa/jobs/{job_id} จนได้ jda_po_number
```
- `function_id: 1` = สร้าง PO ใน JDA / `function_id: 2` = ตัดยอดชำระ
- Mock จำลองดีเลย์ 5 นาที มี progress 5 ขั้น
- Guard: PO ต้องเป็น `confirmed` และยังไม่เคย sync

### 2.4 ฐานข้อมูล — 24 ตาราง

| กลุ่ม | ตาราง | หน้าที่ |
|---|---|---|
| ผู้ใช้ | `users`, `temp_role_grants` | บัญชีพนักงาน, สิทธิ์ชั่วคราว |
| ลูกค้า | `customers`, `customer_files`, `customer_edit_logs` | ข้อมูลลูกค้า, ไฟล์แนบ, audit |
| วงเงิน | `credit_limit_adjustments`, `credit_limit_requests`, `temp_credit_limits` | ปรับวงเงิน, คำขออนุมัติ, วงเงินชั่วคราว |
| ขาย | `purchase_orders`, `po_items`, `po_edit_logs` | PO, รายการสินค้า, audit |
| ชำระเงิน | `payments`, `invoices`, `invoice_logs` | งวดชำระ, ใบแจ้งหนี้, log การใช้เอกสาร |
| เอกสาร | `quotations`, `billing_notes`, `billing_note_items` | ใบเสนอราคา, ใบวางบิล |
| ลดหนี้ | `credit_notes`, `credit_note_items`, `credit_note_logs` | ใบลดหนี้ + audit |
| เครดิตลูกค้า | `customer_credit_notes`, `customer_credit_note_usages` | เครดิตจากชำระเกิน + ประวัติการใช้ |
| Catalog | `products`, `inventory` | ราคา (172,236 SKU), สต็อก (4,676 SKU) |

**ปริมาณข้อมูลจริง ณ 21/09/2026:** ลูกค้า 89 · ผู้ใช้ 8 · PO 2 · payments 0 · billing_notes 2 · products 172,236 · inventory 4,676
→ ข้อมูลธุรกรรมแทบยังไม่มี **การย้ายไป v2 จึงแทบไม่มีต้นทุน migration** ย้ายแค่ลูกค้า 89 ราย + ผู้ใช้ 8 คนก็พอ

### 2.5 API ทั้งหมด (41 endpoints)

<details>
<summary>รายการเต็ม</summary>

```
Auth        /api/auth/login  /logout  /me  /register
            /api/auth/users/[id]  /api/auth/users/[id]/temp-role
Customers   /api/customers  /api/customers/[id]
            /api/customers/[id]/credit  /temporary-credit  /logs  /files  /pos
            /api/customers/[id]/credit-notes
            /api/customers/[id]/billing-notes  /billing-notes/[bnId]
PO          /api/po  /api/po/[id]  /api/po/[id]/status  /sign  /tax-invoice
            /api/po/[id]/invoice  /credit-notes  /credit-notes/[cnId]
            /api/po/[id]/payments  /payments/[paymentId]
JDA         /api/po/[id]/jda-trigger  /jda-status
            /api/po/[id]/payments/[paymentId]/jda-trigger  /jda-status
Docs        /api/invoices  /api/invoices/[id]  /api/invoices/[id]/logs
Catalog     /api/products  /api/inventory/check
Other       /api/dashboard  /api/health  /api/files/[category]/[name]
            /api/cron/check-overdue  /api/notifications/test
            /api/credit-approval/[token]
```
</details>

### 2.6 Environment variables

```
DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
JWT_SECRET
UPLOAD_DIR
NEXT_PUBLIC_BASE_URL
LINE_CHANNEL_ACCESS_TOKEN  LINE_ADMIN_USER_ID  LINE_USE_BROADCAST
CRON_SECRET
RPA_BOT_URL                          ← v2 จะแทนด้วย JDA API config
RESEND_API_KEY  RESEND_FROM_EMAIL  MANAGER_EMAIL  MANAGER_USER_ID
SMTP_HOST  SMTP_PORT  SMTP_USER  SMTP_PASS
```

### 2.7 คำสั่งที่ใช้งาน

```bash
npm run dev      # dev server → http://localhost:3000
npm run build    # production build
npm start        # serve production
npm run lint     # eslint

sudo /opt/lampp/bin/mysql -uroot < src/backend/schema.sql   # สร้าง schema
node src/backend/seed-mock-runner.js                        # seed ข้อมูลทดสอบ
python3 src/backend/sync_products.py                        # sync ราคา+สต็อก
cd backend && uvicorn rpa_mock:app --port 8001 --reload     # mock JDA bot
```

Login เริ่มต้น: `admin` / `Admin@123` · `superadmin` / `SuperAdmin@123`

---

## 3. หนี้ทางเทคนิคของ v1 (สิ่งที่ห้ามทำซ้ำใน v2)

| # | ปัญหา | รายละเอียด | ความเสี่ยง |
|---|---|---|---|
| 1 | **ราคา/สต็อกเป็นสำเนาค้างวัน** | CSV จาก Google Drive วันละครั้ง 60% ของ catalog ราคาค้างตั้งแต่ปี 2014 | สูงมาก — ขายผิดราคาแล้วจริง |
| 2 | **ยอดหนี้อยู่ 2 ที่** | FlowSync คิดเอง JDA ก็คิดของตัวเอง ไม่มีการกระทบยอด | สูง |
| 3 | **RPA bot กดหน้าจอแทน API** | ใช้เวลา 5 นาที/รายการ ไม่มี transaction ไม่มี retry ที่ปลอดภัย | สูง |
| 4 | **เลขเอกสารสร้างจาก `COUNT(*)`** | `generatePoNumber()` / `generateQuoteNumber()` — สองคนกดพร้อมกันได้เลขชนกัน ถ้ามีใบถูกลบเลขจะย้อน | กลาง–สูง |
| 5 | **ไม่มีเทสต์เลย** | ติดตั้ง Playwright ไว้แต่ไม่มี suite ไม่มี `npm test` ตรรกะเงินทั้งหมดไม่มีอะไรคุ้ม | สูง |
| 6 | **migration รันมือ** | SQL กระจายใน 2 โฟลเดอร์ ไม่มี framework ไม่มีลำดับ ไม่มี rollback — `schema.sql` ไม่ตรงกับ DB จริงแล้ว (ขาด `billing_notes`, `temp_role_grants`, `tax_invoice_number`, ฟิลด์ JDA) | กลาง |
| 7 | **สต็อกหักแบบประมาณการ** | `sync_products.py` หักยอดขายของวันออกจาก on_hand เอง | กลาง |
| 8 | **ตรรกะเครดิตซ้อน 3 ชั้น** | ฐาน + ชั่วคราว + เครดิตโน๊ต กระจายหลายไฟล์ ไม่มีจุดคำนวณเดียว | กลาง |
| 9 | **ไฟล์แนบเก็บบนดิสก์เครื่องเดียว** | `UPLOAD_DIR` ไม่มี backup ไม่ scale | กลาง |
| 10 | **ไฟล์หน้าใหญ่เกิน** | `PoActions.tsx` 1,157 บรรทัด · `customers.ts` 1,149 บรรทัด | ต่ำ–กลาง |

---

## 4. ข้อเสนอสถาปัตยกรรม v2

### 4.1 หลักการ: JDA เป็นเจ้าของข้อมูลการขาย FlowSync เป็นเจ้าของข้อมูลเครดิต

```
┌─────────────────────── JDA (ERP) — source of truth ───────────────────────┐
│  สินค้า · ราคา · สต็อก · การขายหน้าร้าน · ลูกหนี้ AR · ใบกำกับภาษี        │
└──────────────────────────────┬────────────────────────────────────────────┘
                               │  JDA API (realtime)
┌──────────────────────────────┴────────────────────────────────────────────┐
│  FlowSync v2 — ชั้นบริหารเครดิต                                            │
│  วงเงินและการอนุมัติ · เงื่อนไขเครดิต · ใบวางบิล · ติดตามหนี้ · แจ้งเตือน   │
│  เอกสารขาย/เอกสารลดหนี้ · audit trail · dashboard ความเสี่ยง               │
└───────────────────────────────────────────────────────────────────────────┘
```

**กฎ:** อะไรที่ JDA รู้ดีกว่า **ห้ามเก็บสำเนาไว้ตัดสินใจ** — เรียก API ทุกครั้งที่ต้องใช้ตัวเลขจริง (ราคา สต็อก ยอดหนี้) เก็บได้เฉพาะ snapshot เพื่อ audit ว่า ณ เวลานั้นเห็นตัวเลขอะไร

### 4.2 สิ่งที่เปลี่ยนจาก v1

| ของเดิม v1 | ของใหม่ v2 |
|---|---|
| `sync_products.py` + Google Drive CSV | เรียก JDA API ตอนค้นหาสินค้า (+ cache สั้น ๆ ระดับนาที ไม่ใช่วัน) |
| ตาราง `products` 172,236 แถว | ไม่เก็บ catalog เอง หรือเก็บแค่ index สำหรับ autocomplete แล้ว **ยืนยันราคาจาก API ตอนสร้างบิลเสมอ** |
| ตาราง `inventory` sync วันละครั้ง | เช็คสต็อกจาก JDA API ตอนขาย |
| RPA bot (`backend/rpa_mock.py`, `/rpa/trigger`) | เรียก JDA API ตรง — ได้ผลทันที มี error ชัดเจน |
| `jda_job_id` + polling + `JdaProgress.tsx` | ตอบกลับทันที (หรือ webhook ถ้า API เป็น async) |
| `remaining_amount` คำนวณเอง | กระทบยอดกับ AR ของ JDA เป็นงวด |
| เลขเอกสารจาก `COUNT(*)` | ตารางลำดับเลขเฉพาะ + row lock หรือใช้เลขจาก JDA |
| ไม่มีเทสต์ | เทสต์คลุมตรรกะเงินทั้งหมดตั้งแต่วันแรก |

### 4.3 สิ่งที่ควรยกมาใช้ซ้ำได้เลย

โค้ดกลุ่มนี้ไม่เกี่ยวกับ JDA แก้ปัญหาที่ตัวเองแก้ได้ดีอยู่แล้ว:

- `src/backend/db.ts` — pool + `withTx()` (44 บรรทัด ใช้ได้เลย)
- `src/backend/auth.ts` + `src/app/api/_helpers.ts` + `src/proxy.ts` — auth ทั้งชุด
- `src/lib/bahtText.ts` — คำอ่านภาษาไทย
- Layout/เอกสารพิมพ์ทั้งหมด (ใบเสนอราคา ใบแจ้งหนี้ ใบวางบิล ใบลดหนี้) — ปรับแต่งมานาน
- `src/backend/services/notifications.ts` — LINE templates ภาษาไทย
- ตรรกะวงเงินและการอนุมัติ (`credit_limit_requests` + หน้า `/credit-approval/[token]`)
- Schema กลุ่มลูกค้า/เครดิต/เอกสาร — ออกแบบไว้ดีแล้ว

### 4.4 สิ่งที่ควรทิ้ง

- `backend/` ทั้งโฟลเดอร์ (RPA bot + Playwright automation)
- `src/backend/sync_products.py`
- ตาราง `products`, `inventory` (หรือลดบทบาทเหลือ cache)
- endpoint `jda-trigger` / `jda-status` ทั้ง 4 เส้น และคอลัมน์ `jda_job_id`
- component `JdaProgress.tsx`
- `RPA_BOT_URL` และ dependency `google-api-python-client`

---

## 5. คำถามที่ต้องเคลียร์กับทีม JDA ก่อนเริ่ม

เอกสารนี้ตอบแทนไม่ได้ ต้องได้คำตอบก่อนออกแบบ schema v2:

1. **ราคา** — API คืนราคาขายจริงที่หน้าร้านใช้หรือไม่ (ที่ป้ายพิมพ์ 33 บาท) แยก price level (Chain/Zone/Store) อย่างไร ราคาลูกค้า HoReCa เป็นคนละ level กับหน้าร้านหรือเปล่า
2. **สินค้า** — ค้นหาด้วย SKU / UPC / ชื่อ ได้ไหม รองรับ pagination และ throughput เท่าไร
3. **สต็อก** — อ่านได้ realtime ไหม จองสต็อก (reserve/allocate) ได้หรือไม่
4. **การขาย** — สร้างบิล/ใบสั่งขายใน JDA ผ่าน API ได้เลยไหม ได้เลขใบกำกับภาษีกลับมาไหม ยกเลิก/แก้ไขได้ไหม
5. **ลูกหนี้ (AR)** — ดึงยอดหนี้คงค้างต่อลูกค้าได้ไหม บันทึกการรับชำระเข้า JDA ได้ไหม ตัดยอดอย่างไร
6. **ลูกค้า** — customer master อยู่ที่ JDA หรือ FlowSync ถ้าอยู่ที่ JDA วงเงินเครดิตเก็บฝั่งไหน
7. **เทคนิค** — REST/SOAP? auth แบบไหน (API key/OAuth)? rate limit? มี sandbox ให้เทสต์ไหม? sync หรือ async (ถ้า async มี webhook ไหม)? SLA และพฤติกรรมตอน JDA ล่ม?
8. **โหมดออฟไลน์** — ถ้า JDA ล่มระหว่างวัน FlowSync ต้องรับออเดอร์ต่อได้ไหม หรือหยุดขาย

> ข้อ 1 และ 5 เป็นตัวตัดสินสถาปัตยกรรม ถ้า AR ดึงได้ FlowSync ไม่ต้องเก็บยอดหนี้เองเลย เหลือแค่ชั้นวงเงิน+เอกสาร ซึ่งจะเล็กลงมาก

---

## 6. ข้อเสนอลำดับงาน v2

| เฟส | งาน | ผลลัพธ์ |
|---|---|---|
| 0 | เคลียร์คำถามข้อ 5 กับทีม JDA + ขอ sandbox | สัญญา API ชัดเจน |
| 1 | เขียน client ครอบ JDA API (`src/backend/jda/`) + เทสต์ต่อ sandbox | ชั้นเดียวที่คุยกับ JDA ทั้งระบบ |
| 2 | ค้นหาสินค้า + ราคา realtime แทน `products` table | **ปิดปัญหาขายผิดราคา** |
| 3 | สร้างบิล/ใบสั่งขายผ่าน API แทน RPA bot | ตัด RPA + ดีเลย์ 5 นาทีทิ้ง |
| 4 | ยกโมดูลเครดิต/วงเงิน/ใบวางบิล/แจ้งเตือนจาก v1 มา (โค้ดพร้อมใช้) | ฟีเจอร์เท่าเดิม |
| 5 | กระทบยอด AR + dashboard ความเสี่ยง | ตัวเลขตรงกับ JDA |
| 6 | ย้ายข้อมูล (ลูกค้า 89 + ผู้ใช้ 8) แล้วตัดระบบเก่า | ระบบเดียว |

เฟส 2 ให้คุณค่าสูงสุดเทียบกับงานที่ทำ — ถ้ามีเวลาจำกัดให้ทำก่อน

---

## 7. ข้อกำหนดที่ห้ามหลุดใน v2

- **ตรวจวงเงินฝั่ง server ก่อนสร้างบิลเสมอ** — ไม่เชื่อ client เด็ดขาด
- **ทุกการดำเนินการเกี่ยวกับเงินอยู่ใน transaction เดียว** (บันทึกชำระ + คำนวณยอดใหม่)
- **ทุกการแก้ไขเขียน audit log** พร้อม before/after
- **UI ข้อความ และเอกสารทั้งหมดเป็นภาษาไทย**
- **ราคาที่ใช้ออกบิลต้องยืนยันจาก JDA ณ เวลาออกบิล** และเก็บ snapshot ไว้ใน audit ว่าใช้ราคาไหน
- **แยก frontend / backend ด้วย HTTP เท่านั้น** เพื่อให้ต่อ AI หรือบริการอื่นได้ภายหลัง

---

## ภาคผนวก: ไฟล์อ้างอิงใน repo เดิม

| หัวข้อ | ไฟล์ |
|---|---|
| ตรรกะสร้าง PO + ตรวจวงเงิน | `src/backend/services/po.ts:84` |
| ตรรกะรับชำระ + ชำระเกิน | `src/backend/services/payments.ts:59` |
| วงเงินที่ใช้ได้จริง | `src/backend/services/customers.ts:1130` |
| ค้นหาสินค้า (SKU/UPC/FULLTEXT) | `src/backend/services/products.ts:15` |
| เรียก RPA bot | `src/app/api/po/[id]/jda-trigger/route.ts` |
| Sync ราคา/สต็อก | `src/backend/sync_products.py` |
| Schema หลัก | `src/backend/schema.sql` |
| เอกสารส่งมอบลูกค้าเดิม | `docs/FlowSync-System-Spec-Client-TH.md` |
