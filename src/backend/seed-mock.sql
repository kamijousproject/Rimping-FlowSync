-- ============================================================
-- FlowSync — Comprehensive Mock Seed
-- Covers: all PO statuses, payments, billing notes, credit notes,
--         credit limit requests/adjustments, temp limits, edit logs
-- Run: /opt/lampp/bin/mysql -u root flowsync < src/backend/seed-mock.sql
-- ============================================================
USE flowsync;

-- ── Clear transactional data (keep users) ───────────────────
DELETE FROM customer_credit_note_usages;
DELETE FROM customer_credit_notes;
DELETE FROM credit_note_logs;
DELETE FROM credit_note_items;
DELETE FROM credit_notes;
DELETE FROM billing_note_items;
DELETE FROM billing_notes;
DELETE FROM invoices;
DELETE FROM quotations;
DELETE FROM payments;
DELETE FROM po_edit_logs;
DELETE FROM po_items;
DELETE FROM purchase_orders;
DELETE FROM customer_edit_logs;
DELETE FROM customer_files;
DELETE FROM temp_credit_limits;
DELETE FROM credit_limit_adjustments;
DELETE FROM credit_limit_requests;
DELETE FROM customers;

ALTER TABLE customers                  AUTO_INCREMENT = 1;
ALTER TABLE purchase_orders            AUTO_INCREMENT = 1;
ALTER TABLE po_items                   AUTO_INCREMENT = 1;
ALTER TABLE payments                   AUTO_INCREMENT = 1;
ALTER TABLE invoices                   AUTO_INCREMENT = 1;
ALTER TABLE billing_notes              AUTO_INCREMENT = 1;
ALTER TABLE billing_note_items         AUTO_INCREMENT = 1;
ALTER TABLE credit_notes               AUTO_INCREMENT = 1;
ALTER TABLE credit_note_items          AUTO_INCREMENT = 1;
ALTER TABLE credit_note_logs           AUTO_INCREMENT = 1;
ALTER TABLE customer_credit_notes      AUTO_INCREMENT = 1;
ALTER TABLE customer_credit_note_usages AUTO_INCREMENT = 1;
ALTER TABLE credit_limit_requests      AUTO_INCREMENT = 1;
ALTER TABLE credit_limit_adjustments   AUTO_INCREMENT = 1;
ALTER TABLE temp_credit_limits         AUTO_INCREMENT = 1;

-- ── Customers (10 ราย) ──────────────────────────────────────
INSERT INTO customers
  (code, name, contact_person, phone, email, tax_id, address,
   credit_limit, credit_score, credit_score_notes, default_credit_term_days, notes)
VALUES
  ('C001','ร้านสมหมาย พาณิชย์','คุณสมหมาย ใจดี','081-234-5678','somhai@example.com',
   '0105561000111','17 ถ.นิมมานเหมินทร์ ซ.1 เชียงใหม่',
   163000,820,'ลูกค้าเก่า ชำระตรงเวลาเสมอ มีประวัติดี',30,'ลูกค้าหลัก — ขยายวงเงินแล้ว'),

  ('C002','บริษัท ก้าวหน้า ซัพพลาย จำกัด','คุณวิเชียร ก้าวหน้า','053-123-4567','vichai@kawna.co.th',
   '0115564001234','ถ.โชตนา ต.ช้างเผือก อ.เมือง เชียงใหม่',
   500000,770,'บริษัทขนาดกลาง สั่งสม่ำเสมอ',60,NULL),

  ('C003','ห้างหุ้นส่วนจำกัด ทรัพย์สมบูรณ์การค้า','คุณสมบูรณ์ ทรัพย์ดี','089-321-0001','somboon@thrupsomboon.com',
   '0503560005555','ถ.เชียงใหม่-ลำปาง ต.สันปูเลย อ.ดอยสะเก็ด',
   80000,660,'ชำระล่าช้าบางครั้ง',45,NULL),

  ('C004','ร้านพรทิพย์ โชคชัย','คุณพรทิพย์','082-444-5555',NULL,NULL,
   '45 ม.3 ต.หนองหอย อ.เมือง เชียงใหม่',
   50000,600,'ลูกค้าใหม่ เริ่มสั่งปีนี้',30,'ขอเพิ่มวงเงินอยู่ระหว่างพิจารณา'),

  ('C005','บริษัท อุดมทรัพย์ อินเตอร์เทรด จำกัด','คุณอุดม มั่งมี','02-888-9999','udom@udomtrupsap.com',
   '0105560009999','อาคารพาณิชย์ ถ.ราชดำเนิน กรุงเทพฯ',
   300000,750,'ลูกค้าใหญ่จากกทม ชำระตรงเวลา',60,'ส่งของทุกเดือน'),

  ('C006','ร้านมงคล วัสดุก่อสร้าง','คุณมงคล เจริญ','087-666-3333','mongkol@mongkolmat.com',
   NULL,'ถ.ซุปเปอร์ไฮเวย์ ต.ท่าศาลา อ.เมือง เชียงใหม่',
   120000,640,'ชำระได้แต่ช้าเป็นบางเดือน',30,NULL),

  ('C007','บริษัท สยามเฟรช ฟู้ด จำกัด','คุณสยาม พานิช','053-777-8888','siam@siamfresh.co.th',
   '0105555007777','นิคมอุตสาหกรรมภาคเหนือ ลำพูน',
   750000,800,'ลูกค้ารายใหญ่ที่สุด สั่งทุกสัปดาห์',45,'มีวงเงินชั่วคราวเพิ่มเติม'),

  ('C008','ห้างหุ้นส่วนสามัญ นิยมค้าขาย','คุณนิยม ขายดี','081-555-2222','niyom@niyomkhaai.com',
   NULL,'ตลาดแม่กิม ถ.วัวลาย เชียงใหม่',
   60000,610,'ยอดคงค้างสูงในบางช่วง',30,NULL),

  ('C009','บริษัท เมืองไทย โลจิสติกส์ จำกัด','คุณเมืองไทย โลจิ','02-333-4444','mt@mtlogistics.co.th',
   '0105558009999','ถ.พระราม 9 กรุงเทพฯ',
   1000000,850,'บริษัทใหญ่ เงื่อนไขสินเชื่อพิเศษ',60,'ลูกค้า VIP'),

  ('C010','ร้านสุวรรณ ของชำ','คุณสุวรรณ','085-000-1111',NULL,NULL,
   '22 ม.7 ต.แม่เหียะ อ.เมือง เชียงใหม่',
   30000,560,'ลูกค้าเล็ก เครดิตระยะสั้น',15,'เริ่มสั่งเดือนที่แล้ว');

