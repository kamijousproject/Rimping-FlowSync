import { redirect } from "next/navigation";
import { getCurrentUser, listUsers, type UserWithTempGrant } from "@/backend/auth";
import { UsersPageClient } from "./UsersPageClient";

export type { UserWithTempGrant };

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== "super_admin") redirect("/dashboard");
  const users = await listUsers();
  return <UsersPageClient users={users} meId={me.id} />;
}
