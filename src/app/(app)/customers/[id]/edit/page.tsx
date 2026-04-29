import { notFound } from "next/navigation";
import { getCustomer } from "@/backend/services/customers";
import { EditCustomerForm } from "./EditCustomerForm";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCustomer(Number(id));
  if (!c) notFound();

  return (
    <EditCustomerForm
      id={c.id}
      initial={{
        code: c.code ?? "",
        name: c.name,
        contact_person: c.contact_person ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        tax_id: c.tax_id ?? "",
        address: c.address ?? "",
        credit_limit: Number(c.credit_limit),
        credit_score: c.credit_score == null ? "" : String(c.credit_score),
        credit_score_notes: c.credit_score_notes ?? "",
        default_credit_term_days: c.default_credit_term_days,
        notes: c.notes ?? "",
      }}
    />
  );
}