-- ── Credit Limit History ─────────────────────────────────────
-- C001 ขอเพิ่มวงเงินถาวร 100000 → 163000 (อนุมัติแล้ว)
INSERT INTO credit_limit_requests
  (request_type, customer_id, amount, reason, status, requested_by, approved_by, approved_at, approval_token, created_at)
VALUES
  ('permanent_increase', 1, 163000, 'ยอดสั่งซื้อเพิ่มขึ้นต่อเนื่อง 6 เดือน ขอขยายวงเงิน', 'approved',
   12, 6, NOW() - INTERVAL 90 DAY, UUID(), NOW() - INTERVAL 95 DAY);
SET @req1 := LAST_INSERT_ID();

INSERT INTO credit_limit_adjustments (customer_id, adjusted_by, delta, new_limit, reason, created_at) VALUES
  (1, 6, 63000, 163000, 'อนุมัติตามคำขอ — ยอดสั่งซื้อสม่ำเสมอ', NOW() - INTERVAL 90 DAY);

-- C007 ขอวงเงินชั่วคราว +250000 (อนุมัติ ใช้งานอยู่)
INSERT INTO credit_limit_requests
  (request_type, customer_id, extra_amount, start_date, end_date, reason, status,
   requested_by, approved_by, approved_at, approval_token, created_at)
VALUES
  ('temporary', 7, 250000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 60 DAY),
   'ช่วงสงกรานต์ — ต้องการสั่งสินค้าล็อตใหญ่', 'approved',
   12, 6, NOW() - INTERVAL 31 DAY, UUID(), NOW() - INTERVAL 32 DAY);
SET @req2 := LAST_INSERT_ID();

INSERT INTO temp_credit_limits (customer_id, extra_amount, start_date, end_date, reason, created_by, is_active, request_id, created_at)
VALUES (7, 250000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 60 DAY),
        'วงเงินชั่วคราวช่วงสงกรานต์', 6, 1, @req2, NOW() - INTERVAL 31 DAY);

-- C004 ขอเพิ่มวงเงิน (รออนุมัติ)
INSERT INTO credit_limit_requests
  (request_type, customer_id, amount, reason, status, requested_by, approval_token, created_at)
VALUES
  ('permanent_increase', 4, 80000, 'ยอดสั่งซื้อเพิ่มขึ้น ขอขยายวงเงินจาก 50000 เป็น 80000', 'pending',
   12, UUID(), NOW() - INTERVAL 2 DAY);

