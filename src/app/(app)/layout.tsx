import { redirect } from "next/navigation";
import { getCurrentUser } from "@/backend/auth";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { MobileTopBar } from "@/components/MobileTopBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen print:min-h-0 print:block">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar user={user} />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 print:p-0 print:pb-0 overflow-x-hidden">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
