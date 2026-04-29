import { notFound, redirect } from "next/navigation";
import { getPo } from "@/backend/services/po";
import { EditPoForm } from "./EditPoForm";

export const dynamic = "force-dynamic";

export default async function EditPoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPo(Number(id));
  if (!data) notFound();
  if (data.po.payment_status === "paid") {
    redirect(`/po/${id}?denied=paid`);
  }
  return (
    <EditPoForm
      poId={data.po.id}
      poNumber={data.po.po_number}
      customerId={data.po.customer_id}
      customerName={data.po.customer_name || ""}
      paidAmount={Number(data.po.paid_amount)}
      initialCreditTerm={data.po.credit_term_days}
      initialNotes={data.po.notes || ""}
      initialItems={data.items.map((it) => ({
        product_name: it.product_name,
        description: it.description || "",
        quantity: Number(it.quantity),
        unit: it.unit || "ชิ้น",
        unit_price: Number(it.unit_price),
      }))}
    />
  );
}