-- ── Customer Edit Log ────────────────────────────────────────
INSERT INTO customer_edit_logs (customer_id, edited_by, summary, changes, created_at) VALUES
  (1, 6, 'ปรับวงเงินสินเชื่อ 100000 → 163000', '{"credit_limit":{"from":100000,"to":163000}}', NOW() - INTERVAL 90 DAY),
  (7, 6, 'เพิ่มวงเงินชั่วคราว +250000', '{"temp_credit":{"added":250000}}', NOW() - INTERVAL 31 DAY),
  (4, 12, 'แก้ไขข้อมูลติดต่อ', '{"phone":{"from":"082-444-0000","to":"082-444-5555"}}', NOW() - INTERVAL 10 DAY);

-- ================================================================
-- PURCHASE ORDERS
-- ================================================================

-- ── (1) draft / unpaid — C001 ────────────────────────────────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES ('PO202505-0001', 1, 'draft', 'unpaid', 30,
        7910.00, 7910.00, 0.00, 7910.00,
        'รอลูกค้ายืนยันรายการ', 12, NOW() - INTERVAL 3 HOUR);
SET @po1 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po1,'200064589','แอปเปิ้ลฟูจิ (M) US 70',100,'กก.',25.00,2500.00),
  (@po1,'100030297','ผงปลาป่นปรุงรสผสมสาหร่าย',30,'ถุง',102.00,3060.00),
  (@po1,'200088188','น้ำมันดอกทานตะวัน โอลิตาเลีย 1L',10,'ขวด',235.00,2350.00);

-- ── (2) confirmed / unpaid — C002 ───────────────────────────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES ('PO202505-0002', 2, 'confirmed', 'unpaid', 60,
        24950.00, 24950.00, 0.00, 24950.00,
        'ลูกค้ายืนยันแล้ว เตรียมแพ็คสินค้า', 12, NOW() - INTERVAL 2 DAY);
SET @po2 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po2,'200074612','พาสต้าซอสวัตตี้ โทมาโท เฮิร์บ 420ก.',50,'กระปุก',139.00,6950.00),
  (@po2,'200065396','ข้าวเหนียวกะทิทุเรียนแช่แข็ง 180ก.',80,'กล่อง',100.00,8000.00),
  (@po2,'100051329','ปลาหมึกเส้นเต่าทอง 20.5ก.',200,'ห่อ',50.00,10000.00);

INSERT INTO po_edit_logs (po_id, edited_by, summary, changes, created_at) VALUES
  (@po2, 12, 'เพิ่มจำนวน ปลาหมึกเส้น จาก 150 เป็น 200',
   '{"items":[{"sku":"100051329","qty":{"from":150,"to":200},"line_total":{"from":7500,"to":10000}}]}',
   NOW() - INTERVAL 1 DAY);

-- ── (3) packed / unpaid — C007 ──────────────────────────────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES ('PO202505-0003', 7, 'packed', 'unpaid', 45,
        24120.00, 24120.00, 0.00, 24120.00,
        'แพ็คใส่ลังแล้ว รอตรวจก่อนส่ง', 6, NOW() - INTERVAL 3 DAY);
SET @po3 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po3,'100027417','ขนม POP TARTS BLUEBERRY 416G.',60,'กล่อง',172.00,10320.00),
  (@po3,'20701789','ชาพีชชารดา 50ก.',20,'กล่อง',380.00,7600.00),
  (@po3,'200097121','PROBAR BOLT OG RASPBERRY 60G.',40,'ชิ้น',155.00,6200.00);

-- ── (4) checked / unpaid — C004 ─────────────────────────────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES ('PO202505-0004', 4, 'checked', 'unpaid', 30,
        15850.00, 15850.00, 0.00, 15850.00,
        'ตรวจของครบแล้ว พร้อมจัดส่งพรุ่งนี้', 6, NOW() - INTERVAL 4 DAY);
SET @po4 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po4,'200048279','แชมพูขิงอภัยภูเบศร 300มล.',80,'ขวด',70.00,5600.00),
  (@po4,'100066277','ลาซานญ่าเปรสโต้ 400ก.',60,'กล่อง',80.00,4800.00),
  (@po4,'200053574','ลูกพีช 750g. (TNP) CN.',50,'กก.',109.00,5450.00);

-- ── (5) delivered / unpaid — C005 (due +20 วัน) ─────────────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   due_date, notes, created_by, created_at)
VALUES ('PO202505-0005', 5, 'delivered', 'unpaid', 60,
        22910.00, 22910.00, 0.00, 22910.00,
        DATE_ADD(CURDATE(), INTERVAL 20 DAY),
        'ส่งของแล้ว รอลูกค้าเซ็นรับ', 6, NOW() - INTERVAL 40 DAY);
