import { redirect } from "next/navigation";
import { getCurrentUser } from "@/backend/auth";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
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
    <div className="flex min-h-screen bg-background print:min-h-0 print:block">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <MobileTopBar user={user} />
        <Navbar user={user} />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 print:p-0 print:pb-0 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
