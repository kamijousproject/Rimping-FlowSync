"use client";
import Image from "next/image";
import { fmtMoney } from "@/components/StatusBadge";
import { bahtText } from "@/lib/bahtText";

export type QuoteDocItem = {
  product_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

export type QuoteDocCustomer = {
  name: string;
  contact_person: string | null;
  address: string | null;
  phone: string | null;
  tax_id: string | null;
};

/**
 * Printable ใบเสนอราคา rendered straight from in-memory form state — no PO and
 * no quotation row exists yet, so there is no document number to show. Carries
 * id="quotation-doc" to inherit the shared A4 print rules in globals.css.
 */
export function QuoteDocument({
  customer,
  items,
  notes,
  creditTerm,
  issuedAt,
  creatorName,
}: {
  customer: QuoteDocCustomer | null;
  items: QuoteDocItem[];
  notes: string;
  creditTerm: number;
  issuedAt: Date | null;
  creatorName: string | null;
}) {
  const total = items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
    0
  );
  const validUntil = issuedAt
    ? new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <div
      className="bg-white p-10 print:p-8 print:shadow-none print:border-0 print:rounded-none"
      id="quotation-doc"
    >
      {/* Header: issuer + title */}
      <div className="flex items-start justify-between border-b-2 border-brand-600 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <Image
              src="/logo.svg"
              alt="Rimping"
              width={40}
              height={40}
              style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }}
            />
          </div>
          <div className="text-xs leading-relaxed">
            <div className="text-base font-bold text-brand-800">
              บริษัท ตันตราภัณฑ์ซุปเปอร์มาร์เก็ต (1994) จำกัด
            </div>
            <div className="text-muted">
              Trntraphan Suppermarket (1944) Co., Ltd.
            </div>
            <div className="mt-1">
              199/8 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100
            </div>
            <div>Tel. 063-535-0299, 093-130-0295 (คุณยา)</div>
            <div>Dararat@rimping.com, Foodservice@rimping.com</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-brand-700">QUOTATION</div>
          <div className="text-sm text-foreground">ใบเสนอราคา</div>
          <div className="text-xs text-muted mt-2">
            วันที่: {issuedAt ? issuedAt.toLocaleDateString("th-TH") : "—"}
          </div>
          <div className="text-xs text-muted">
            ยังไม่ออกเลขที่เอกสาร (ใบเสนอราคาเบื้องต้น)
          </div>
        </div>
      </div>

      {/* Customer + Payment block */}
      <div className="grid grid-cols-2 gap-6 mt-6 text-sm">
        <div className="border border-border rounded p-3">
          <div className="text-xs text-muted mb-1">ผู้ซื้อ / Customer</div>
          {customer ? (
            <>
              <div className="font-semibold">{customer.name}</div>
              {customer.contact_person && (
                <div className="text-xs">ผู้ติดต่อ: {customer.contact_person}</div>
              )}
              {customer.address && (
                <div className="text-xs mt-1 whitespace-pre-wrap">
                  {customer.address}
                </div>
              )}
              <div className="text-xs mt-1">
                {customer.phone && <>โทร. {customer.phone}</>}
                {customer.tax_id && (
                  <span className="ml-2">
                    เลขประจำตัวผู้เสียภาษี: {customer.tax_id}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted mt-3 space-y-3">
              <div className="border-b border-dotted border-gray-400" />
              <div className="border-b border-dotted border-gray-400" />
              <div className="border-b border-dotted border-gray-400" />
            </div>
          )}
        </div>
        <div className="border border-border rounded p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">การชำระ:</span>
            <span>เครดิต {creditTerm} วัน</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">วันที่เสนอ:</span>
            <span>{issuedAt ? issuedAt.toLocaleDateString("th-TH") : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">ยืนราคาถึง:</span>
            <span>{validUntil ? validUntil.toLocaleDateString("th-TH") : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">สกุลเงิน:</span>
            <span>บาท (THB)</span>
          </div>
        </div>
      </div>

      {/* Items table */}
      <table className="w-full text-sm mt-6 border-collapse">
        <thead>
          <tr className="bg-brand-50 text-brand-800 text-xs">
            <th className="p-2 border border-brand-200 w-10">ลำดับ</th>
            <th className="text-left p-2 border border-brand-200">
              รายการสินค้า / Description
            </th>
            <th className="text-right p-2 border border-brand-200 w-20">จำนวน</th>
            <th className="text-left p-2 border border-brand-200 w-16">หน่วย</th>
            <th className="text-right p-2 border border-brand-200 w-24">
              ราคา/หน่วย
            </th>
            <th className="text-right p-2 border border-brand-200 w-28">
              จำนวนเงิน
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td className="text-center p-2 border border-border">{idx + 1}</td>
              <td className="p-2 border border-border">
                <div className="font-medium">{it.product_name}</div>
                {it.description && (
                  <div className="text-xs text-muted">{it.description}</div>
                )}
              </td>
              <td className="text-right p-2 border border-border">
                {Number(it.quantity)}
              </td>
              <td className="p-2 border border-border">{it.unit}</td>
              <td className="text-right p-2 border border-border">
                {fmtMoney(it.unit_price)}
              </td>
              <td className="text-right p-2 border border-border font-medium">
                {fmtMoney(Number(it.quantity || 0) * Number(it.unit_price || 0))}
              </td>
            </tr>
          ))}
          {/* Filler rows for visual consistency when few items */}
          {items.length < 5 &&
            Array.from({ length: 5 - items.length }).map((_, i) => (
              <tr key={`pad-${i}`} className="h-8">
                <td className="border border-border" />
                <td className="border border-border" />
                <td className="border border-border" />
                <td className="border border-border" />
                <td className="border border-border" />
                <td className="border border-border" />
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr className="bg-brand-50 font-bold">
            <td colSpan={5} className="p-2 text-right border border-brand-200">
              รวมสุทธิ / Grand Total
            </td>
            <td className="text-right p-2 border border-brand-200 text-brand-800 text-lg">
              {fmtMoney(total)} ฿
            </td>
          </tr>
          <tr>
            <td
              colSpan={6}
              className="p-2 text-center border border-border italic text-xs"
            >
              ({bahtText(total)})
            </td>
          </tr>
        </tfoot>
      </table>

      {notes && (
        <div className="mt-4 text-xs">
          <div className="font-semibold text-brand-800 mb-1">หมายเหตุ:</div>
          <div className="whitespace-pre-wrap border border-border rounded p-2">
            {notes}
          </div>
        </div>
      )}

      {/* Payment instructions */}
      <div className="mt-6 grid grid-cols-2 gap-6 text-xs print-avoid-break">
        <div className="border border-border rounded p-3">
          <div className="font-semibold text-brand-800 mb-1">
            วิธีชำระเงิน / Payment Method
          </div>
          <div>
            <div>โอนเงินเข้าบัญชีธนาคาร</div>
            <div className="mt-1">ชื่อบัญชี ธนาคารกรุงเทพ สาขาท่าแพ-เชียงใหม่</div>
            <div>
              เลขที่บัญชี: <span className="font-mono">251-5-01738-8</span>
            </div>
            <div>ประเภทบัญชี: ออมทรัพย์</div>
            <div className="mt-1 text-muted">
              Bangkok Bank Account No. 251-5-01738-8
            </div>
            <div className="text-muted">
              Account Name: TRNTRAPHAN SUPPERMARKET (1944) CO., LTD.
            </div>
          </div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="font-semibold text-brand-800 mb-1">เงื่อนไข / Terms</div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>ราคารวมภาษีมูลค่าเพิ่มแล้ว</li>
            <li>ยืนราคา 30 วันนับจากวันที่เสนอ</li>
            <li>เครดิต {creditTerm} วันนับจากวันที่ส่งของ</li>
            <li>กรุณายืนยันการสั่งซื้อด้วยลายเซ็นในเอกสาร</li>
          </ul>
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-12 grid grid-cols-2 gap-12 text-xs print-avoid-break">
        <div className="text-center">
          <div className="text-xs mb-2">ลงชื่อ ผู้เสนอราคา</div>
          <div className="h-10 flex items-end justify-center">
            {creatorName && (
              <span className="font-semibold text-sm">{creatorName}</span>
            )}
          </div>
          <div className="border-t border-foreground mt-1" />
          <div className="text-muted mt-2">วันที่ ………/………/…………</div>
        </div>
        <div className="text-center">
          <div className="text-xs mb-2">ลงชื่อ ผู้สั่งซื้อ / ลูกค้า</div>
          <div className="h-10" />
          <div className="border-t border-foreground mt-1" />
          <div className="text-muted mt-2">วันที่ ………/………/…………</div>
        </div>
      </div>
    </div>
  );
}