SET @po5 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po5,'200088188','น้ำมันดอกทานตะวัน โอลิตาเลีย 1L',30,'ขวด',235.00,7050.00),
  (@po5,'200016432','พาสต้า เพนเน่บราวไรท์ แฟมมิลี่',100,'กล่อง',95.00,9500.00),
  (@po5,'100005689','ลูกเกดตราโดล 340ก. 12อ.',60,'กล่อง',106.00,6360.00);

-- ── (6) delivered / unpaid — C009 (due +2 วัน เกือบครบ) ─────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   due_date, notes, created_by, created_at)
VALUES ('PO202505-0006', 9, 'delivered', 'unpaid', 60,
        7595.00, 7595.00, 0.00, 7595.00,
        DATE_ADD(CURDATE(), INTERVAL 2 DAY),
        'ใกล้ครบกำหนดชำระ', 12, NOW() - INTERVAL 58 DAY);
SET @po6 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po6,'100021406','WINE MCGUIGAN BLACK RED 75CL',5,'ขวด',565.00,2825.00),
  (@po6,'200000976','B.GIVE ME A HUG: 8 LIFE',3,'เล่ม',590.00,1770.00),
  (@po6,'200068250','ซอสพริกลินเกมส์ 280มล. เผ็ดมาก',20,'ขวด',150.00,3000.00);

-- ── (7) delivered / unpaid OVERDUE — C006 (เลยกำหนด 10 วัน) ──
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   due_date, notes, created_by, created_at)
VALUES ('PO202504-0007', 6, 'delivered', 'unpaid', 30,
        31800.00, 31800.00, 0.00, 31800.00,
        DATE_SUB(CURDATE(), INTERVAL 10 DAY),
        '⚠ ส่งของแล้วแต่เลยกำหนดชำระ 10 วัน — ติดตามด่วน', 6, NOW() - INTERVAL 40 DAY);
SET @po7 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po7,'200068250','ซอสพริกลินเกมส์ 280มล. เผ็ดมาก',100,'ขวด',150.00,15000.00),
  (@po7,'100014770','แปรงนวดเหงือกซิลิโคนเนเจอร์',200,'อัน',42.00,8400.00),
  (@po7,'100013088','เจลแต้มสิวดร.สมชาย 4ก.',80,'หลอด',105.00,8400.00);

-- ── (8) received / partial — C002 (due +25 วัน, จ่าย 2 งวด) ─
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, notes, created_by, created_at)
VALUES ('PO202504-0008', 2, 'received', 'partial', 60,
        61680.00, 61680.00, 40000.00, 21680.00,
        '/uploads/signed/PO202504-0008-signed.pdf', NOW() - INTERVAL 20 DAY,
        DATE_ADD(CURDATE(), INTERVAL 25 DAY),
        'รับของแล้ว ทยอยจ่าย — ค้างอีก 21,680 บาท', 6, NOW() - INTERVAL 25 DAY);
SET @po8 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po8,'200074612','พาสต้าซอสวัตตี้ โทมาโท เฮิร์บ 420ก.',120,'กระปุก',139.00,16680.00),
  (@po8,'200065396','ข้าวเหนียวกะทิทุเรียนแช่แข็ง 180ก.',200,'กล่อง',100.00,20000.00),
  (@po8,'100051329','ปลาหมึกเส้นเต่าทอง 20.5ก.',500,'ห่อ',50.00,25000.00);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by, notes) VALUES
  (@po8, 20000.00, NOW() - INTERVAL 15 DAY, 'transfer', 'TF20260506-001', 12, 'งวดที่ 1'),
  (@po8, 20000.00, NOW() - INTERVAL 8 DAY,  'transfer', 'TF20260513-002', 12, 'งวดที่ 2');

-- ── (9) received / partial OVERDUE — C007 (เลยกำหนด 12 วัน) ─
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, notes, created_by, created_at)
VALUES ('PO202503-0009', 7, 'received', 'partial', 45,
        37350.00, 37350.00, 15000.00, 22350.00,
        '/uploads/signed/PO202503-0009-signed.pdf', NOW() - INTERVAL 50 DAY,
        DATE_SUB(CURDATE(), INTERVAL 12 DAY),
        '⚠ เลยกำหนดชำระ 12 วัน ยังค้าง 22,350 บาท', 6, NOW() - INTERVAL 57 DAY);
SET @po9 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po9,'20701789','ชาพีชชารดา 50ก.',40,'กล่อง',380.00,15200.00),
  (@po9,'200097121','PROBAR BOLT OG RASPBERRY 60G.',50,'ชิ้น',155.00,7750.00),
  (@po9,'100001630','ส้อมเสริฟขอบตั้ง (นก)',150,'ด้าม',96.00,14400.00);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by, notes) VALUES
  (@po9, 15000.00, NOW() - INTERVAL 40 DAY, 'transfer', 'TF20260411-003', 12, 'งวดที่ 1/2');

