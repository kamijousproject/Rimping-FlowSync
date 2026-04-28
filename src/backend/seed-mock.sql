-- Mock data: PO ครบทุก status + ลูกค้าเพิ่ม + payments หลายรอบ
USE flowsync;

-- ล้าง mock เก่า (เก็บ user admin ไว้)
DELETE FROM payments;
DELETE FROM invoices;
DELETE FROM po_items;
DELETE FROM purchase_orders;
DELETE FROM customers;
ALTER TABLE customers AUTO_INCREMENT = 1;
ALTER TABLE purchase_orders AUTO_INCREMENT = 1;
ALTER TABLE po_items AUTO_INCREMENT = 1;
ALTER TABLE payments AUTO_INCREMENT = 1;
ALTER TABLE invoices AUTO_INCREMENT = 1;

-- ===== Customers (5 ราย หลากหลาย) =====
INSERT INTO customers
  (code, name, contact_person, phone, email, tax_id, address,
   credit_limit, credit_score, credit_score_notes, default_credit_term_days, notes)
VALUES
  ('C001','ร้านสมหมาย','คุณสมหมาย ใจดี','081-234-5678','somhai@example.com','0105561000111','ถ.นิมมาน เชียงใหม่',
   80000, 820, 'ลูกค้าเก่า ชำระตรงเวลาเสมอ', 30, 'ลูกค้าหลัก'),
  ('C002','ร้านป้านาง','ป้านาง','089-111-2233','panang@example.com',NULL,'ตลาดวโรรส',
   30000, 650, 'ปานกลาง', 15, NULL),
  ('C003','บ.โชคดีค้าส่ง','คุณโชค','053-222-333','chok@example.com','0105560002222','สันป่าตอง เชียงใหม่',
   150000, 750, 'ลูกค้ารายใหญ่ สั่งสม่ำเสมอ', 60, 'จัดส่งทุกสัปดาห์'),
  ('C004','ร้านน้องนุ้ย','น้องนุ้ย','088-555-6677',NULL,NULL,'หางดง',
   15000, 580, 'ใหม่ ทดลองเครดิต', 7, 'เริ่มเดือนนี้'),
  ('C005','ร้านลุงเขียว','ลุงเขียว','085-999-0000','lung@example.com',NULL,'แม่ริม',
   50000, 690, NULL, 30, NULL);

-- ===== Purchase Orders ครบ 7 statuses =====
-- (1) draft  / unpaid
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES
  ('PO202604-0001', 1, 'draft', 'unpaid', 30, 4500, 4500, 0, 4500,
   'ร่าง PO รอลูกค้ายืนยัน', 1, NOW() - INTERVAL 1 DAY);
SET @po1 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po1,'ข้าวหอมมะลิ 5kg','ตราฉัตร',10,'ถุง',250,2500),
  (@po1,'น้ำตาลทราย 1kg',NULL,40,'ถุง',35,1400),
  (@po1,'น้ำมันพืช 1L','ตราองุ่น',12,'ขวด',50,600);

-- (2) confirmed / unpaid
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES
  ('PO202604-0002', 2, 'confirmed', 'unpaid', 15, 1800, 1800, 0, 1800,
   'ลูกค้ายืนยันแล้ว เตรียมแพ็ค', 1, NOW() - INTERVAL 2 DAY);
SET @po2 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po2,'มาม่าหมูสับ',NULL,100,'ซอง',6,600),
  (@po2,'ปลากระป๋อง','ตราสามแม่ครัว',40,'กระป๋อง',30,1200);

-- (3) packed / unpaid
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES
  ('PO202604-0003', 3, 'packed', 'unpaid', 60, 25000, 25000, 0, 25000,
   'แพ็คใส่ลังเรียบร้อย รอตรวจ', 1, NOW() - INTERVAL 3 DAY);
SET @po3 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po3,'ข้าวสาร 50kg','ตราต้นข้าว',20,'กระสอบ',1100,22000),
  (@po3,'น้ำปลา 700ml','ตราทิพรส',60,'ขวด',50,3000);

-- (4) checked / unpaid
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES
  ('PO202604-0004', 5, 'checked', 'unpaid', 30, 8400, 8400, 0, 8400,
   'ตรวจของครบ พร้อมจัดส่งพรุ่งนี้', 1, NOW() - INTERVAL 4 DAY);
SET @po4 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po4,'ผงซักฟอก 3kg','ตราบรีส',20,'ถุง',180,3600),
  (@po4,'น้ำยาล้างจาน 800ml','ตราซันไลต์',40,'ขวด',60,2400),
  (@po4,'สบู่ก้อน','ตราโพรเทคส์',120,'ก้อน',20,2400);

-- (5) delivered / unpaid (set due date)
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   due_date, notes, created_by, created_at)
VALUES
  ('PO202604-0005', 1, 'delivered', 'unpaid', 30, 12500, 12500, 0, 12500,
   DATE_ADD(CURDATE(), INTERVAL 25 DAY),
   'ส่งของแล้ว รอลูกค้าเซ็นรับของ', 1, NOW() - INTERVAL 5 DAY);
