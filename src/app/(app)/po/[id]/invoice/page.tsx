import { notFound } from "next/navigation";
import { getPo } from "@/backend/services/po";
import { getCustomer } from "@/backend/services/customers";
import { getInvoiceWithLogs, listPayments, type InvoiceLog } from "@/backend/services/payments";
import { getNonVatSkus } from "@/backend/services/inventory";
import { SalesDocument } from "@/components/SalesDocument";
import { fmtMoney } from "@/components/StatusBadge";
import { InvoicePrintBar } from "./InvoicePrintBar";
import { getUserById } from "@/backend/auth";
import { Download, Eye, Printer, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

// Helper to format action
function formatAction(action: string): string {
  const actions: Record<string, string> = {
    created: "สร้าง",
    downloaded: "ดาวน์โหลด",
    printed: "พิมพ์",
    viewed: "ดู",
  };
  return actions[action] || action;
}

// Helper to get action icon
function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case "created":
      return <FileText className="w-3 h-3" />;
    case "downloaded":
      return <Download className="w-3 h-3" />;
    case "printed":
      return <Printer className="w-3 h-3" />;
    case "viewed":
      return <Eye className="w-3 h-3" />;
    default:
      return <Eye className="w-3 h-3" />;
  }
}

// Download logs component
function DownloadLogs({ logs }: { logs: InvoiceLog[] }) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="mt-6 print:hidden">
      <h3 className="text-sm font-medium text-brand-800 mb-3 flex items-center gap-2">
        <Download className="w-4 h-4" />
        ประวัติการดาวน์โหลด ({logs.filter(l => l.action === "downloaded").length} ครั้ง)
      </h3>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between text-xs py-1 border-b border-gray-200 last:border-0"
          >
            <div className="flex items-center gap-2">
              <span className="text-muted">
                <ActionIcon action={log.action} />
              </span>
              <span className="font-medium">{formatAction(log.action)}</span>
              <span className="text-muted">โดย</span>
              <span>{log.user_name}</span>
            </div>
            <span className="text-muted">
              {new Date(log.created_at).toLocaleString("th-TH")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inv?: string }>;
}) {
  const { id } = await params;
  const { inv } = await searchParams;
  const data = await getPo(Number(id));
  if (!data) notFound();
  const { po, items } = data;
  const [customer, creator, nonVat] = await Promise.all([
    getCustomer(po.customer_id),
    getUserById(po.created_by),
    getNonVatSkus(items.map((it) => it.product_name)),
  ]);

  let invoice = null;
  let logs: InvoiceLog[] = [];
  let downloadCount = 0;

  if (inv) {
    const result = await getInvoiceWithLogs(Number(inv));
    invoice = result.invoice;
    logs = result.logs;
    downloadCount = result.download_count;
  }
  const invNo =
    invoice?.invoice_number ||
    `INV-${po.po_number.replace("PO", "")}-PREVIEW`;
  const amount = Number(invoice?.amount ?? po.remaining_amount);
  const issuedAt = invoice?.generated_at
    ? new Date(invoice.generated_at)
    : new Date();
  const dueDate = po.due_date
    ? new Date(po.due_date).toLocaleDateString("th-TH")
    : "-";

  const payments = invoice ? await listPayments(po.id) : [];

  return (
    <div className="max-w-[820px] mx-auto">
      <InvoicePrintBar invoiceId={invoice?.id} />
      <SalesDocument
        id="invoice-doc"
        title="ใบเสร็จรับเงิน/ใบกำกับภาษี"
        meta={[
          ["เลขที่เอกสาร :", invNo],
          ...(po.tax_invoice_number
            ? [["เลขที่ใบกำกับ :", po.tax_invoice_number] as [string, string]]
            : []),
          ["วันที่ออก :", issuedAt.toLocaleDateString("th-TH")],
          ["กำหนดชำระ :", dueDate],
          ["อ้างอิง :", po.po_number],
        ]}
        customer={{
          ...customer,
          name: po.customer_name ?? customer?.name ?? "",
          code: customer?.code || `C${String(po.customer_id).padStart(6, "0")}`,
        }}
        contactName={creator?.full_name}
        items={items.map((it) => ({ ...it, vatable: !nonVat.has(it.product_name) }))}
        notes={po.notes}
        payment={
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-0.5">
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>วันที่ชำระ : {new Date(p.paid_at).toLocaleDateString("th-TH")}</span>
                  <span>{fmtMoney(p.amount)} บาท</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold">
                <span>ชำระแล้ว :</span>
                <span>{fmtMoney(po.paid_amount)} บาท</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>คงค้าง :</span>
                <span>{fmtMoney(po.remaining_amount)} บาท</span>
              </div>
              {invoice && Math.abs(amount - Number(po.total)) > 0.01 && (
                <div className="flex justify-between font-bold text-brand-800">
                  <span>ยอดเรียกเก็บในเอกสารนี้ :</span>
                  <span>{fmtMoney(amount)} บาท</span>
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="font-semibold">โอนเงินเข้าบัญชีธนาคาร</div>
              <div>ธนาคารกรุงเทพ สาขาท่าแพ-เชียงใหม่</div>
              <div>
                ออมทรัพย์ <span className="font-mono font-semibold">251-5-01738-8</span>
              </div>
              <div>TRNTRAPHAN SUPPERMARKET (1944) CO., LTD.</div>
            </div>
          </div>
        }
        signatures={[
          { label: "ผู้ออกเอกสาร (ผู้ขาย)", name: creator?.full_name },
          { label: "ผู้อนุมัติเอกสาร (ผู้ขาย)" },
          { label: "ผู้รับเอกสาร (ลูกค้า)" },
        ]}
      />

      {/* Download Logs */}
      <DownloadLogs logs={logs} />
    </div>
  );
}