-- ── (10) received / paid — C001 (ชำระครบเวลา, มี invoice + JDA) ─
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   tax_invoice_number, signed_doc_path, signed_at, due_date, fully_paid_at,
   jda_job_id, jda_po_number, jda_synced_at,
   notes, created_by, created_at)
VALUES ('PO202503-0010', 1, 'received', 'paid', 30,
        9260.00, 9260.00, 9260.00, 0.00,
        'TAX202503-0010',
        '/uploads/signed/PO202503-0010-signed.pdf', NOW() - INTERVAL 55 DAY,
        DATE_SUB(CURDATE(), INTERVAL 25 DAY), NOW() - INTERVAL 27 DAY,
        'JOB-1745100000-1-AA11BB22','JDA301456', NOW() - INTERVAL 54 DAY,
        'ชำระครบก่อนกำหนด', 6, NOW() - INTERVAL 60 DAY);
SET @po10 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po10,'100030297','ผงปลาป่นปรุงรสผสมสาหร่าย',40,'ถุง',102.00,4080.00),
  (@po10,'200064589','แอปเปิ้ลฟูจิ (M) US 70',80,'กก.',25.00,2000.00),
  (@po10,'100005689','ลูกเกดตราโดล 340ก. 12อ.',30,'กล่อง',106.00,3180.00);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by, jda_synced_at) VALUES
  (@po10, 9260.00, NOW() - INTERVAL 27 DAY, 'transfer', 'TF20260424-004', 6, NOW() - INTERVAL 26 DAY);
SET @pmnt10 := LAST_INSERT_ID();
INSERT INTO invoices (invoice_number, po_id, amount, generated_by, generated_at) VALUES
  ('INV202503-0001', @po10, 9260.00, 6, NOW() - INTERVAL 58 DAY);

-- ── (11) received / paid LATE — C003 (จ่ายหลังครบกำหนด 3 วัน) ─
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, fully_paid_at,
   jda_job_id, jda_po_number, jda_synced_at,
   notes, created_by, created_at)
VALUES ('PO202503-0011', 3, 'received', 'paid', 45,
        11760.00, 11760.00, 11760.00, 0.00,
        '/uploads/signed/PO202503-0011-signed.pdf', NOW() - INTERVAL 48 DAY,
        DATE_SUB(CURDATE(), INTERVAL 5 DAY), NOW() - INTERVAL 2 DAY,
        'JOB-1745200000-1-CC33DD44','JDA301512', NOW() - INTERVAL 47 DAY,
        'จ่ายล่าช้า 3 วัน หลังครบกำหนด', 6, NOW() - INTERVAL 50 DAY);
SET @po11 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po11,'200065396','ข้าวเหนียวกะทิทุเรียนแช่แข็ง 180ก.',50,'กล่อง',100.00,5000.00),
  (@po11,'200053574','ลูกพีช 750g. (TNP) CN.',40,'กก.',109.00,4360.00),
  (@po11,'100066277','ลาซานญ่าเปรสโต้ 400ก.',30,'กล่อง',80.00,2400.00);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by) VALUES
  (@po11, 11760.00, NOW() - INTERVAL 2 DAY, 'transfer', 'TF20260519-005', 12);

-- ── (12) received / unpaid OVERDUE — C008 (เลยกำหนด 7 วัน) ─
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date,
   jda_job_id, jda_po_number, jda_synced_at,
   notes, created_by, created_at)
VALUES ('PO202504-0012', 8, 'received', 'unpaid', 30,
        15600.00, 15600.00, 0.00, 15600.00,
        '/uploads/signed/PO202504-0012-signed.pdf', NOW() - INTERVAL 38 DAY,
        DATE_SUB(CURDATE(), INTERVAL 7 DAY),
        'JOB-1745300000-1-EE55FF66','JDA301589', NOW() - INTERVAL 37 DAY,
        '⚠ รับของแล้วแต่ยังไม่จ่าย เลยกำหนด 7 วัน', 6, NOW() - INTERVAL 37 DAY);
SET @po12 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po12,'200048279','แชมพูขิงอภัยภูเบศร 300มล.',60,'ขวด',70.00,4200.00),
  (@po12,'100051329','ปลาหมึกเส้นเต่าทอง 20.5ก.',100,'ห่อ',50.00,5000.00),
  (@po12,'100066277','ลาซานญ่าเปรสโต้ 400ก.',80,'กล่อง',80.00,6400.00);

-- ── (13) received / paid — C005 (มี credit note ปรับราคา) ─────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, fully_paid_at,
   jda_job_id, jda_po_number, jda_synced_at,
   notes, created_by, created_at)