SET @po5 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po5,'น้ำดื่ม 600ml (แพ็ค 12)','ตราคริสตัล',50,'แพ็ค',75,3750),
  (@po5,'น้ำอัดลมโค้ก 1.25L',NULL,100,'ขวด',35,3500),
  (@po5,'นมจืด UHT 1L','ตราโฟร์โมสต์',150,'กล่อง',35,5250);

-- (6) received / partial — 1 PO ชำระบางส่วน หลายงวด
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, notes, created_by, created_at)
VALUES
  ('PO202604-0006', 3, 'received', 'partial', 60, 50000, 50000, 30000, 20000,
   '/api/files/signed/sample-signed.pdf', NOW() - INTERVAL 7 DAY,
   DATE_ADD(CURDATE(), INTERVAL 53 DAY),
   'รับของแล้ว ทยอยจ่าย 5 งวด งวดละ 10,000 (จ่ายมาแล้ว 3 งวด)',
   1, NOW() - INTERVAL 10 DAY);
SET @po6 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po6,'ข้าวสาร 50kg','ตราหงษ์ทอง',30,'กระสอบ',1200,36000),
  (@po6,'น้ำมันพืช 5L','ตราองุ่น',40,'แกลลอน',280,11200),
  (@po6,'เกลือป่น 1kg',NULL,160,'ถุง',17.5,2800);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by, notes) VALUES
  (@po6, 10000, NOW() - INTERVAL 6 DAY, 'transfer', 'TF20260422-001', 1, 'งวดที่ 1/5'),
  (@po6, 10000, NOW() - INTERVAL 4 DAY, 'transfer', 'TF20260424-002', 1, 'งวดที่ 2/5'),
  (@po6, 10000, NOW() - INTERVAL 1 DAY, 'transfer', 'TF20260427-003', 1, 'งวดที่ 3/5');

-- (7) received / paid — ปิดยอดสมบูรณ์
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, notes, created_by, created_at)
VALUES
  ('PO202604-0007', 1, 'received', 'paid', 30, 6800, 6800, 6800, 0,
   '/api/files/signed/sample-signed.pdf', NOW() - INTERVAL 20 DAY,
   DATE_SUB(CURDATE(), INTERVAL 5 DAY),
   'ปิดยอดเรียบร้อย', 1, NOW() - INTERVAL 25 DAY);
SET @po7 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po7,'กาแฟ 3in1 (กล่อง 27 ซอง)','ตราเนสกาแฟ',20,'กล่อง',180,3600),
  (@po7,'นมข้นหวาน','ตรามะลิ',80,'กระป๋อง',25,2000),
  (@po7,'ขนมปังกรอบ','ตราเลย์',40,'ห่อ',30,1200);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by) VALUES
  (@po7, 6800, NOW() - INTERVAL 15 DAY, 'transfer', 'TF20260413-008', 1);
INSERT INTO invoices (invoice_number, po_id, amount, generated_by, generated_at) VALUES
  ('INV202604-0001', @po7, 6800, 1, NOW() - INTERVAL 16 DAY);

-- (8) received / partial overdue — เลยกำหนด ยังไม่ปิด (สำหรับโชว์ใน "PO เกินกำหนด")
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount,
   signed_doc_path, signed_at, due_date, notes, created_by, created_at)
VALUES
  ('PO202603-0009', 4, 'received', 'partial', 7, 9000, 9000, 3000, 6000,
   '/api/files/signed/sample-signed.pdf', NOW() - INTERVAL 25 DAY,
   DATE_SUB(CURDATE(), INTERVAL 18 DAY),
   '⚠ เลยกำหนดชำระ 18 วัน — ติดตามเร่งด่วน', 1, NOW() - INTERVAL 32 DAY);
SET @po8 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po8,'ข้าวสาร 5kg',NULL,20,'ถุง',300,6000),
  (@po8,'น้ำตาลทราย 1kg',NULL,60,'ถุง',35,2100),
  (@po8,'น้ำมันพืช 1L',NULL,18,'ขวด',50,900);
INSERT INTO payments (po_id, amount, paid_at, method, reference, recorded_by, notes) VALUES
  (@po8, 3000, NOW() - INTERVAL 22 DAY, 'transfer', 'TF20260406-011', 1, 'โอนมาส่วนหนึ่ง รอที่เหลือ');

-- (9) cancelled
INSERT INTO purchase_orders
  (po_number, customer_id, status, payment_status, credit_term_days,
   subtotal, total, paid_amount, remaining_amount, notes, created_by, created_at)
VALUES
  ('PO202604-0008', 2, 'cancelled', 'unpaid', 15, 2400, 2400, 0, 2400,
   'ลูกค้าขอยกเลิก เปลี่ยนใจ', 1, NOW() - INTERVAL 6 DAY);
SET @po9 := LAST_INSERT_ID();
INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, line_total) VALUES
  (@po9,'น้ำมันพืช 5L',NULL,8,'แกลลอน',300,2400);

-- สรุป
SELECT po_number, status, payment_status, total, paid_amount, remaining_amount, due_date
FROM purchase_orders ORDER BY id;
