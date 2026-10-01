import type { ReactNode } from "react";
import Image from "next/image";
import { Mail, User, ClipboardList, Banknote, MessageSquare, PenLine } from "lucide-react";
import { fmtMoney } from "@/components/StatusBadge";
import { bahtText } from "@/lib/bahtText";
import { vatBreakdown } from "@/lib/vat";

export type SalesDocItem = {
  id: number | string;
  product_name: string; // SKU
  description?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  line_total: number;
  vatable: boolean;
};

export type SalesDocCustomer = {
  name: string;
  code?: string | null;
  contact_person?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
};

const SELLER = {
  name: "บริษัท ตันตราภัณฑ์ซุปเปอร์มาร์เก็ต (1994) จำกัด",
  address: "199/8 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <span className="font-semibold">{label}</span>
      <span className="whitespace-pre-wrap">{children}</span>
    </div>
  );
}

function Section({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-3 border-t border-border pt-4 mt-4 print-avoid-break">
      <div className="flex items-start gap-1 font-semibold text-xs">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * ฟอร์มเอกสารขาย (ใบเสนอราคา / ใบเสร็จรับเงิน-ใบกำกับภาษี) แบบเดียวกัน
 * แสดงราคาขาย + ถอด VAT รายบรรทัดตาม inventory.sc (100 = รวม VAT, 200 = ไม่มี VAT)
 */
export function SalesDocument({
  id,
  title,
  meta,
  headerExtra,
  customer,
  contactName,
  contactEmail,
  items,
  notes,
  payment,
  signatures,
  showGrossColumn = false,
  showVat = true,
}: {
  id: string;
  title: string;
  meta: [string, ReactNode][];
  headerExtra?: ReactNode;
  customer: SalesDocCustomer;
  contactName?: string | null;
  /** ติดต่อกลับที่ = ข้อมูลผู้สร้างเอกสาร */
  contactEmail?: string | null;
  items: SalesDocItem[];
  notes?: string | null;
  payment: ReactNode;
  signatures: { label: string; name?: string | null }[];
  /** ใบเสนอราคา: แสดงคอลัมน์ "ราคารวม VAT" (ราคาต่อหน่วย + 7% สำหรับสินค้าที่มี VAT) ต่อจากคอลัมน์ VAT */
  showGrossColumn?: boolean;
  /** false = ใบเสนอราคาปกติ ไม่ถอด VAT (ราคา/หน่วย + จำนวนเงิน, สรุปแค่ยอดรวม) */
  showVat?: boolean;
}) {
  const { rows, vatBase, vat, exempt, total: netTotal } = vatBreakdown(items);
  // ราคารวม VAT ต่อหน่วย (ลูกค้ากลุ่ม): ราคา + 7% สำหรับสินค้าที่มี VAT
  const grossOf = (it: SalesDocItem) =>
    it.vatable ? Math.round(Number(it.unit_price) * 107) / 100 : Number(it.unit_price);
  // ลูกค้ากลุ่ม: จำนวนเงินทั้งสิ้น = Σ (ราคารวม VAT × จำนวน)
  const total =
    showVat && showGrossColumn
      ? Math.round(items.reduce((s, it) => s + grossOf(it) * Number(it.quantity), 0) * 100) / 100
      : netTotal;

  return (
    <div
      id={id}
      className="bg-white border border-border shadow rounded-lg p-10 text-xs print:shadow-none print:border-0 print:rounded-none print:p-8"
    >
      {/* Header: logo + title */}
      <div className="flex items-start justify-between">
        <div className="w-16 h-16 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
          <Image
            src="/logo.svg"
            alt="Rimping"
            width={48}
            height={48}
            style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }}
          />
        </div>
        <div className="text-right">
          <div className="text-sm">(ต้นฉบับ)</div>
          <div className="text-3xl font-bold text-brand-600">{title}</div>
          {headerExtra}
        </div>
      </div>

      {/* Parties + doc info */}
      <div className="grid grid-cols-[1fr_260px] gap-6 mt-6">
        <div className="space-y-1">
          <Row label="ผู้ขาย :">{SELLER.name}</Row>
          <Row label="ที่อยู่ :">{SELLER.address}</Row>
          <div className="border-t border-border my-3" />
          <Row label="ลูกค้า :">
            {customer.code && <span className="font-mono mr-1">{customer.code}</span>}
            {customer.name}
          </Row>
          {customer.address && <Row label="ที่อยู่ :">{customer.address}</Row>}
          {customer.tax_id && <Row label="เลขที่ภาษี :">{customer.tax_id}</Row>}
          {customer.phone && <Row label="โทร :">{customer.phone}</Row>}
          {customer.contact_person && <Row label="เรียนคุณ :">{customer.contact_person}</Row>}
        </div>
        <div className="space-y-4">
          <div className="bg-brand-50 rounded p-3 space-y-1">
            {meta.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[90px_1fr] gap-2">
                <span className="font-semibold">{label}</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="font-semibold">ติดต่อกลับที่ :</div>
            {contactName && (
              <div className="flex items-center gap-2">
                <User className="w-3 h-3" /> {contactName}
              </div>
            )}
            {contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3 shrink-0" /> {contactEmail}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <table className="w-full mt-6 border-collapse">
        <thead>
          <tr className="bg-brand-50 font-semibold">
            <th className="text-left p-2">คำอธิบาย</th>
            <th className="text-right p-2 w-16">จำนวน</th>
            <th className="text-right p-2 w-24">ราคา</th>
            {showVat && <th className="text-right p-2 w-14">VAT</th>}
            {showVat && showGrossColumn && <th className="text-right p-2 w-28">ราคารวม VAT</th>}
            <th className="text-right p-2 w-28">{showVat ? "มูลค่าก่อนภาษี" : "จำนวนเงิน"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, idx) => (
            <tr key={it.id} className="border-b border-border align-top">
              <td className="p-2">
                <div>
                  {idx + 1}.{" "}
                  <span className="font-semibold">{it.description || it.product_name}</span>
                </div>
              </td>
              <td className="text-right p-2">
                {Number(it.quantity).toFixed(2)} {it.unit}
              </td>
              <td className="text-right p-2">{fmtMoney(it.unit_price)}</td>
              {showVat && <td className="text-right p-2">{it.vatable ? "7%" : "-"}</td>}
              {showVat && showGrossColumn && (
                <td className="text-right p-2">
                  {fmtMoney(grossOf(it))}
                </td>
              )}
              <td className="text-right p-2">
                {fmtMoney(showVat ? it.pre_tax : Number(it.line_total))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <Section icon={<ClipboardList className="w-4 h-4" />} label="สรุป">
        <div className="grid grid-cols-[1fr_240px] gap-6">
          <div className="space-y-1">
            {showVat ? (
              <>
                <div className="flex justify-between">
                  <span className="font-semibold">มูลค่าที่คำนวณภาษี 7%</span>
                  <span>{fmtMoney(vatBase)} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">ภาษีมูลค่าเพิ่ม 7%</span>
                  <span>{fmtMoney(vat)} บาท</span>
                </div>
              </>
            ) : (
              <div className="text-muted">ราคารวมภาษีมูลค่าเพิ่มแล้ว</div>
            )}
            {showVat && exempt > 0 && (
              <div className="flex justify-between">
                <span className="font-semibold">มูลค่าที่ไม่มีภาษี</span>
                <span>{fmtMoney(exempt)} บาท</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-semibold">จำนวนเงินทั้งสิ้น</span>
              <span>{bahtText(total)}</span>
            </div>
          </div>
          <div className="bg-brand-50 rounded p-4 flex items-center justify-between self-start">
            <span className="font-semibold">จำนวนเงินทั้งสิ้น</span>
            <span className="text-lg font-bold text-brand-800">{fmtMoney(total)} บาท</span>
          </div>
        </div>
      </Section>

      <Section icon={<Banknote className="w-4 h-4" />} label="ชำระเงิน">
        {payment}
      </Section>

      <Section icon={<MessageSquare className="w-4 h-4" />} label="หมายเหตุ">
        <div className="whitespace-pre-wrap">{notes}</div>
      </Section>

      <Section icon={<PenLine className="w-4 h-4" />} label="รับรอง">
        <div className="grid grid-cols-3 gap-6 text-center">
          {signatures.map((s) => (
            <div key={s.label}>
              <div className="font-semibold">{s.label}</div>
              <div className="h-12 flex items-end justify-center">
                {s.name && <span>{s.name}</span>}
              </div>
              <div className="border-t border-dashed border-foreground mt-1" />
              <div className="text-muted mt-2">วันที่ ………/………/…………</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/** บล็อกชำระเงิน/เงื่อนไขของใบเสนอราคา (ใช้ทั้งหน้า PO และ product-search) */
export function QuotePaymentTerms({ creditTerm }: { creditTerm: number }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-0.5">
        <div className="font-semibold">โอนเงินเข้าบัญชีธนาคาร</div>
        <div>ธนาคารกรุงเทพ สาขาท่าแพ-เชียงใหม่</div>
        <div>
          ออมทรัพย์ <span className="font-mono font-semibold">251-5-01738-8</span>
        </div>
        <div>TANTRAPHAN SUPPERMARKET (1944) CO., LTD.</div>
      </div>
      <ul className="list-disc list-inside space-y-0.5">
        <li>ยืนราคา 30 วันนับจากวันที่เสนอ</li>
        <li>เครดิต {creditTerm} วันนับจากวันที่ส่งของ</li>
        <li>กรุณายืนยันการสั่งซื้อด้วยลายเซ็นในเอกสาร</li>
      </ul>
    </div>
  );
}