VALUES ('PO202503-0013', 5, 'received', 'paid', 60,
        6600.00, 6600.00, 5820.00, 0.00,
        '/uploads/signed/PO202503-0013-signed.pdf', NOW() - INTERVAL 68 DAY,
        DATE_SUB(CURDATE(), INTERVAL 8 DAY), NOW() - INTERVAL 10 DAY,
        'JOB-1745400000-1-GG77HH88','JDA301634', NOW() - INTERVAL 67 DAY,
        'ราคาปรับลดหลังออก CN — ชำระยอดสุทธิ 5,820 บาท', 6, NOW() - INTERVAL 70 DAY);
SET @po13 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po13,'200074612','พาสต้าซอสวัตตี้ โทมาโท เฮิร์บ 420ก.',20,'กระปุก',139.00,2780.00);
SET @po13_item1 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po13,'200048279','แชมพูขิงอภัยภูเบศร 300มล.',30,'ขวด',70.00,2100.00);
SET @po13_item2 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po13,'100027417','ขนม POP TARTS BLUEBERRY 416G.',10,'กล่อง',172.00,1720.00);
SET @po13_item3 := LAST_INSERT_ID();

INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by, notes) VALUES
  (@po13, 5820.00, NOW() - INTERVAL 10 DAY, 'transfer', 'TF20260511-006', 12,
   'ชำระยอดสุทธิหลังหัก CN -780 บาท');

-- Credit Note สำหรับ PO13 (ปรับลดราคา พาสต้าซอส จาก 139 → 100 × 20 ชิ้น = -780)
INSERT INTO credit_notes
  (cn_number, po_id, customer_id, created_by, reason,
   total_original, total_new, total_diff, status, created_at)
VALUES ('CN202503-0001', @po13, 5, 6,
        'สินค้าไม่ตรงรายละเอียด — ปรับราคาพาสต้าซอสลงตามตกลง',
        6600.00, 5820.00, -780.00, 'active', NOW() - INTERVAL 12 DAY);
SET @cn1 := LAST_INSERT_ID();
INSERT INTO credit_note_items
  (credit_note_id, po_item_id, product_name, description, quantity, unit,
   original_price, new_price, diff_amount)
VALUES (@cn1, @po13_item1, '200074612', 'พาสต้าซอสวัตตี้ โทมาโท เฮิร์บ 420ก.',
        20.00, 'กระปุก', 139.00, 100.00, -780.00);
INSERT INTO credit_note_logs (credit_note_id, action, performed_by, summary, created_at) VALUES
  (@cn1, 'created', 6, 'ออก CN ปรับลดราคาสินค้าตามข้อตกลงกับลูกค้า', NOW() - INTERVAL 12 DAY);

-- ── (14) cancelled — C010 ────────────────────────────────────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES ('PO202504-0014', 10, 'cancelled', 'unpaid', 15,
        1250.00, 1250.00, 0.00, 1250.00,
        'ลูกค้าขอยกเลิก — เปลี่ยนใจหลังยืนยัน', 12, NOW() - INTERVAL 18 DAY);
SET @po14 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po14,'200064589','แอปเปิ้ลฟูจิ (M) US 70',50,'กก.',25.00,1250.00);

-- ── (15) received / paid — C009 (จ่าย 3 งวด, มี invoice) ────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, fully_paid_at,
   jda_job_id, jda_po_number, jda_synced_at,
   notes, created_by, created_at)
VALUES ('PO202504-0015', 9, 'received', 'paid', 60,
        11160.00, 11160.00, 11160.00, 0.00,
        '/uploads/signed/PO202504-0015-signed.pdf', NOW() - INTERVAL 28 DAY,
        DATE_ADD(CURDATE(), INTERVAL 12 DAY), NOW() - INTERVAL 2 DAY,
        'JOB-1745500000-1-II99JJ00','JDA301701', NOW() - INTERVAL 27 DAY,
        'ปิดยอดครบ — จ่าย 3 งวด', 6, NOW() - INTERVAL 30 DAY);
SET @po15 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po15,'100021406','WINE MCGUIGAN BLACK RED 75CL',8,'ขวด',565.00,4520.00),
  (@po15,'200000976','B.GIVE ME A HUG: 8 LIFE',6,'เล่ม',590.00,3540.00),
  (@po15,'200097121','PROBAR BOLT OG RASPBERRY 60G.',20,'ชิ้น',155.00,3100.00);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by, jda_synced_at, notes) VALUES
  (@po15, 5000.00, NOW() - INTERVAL 20 DAY, 'transfer', 'TF20260501-007', 6, NOW() - INTERVAL 19 DAY, 'งวดที่ 1/3'),
  (@po15, 4000.00, NOW() - INTERVAL 12 DAY, 'transfer', 'TF20260509-008', 6, NOW() - INTERVAL 11 DAY, 'งวดที่ 2/3'),
  (@po15, 2160.00, NOW() - INTERVAL 2 DAY,  'transfer', 'TF20260519-009', 12, NULL, 'งวดสุดท้าย — รอ JDA sync');
