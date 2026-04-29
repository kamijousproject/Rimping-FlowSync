import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/backend/auth";

export default async function NewCustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!isSuperAdmin(user)) {
    redirect("/customers?denied=1");
  }
  return <>{children}</>;
}
