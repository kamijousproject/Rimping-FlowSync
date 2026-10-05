-- เลขที่เอกสาร / อ้างอิง ที่กรอกเอง (ลูกค้ากลุ่ม เช่น 7-11 — อิงเลขจากเครื่องขายอีกเครื่อง)
-- ใช้แสดงบนใบเสนอราคา (เลขที่เอกสาร/อ้างอิง) และช่องอ้างอิงของใบกำกับภาษี/ใบเสร็จ แทนเลขรันของระบบ
ALTER TABLE purchase_orders
  ADD COLUMN doc_number VARCHAR(64) NULL AFTER po_number,
  ADD COLUMN doc_reference VARCHAR(64) NULL AFTER doc_number;