INSERT INTO invoices (invoice_number, po_id, amount, generated_by, generated_at) VALUES
  ('INV202504-0002', @po15, 11160.00, 6, NOW() - INTERVAL 29 DAY);

-- ── (16) confirmed / partial — C003 (จ่ายมัดจำล่วงหน้า) ──────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES ('PO202505-0016', 3, 'confirmed', 'partial', 45,
        15500.00, 15500.00, 5000.00, 10500.00,
        'ลูกค้าโอนมัดจำ 5,000 บาท รอแพ็คสินค้า', 12, NOW() - INTERVAL 1 DAY);
SET @po16 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po16,'100005689','ลูกเกดตราโดล 340ก. 12อ.',50,'กล่อง',106.00,5300.00),
  (@po16,'200016432','พาสต้า เพนเน่บราวไรท์ แฟมมิลี่',60,'กล่อง',95.00,5700.00),
  (@po16,'200068250','ซอสพริกลินเกมส์ 280มล. เผ็ดมาก',30,'ขวด',150.00,4500.00);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by, notes) VALUES
  (@po16, 5000.00, NOW() - INTERVAL 1 DAY, 'transfer', 'TF20260520-010', 12, 'มัดจำล่วงหน้า');

-- ── (17) received / paid — C001 (ส่วนหนึ่งของ billing note) ─
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   tax_invoice_number, signed_doc_path, signed_at, due_date, fully_paid_at,
   jda_job_id, jda_po_number, jda_synced_at,
   notes, created_by, created_at)
VALUES ('PO202503-0017', 1, 'received', 'paid', 30,
        9725.00, 9725.00, 9725.00, 0.00,
        'TAX202503-0017',
        '/uploads/signed/PO202503-0017-signed.pdf', NOW() - INTERVAL 43 DAY,
        DATE_SUB(CURDATE(), INTERVAL 13 DAY), NOW() - INTERVAL 15 DAY,
        'JOB-1745600000-1-KK11LL22','JDA301788', NOW() - INTERVAL 42 DAY,
        'ชำระครบตามบิลวางบิล', 6, NOW() - INTERVAL 45 DAY);
SET @po17 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po17,'100066277','ลาซานญ่าเปรสโต้ 400ก.',40,'กล่อง',80.00,3200.00),
  (@po17,'200053574','ลูกพีช 750g. (TNP) CN.',25,'กก.',109.00,2725.00),
  (@po17,'200016432','พาสต้า เพนเน่บราวไรท์ แฟมมิลี่',40,'กล่อง',95.00,3800.00);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by) VALUES
  (@po17, 9725.00, NOW() - INTERVAL 15 DAY, 'transfer', 'TF20260506-011', 6);

-- ── (18) received / paid — C002 (ชำระครบ มี invoice) ────────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, fully_paid_at,
   jda_job_id, jda_po_number, jda_synced_at,
   notes, created_by, created_at)
VALUES ('PO202503-0018', 2, 'received', 'paid', 60,
        12880.00, 12880.00, 12880.00, 0.00,
        '/uploads/signed/PO202503-0018-signed.pdf', NOW() - INTERVAL 28 DAY,
        DATE_SUB(CURDATE(), INTERVAL 1 DAY), NOW() - INTERVAL 3 DAY,
        'JOB-1745700000-1-MM33NN44','JDA301845', NOW() - INTERVAL 27 DAY,
        'ชำระครบทันกำหนด', 6, NOW() - INTERVAL 30 DAY);
SET @po18 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po18,'100030297','ผงปลาป่นปรุงรสผสมสาหร่าย',50,'ถุง',102.00,5100.00),
  (@po18,'200074612','พาสต้าซอสวัตตี้ โทมาโท เฮิร์บ 420ก.',20,'กระปุก',139.00,2780.00),
  (@po18,'100051329','ปลาหมึกเส้นเต่าทอง 20.5ก.',100,'ห่อ',50.00,5000.00);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by) VALUES
  (@po18, 12880.00, NOW() - INTERVAL 3 DAY, 'transfer', 'TF20260518-012', 6);
INSERT INTO invoices (invoice_number, po_id, amount, generated_by, generated_at) VALUES
  ('INV202503-0002', @po18, 12880.00, 6, NOW() - INTERVAL 29 DAY);

