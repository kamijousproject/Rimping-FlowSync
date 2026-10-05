import Link from "next/link";
import { notFound } from "next/navigation";
import { getPo } from "@/backend/services/po";
import { getCustomer } from "@/backend/services/customers";
import { getNonVatSkus } from "@/backend/services/inventory";
import { getUserById } from "@/backend/auth";
import { fmtMoney } from "@/components/StatusBadge";
import { RimpingLogo } from "@/components/RimpingLogo";
import { bahtText } from "@/lib/bahtText";
import { vatBreakdown } from "@/lib/vat";
import { COMPANY, taxInvoiceDate, thDate } from "@/lib/company";
import { billingParty } from "@/lib/billing";
import { InvoicePrintBar } from "../invoice/InvoicePrintBar";

export const dynamic = "force-dynamic";

// ราคาต่อหน่วยก่อน VAT (ราคาใน PO รวม VAT แล้วสำหรับสินค้าที่มี VAT)
const exVatUnit = (price: number, vatable: boolean) =>
  vatable ? Math.round(((price * 100) / 107) * 100) / 100 : price;

function PartyBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-3 leading-relaxed">
      <div className="text-[11px] font-semibold text-brand-700 mb-1">{title}</div>
      {children}
    </div>
  );
}

/** ใบส่งของ/ใบกำกับภาษี (A4) — เปิดได้ตั้งแต่ confirmed, การคำนวณ VAT ใช้ vatBreakdown เดิม */
export default async function TaxInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copy?: string }>;
}) {
  const { id } = await params;
  const { copy } = await searchParams;
  const data = await getPo(Number(id));
  if (!data) notFound();
  const { po, items } = data;

  if (po.status === "draft" || po.status === "cancelled") {
    return (
      <div className="max-w-[820px] mx-auto card p-6 text-sm">
        ออกใบส่งของ/ใบกำกับภาษีได้เมื่อ Quotation ถูกยืนยัน (confirmed) แล้วเท่านั้น
        <div className="mt-3">
          <Link href={`/po/${po.id}`} className="text-brand-700 hover:underline">← กลับ</Link>
        </div>
      </div>
    );
  }

  const [customer, creator, nonVat] = await Promise.all([
    getCustomer(po.customer_id),
    getUserById(po.created_by),
    getNonVatSkus(items.map((it) => it.product_name)),
  ]);
  const lines = items.map((it) => ({ ...it, vatable: !nonVat.has(it.product_name) }));
  const isGroup = !!customer?.group_id;
  // ลูกค้ากลุ่ม (7-11) → ผู้ซื้อเป็นนิติบุคคลของกลุ่ม + สาขาตามรหัสร้าน
  const buyer = billingParty({ ...customer, name: po.customer_name ?? customer?.name ?? "" });
  // ผู้ติดต่อ: ลูกค้ากลุ่มแสดงชื่อร้าน(รหัสร้าน) แทนผู้จัดการร้าน
  const storeName = po.customer_name ?? customer?.name ?? "";
  const storeNo = customer?.code?.match(/(\d+)\s*$/)?.[1];
  const contactName = buyer.branch
    ? storeNo && !storeName.includes(storeNo)
      ? `${storeName} (${storeNo})`
      : storeName
    : customer?.contact_person;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  // ลูกค้ากลุ่ม (7-11): คิดแบบเดียวกับใบเสนอราคากลุ่ม — ราคาในระบบ = ราคาก่อน VAT,
  // ราคารวม VAT = ราคา × 1.07, จำนวนเงินรวม = Σ (ราคารวม VAT × จำนวน)
  // ลูกค้าทั่วไป: ถอด VAT จากราคา (vatBreakdown เดิม)
  const groupRows = lines.map((it) => {
    const price = Number(it.unit_price);
    const gross = it.vatable ? Math.round(price * 107) / 100 : price;
    return { ...it, unit_ex: price, gross, value: r2(price * Number(it.quantity)) };
  });
  const std = vatBreakdown(lines);
  const rows = isGroup
    ? groupRows
    : std.rows.map((it) => ({
        ...it,
        unit_ex: exVatUnit(Number(it.unit_price), it.vatable),
        gross: Number(it.unit_price),
        value: it.pre_tax,
      }));
  const total = isGroup
    ? r2(groupRows.reduce((s, it) => s + it.gross * Number(it.quantity), 0))
    : std.total;
  const exempt = isGroup
    ? r2(groupRows.filter((it) => !it.vatable).reduce((s, it) => s + it.value, 0))
    : std.exempt;
  const vatBase = isGroup
    ? r2(groupRows.filter((it) => it.vatable).reduce((s, it) => s + it.value, 0))
    : std.vatBase;
  const vat = isGroup ? r2(total - exempt - vatBase) : std.vat;
  const isCopy = copy === "1";

  return (
    <div className="max-w-[820px] mx-auto">
      <InvoicePrintBar />
      <div className="flex justify-end gap-2 mb-3 text-xs print:hidden">
        <Link
          href={`/po/${po.id}/tax-invoice`}
          className={`px-3 py-1 rounded-full border ${!isCopy ? "bg-brand-600 border-brand-600 text-white" : "border-border text-muted"}`}
        >
          ต้นฉบับ
        </Link>
        <Link
          href={`/po/${po.id}/tax-invoice?copy=1`}
          className={`px-3 py-1 rounded-full border ${isCopy ? "bg-brand-600 border-brand-600 text-white" : "border-border text-muted"}`}
        >
          สำเนา
        </Link>
      </div>

      <div
        id="tax-invoice-doc"
        className="relative bg-white border border-border shadow rounded-lg p-10 text-[13px] flex flex-col min-h-[1100px] print:min-h-[270mm] print:shadow-none print:border-0 print:rounded-none print:p-0"
      >
        {/* มุมขวาบน */}
        <div
          className="absolute top-0 right-0 w-20 h-20 bg-brand-700 print:bg-brand-700"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
        />

        {/* Header: โลโก้ + ชื่อเอกสาร */}
        <div className="flex items-start justify-between">
          <RimpingLogo size={90} />
          <div className="text-right pr-16 pt-4">
            <div className="text-2xl font-bold text-brand-700">ใบส่งของ/ใบกำกับภาษี</div>
            <div className="text-xs text-brand-700">{isCopy ? "สำเนา" : "ต้นฉบับ"}</div>
          </div>
        </div>

        {/* ผู้ขาย | ผู้ซื้อ */}
        <div className="grid grid-cols-2 gap-4 mt-5">
          <PartyBox title="ผู้ขาย">
            <div className="font-semibold text-[14px]">{COMPANY.name}</div>
            <div>{COMPANY.address}</div>
            <div>
              <span className="text-muted">เลขประจำตัวผู้เสียภาษี</span> {COMPANY.taxId}
            </div>
          </PartyBox>
          <PartyBox title="ผู้ซื้อ">
            <div className="font-semibold text-[14px]">{buyer.name}</div>
            {buyer.address && <div className="whitespace-pre-wrap">{buyer.address}</div>}
            {buyer.tax_id && (
              <div>
                <span className="text-muted">เลขประจำตัวผู้เสียภาษี</span> {buyer.tax_id}
              </div>
            )}
            {buyer.branch && (
              <div>
                <span className="text-muted">สาขาที่</span> {buyer.branch.replace(/^สาขาที่\s*/, "")}
              </div>
            )}
            {(contactName || customer?.phone || customer?.email) && (
              <div className="border-t border-border mt-1.5 pt-1.5 flex flex-wrap gap-x-4">
                {contactName && (
                  <span>
                    <span className="text-muted">ผู้ติดต่อ</span> {contactName}
                  </span>
                )}
                {customer?.phone && (
                  <span>
                    <span className="text-muted">โทร</span> {customer.phone}
                  </span>
                )}
                {customer?.email && (
                  <span>
                    <span className="text-muted">อีเมล</span> {customer.email}
                  </span>
                )}
              </div>
            )}
          </PartyBox>
        </div>

        {/* ข้อมูลเอกสาร */}
        <div
          className="grid grid-cols-6 mt-4 rounded-lg bg-brand-50 text-center divide-x divide-brand-100"
          style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
        >
          {[
            ["เลขที่", po.tax_invoice_number || "-"],
            ["วันที่", thDate(taxInvoiceDate(po))],
            ["เครดิต", `${po.credit_term_days} วัน`],
            ["ครบกำหนด", po.due_date ? thDate(po.due_date) : "-"],
            ["พนักงานขาย", creator?.full_name ?? "-"],
            ["อ้างอิง", po.doc_reference || po.po_number],
          ].map(([label, value], i) => (
            <div key={label} className="px-2 py-2">
              <div className="text-[11px] text-brand-700">{label}</div>
              <div className={`truncate ${i === 0 ? "font-bold" : "font-medium"}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Items */}
        <table className="w-full mt-6 border-collapse">
          <thead>
            <tr className="border-y border-border font-semibold">
              <th className="p-2 w-28 text-left">รหัสสินค้า</th>
              <th className="p-2 text-center">รายละเอียด</th>
              <th className="p-2 w-24 text-right">จำนวน</th>
              <th className="p-2 w-32 text-center">ราคาต่อหน่วย</th>
              {isGroup && <th className="p-2 w-14 text-center">VAT</th>}
              {isGroup && <th className="p-2 w-28 text-center">ราคารวม VAT</th>}
              <th className="p-2 w-28 text-right">{isGroup ? "มูลค่าก่อนภาษี" : "มูลค่า"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.id} className="border-b border-border align-top">
                <td className="p-2 font-mono whitespace-nowrap">{it.product_name}</td>
                <td className="p-2">{it.description || it.product_name}</td>
                <td className="p-2 text-right">
                  {Number(it.quantity)} {it.unit}
                </td>
                <td className="p-2 text-center">{fmtMoney(it.unit_ex)}</td>
                {isGroup && <td className="p-2 text-center">{it.vatable ? "7%" : "-"}</td>}
                {isGroup && <td className="p-2 text-center">{fmtMoney(it.gross)}</td>}
                <td className="p-2 text-right">{fmtMoney(it.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="flex justify-between items-end mt-4 print-avoid-break">
          <div>({bahtText(total)})</div>
          <div className="space-y-1 text-right">
            <div className="grid grid-cols-[1fr_110px] gap-4">
              <span className="text-brand-700">ราคาไม่รวมภาษีมูลค่าเพิ่ม</span>
              <span>{fmtMoney(vatBase)} บาท</span>
            </div>
            {exempt > 0 && (
              <div className="grid grid-cols-[1fr_110px] gap-4">
                <span className="text-brand-700">มูลค่าสินค้าที่ไม่มีภาษี</span>
                <span>{fmtMoney(exempt)} บาท</span>
              </div>
            )}
            <div className="grid grid-cols-[1fr_110px] gap-4">
              <span className="text-brand-700">ภาษีมูลค่าเพิ่ม 7%</span>
              <span>{fmtMoney(vat)} บาท</span>
            </div>
            <div className="grid grid-cols-[1fr_110px] gap-4 font-bold">
              <span className="text-brand-700">จำนวนเงินรวมทั้งสิ้น</span>
              <span>{fmtMoney(total)} บาท</span>
            </div>
          </div>
        </div>

        {/* Footer: ชำระเงิน + ลายเซ็น (ชิดล่างกระดาษ) */}
        <div className="mt-auto pt-10 space-y-6 print-avoid-break">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>การชำระเงินจะสมบูรณ์เมื่อบริษัทได้รับเงินเรียบร้อยแล้ว</span>
            {["เงินสด", "เช็ค", "โอนเงิน", "บัตรเครดิต"].map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 border border-foreground rounded-sm" /> {m}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr] gap-2 items-end">
            {["ธนาคาร", "เลขที่", "วันที่", "จำนวนเงิน"].map((l) => (
              <FragmentLine key={l} label={l} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-10 pt-4">
            <SignBlock party={`ในนาม ${buyer.name}`} role="ผู้รับสินค้า" />
            <SignBlock party={`ในนาม ${COMPANY.name}`} role="ผู้ขาย" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FragmentLine({ label }: { label: string }) {
  return (
    <>
      <span>{label}</span>
      <span className="border-b border-foreground h-5" />
    </>
  );
}

function SignBlock({ party, role }: { party: string; role: string }) {
  return (
    <div>
      <div>{party}</div>
      <div className="grid grid-cols-2 gap-4 mt-16 text-center">
        <div>
          <div className="border-t border-foreground" />
          <div className="mt-1">{role}</div>
        </div>
        <div>
          <div className="border-t border-foreground" />
          <div className="mt-1">วันที่</div>
        </div>
      </div>
    </div>
  );
}