-- ── (19) draft / unpaid — C004 (เพิ่งสร้าง) ────────────────
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES ('PO202505-0019', 4, 'draft', 'unpaid', 30,
        2975.00, 2975.00, 0.00, 2975.00,
        'PO ใหม่ รอลูกค้ายืนยัน', 12, NOW() - INTERVAL 30 MINUTE);
SET @po19 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po19,'200048279','แชมพูขิงอภัยภูเบศร 300มล.',20,'ขวด',70.00,1400.00),
  (@po19,'100013088','เจลแต้มสิวดร.สมชาย 4ก.',15,'หลอด',105.00,1575.00);

-- ================================================================
-- BILLING NOTES
-- ================================================================

-- BN-0001: C001 — วางบิล PO10 + PO17 (ทั้งสองจ่ายครบแล้ว)
INSERT INTO billing_notes (bn_number, customer_id, issued_date, due_date, notes, created_by, created_at)
VALUES ('BN202503-0001', 1,
        DATE_SUB(CURDATE(), INTERVAL 46 DAY),
        DATE_SUB(CURDATE(), INTERVAL 16 DAY),
        'วางบิลรวม 2 ใบ — ร้านสมหมาย พาณิชย์', 6, NOW() - INTERVAL 46 DAY);
SET @bn1 := LAST_INSERT_ID();
INSERT INTO billing_note_items (billing_note_id, po_id, po_number, po_date, tax_invoice_number, amount) VALUES
  (@bn1, @po10, 'PO202503-0010', DATE_SUB(CURDATE(), INTERVAL 60 DAY), 'TAX202503-0010', 9260.00),
  (@bn1, @po17, 'PO202503-0017', DATE_SUB(CURDATE(), INTERVAL 45 DAY), 'TAX202503-0017', 9725.00);

-- BN-0002: C002 — วางบิล PO18
INSERT INTO billing_notes (bn_number, customer_id, issued_date, due_date, notes, created_by, created_at)
VALUES ('BN202503-0002', 2,
        DATE_SUB(CURDATE(), INTERVAL 30 DAY),
        DATE_SUB(CURDATE(), INTERVAL 1 DAY),
        'วางบิลประจำเดือนมีนาคม', 6, NOW() - INTERVAL 30 DAY);
SET @bn2 := LAST_INSERT_ID();
INSERT INTO billing_note_items (billing_note_id, po_id, po_number, po_date, tax_invoice_number, amount) VALUES
  (@bn2, @po18, 'PO202503-0018', DATE_SUB(CURDATE(), INTERVAL 30 DAY), NULL, 12880.00);

-- BN-0003: C007 — วางบิล PO9 (ยังค้าง, ออก billing note แล้ว)
INSERT INTO billing_notes (bn_number, customer_id, issued_date, due_date, notes, created_by, created_at)
VALUES ('BN202503-0003', 7,
        DATE_SUB(CURDATE(), INTERVAL 14 DAY),
        DATE_SUB(CURDATE(), INTERVAL 7 DAY),
        '⚠ วางบิลซ้ำ — ยังค้างชำระ กรุณาติดต่อ', 6, NOW() - INTERVAL 14 DAY);
SET @bn3 := LAST_INSERT_ID();
INSERT INTO billing_note_items (billing_note_id, po_id, po_number, po_date, tax_invoice_number, amount) VALUES
  (@bn3, @po9, 'PO202503-0009', DATE_SUB(CURDATE(), INTERVAL 57 DAY), NULL, 22350.00);

-- ================================================================
-- QUOTATIONS
-- ================================================================
INSERT INTO quotations (quote_number, po_id, generated_at) VALUES
  ('QT202505-0001', @po1, NOW() - INTERVAL 2 HOUR),
  ('QT202505-0002', @po2, NOW() - INTERVAL 2 DAY),
  ('QT202504-0003', @po5, NOW() - INTERVAL 41 DAY);

-- ================================================================
-- SUMMARY
-- ================================================================
SELECT
  po.po_number,
  c.code         AS customer,
  po.status,
  po.payment_status,
  po.total,
  po.paid_amount,
  po.remaining_amount,
  po.due_date,
  CASE
    WHEN po.due_date IS NULL                              THEN '-'
    WHEN po.payment_status = 'paid'
         AND po.fully_paid_at > po.due_date              THEN 'PAID_LATE'
    WHEN po.payment_status = 'paid'                      THEN 'PAID_ONTIME'
    WHEN po.due_date < CURDATE()                         THEN 'OVERDUE'
    WHEN po.due_date <= DATE_ADD(CURDATE(),INTERVAL 3 DAY) THEN 'DUE_SOON'
    ELSE 'ON_TIME'
  END AS timing
FROM purchase_orders po
JOIN customers c ON c.id = po.customer_id
ORDER BY po.id;
