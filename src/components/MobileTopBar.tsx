import { Brand } from "./Brand";

export function MobileTopBar({ user }: { user: { full_name: string } }) {
  return (
    <header
      className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="h-14 px-4 flex items-center justify-between">
        <Brand size={36} />
        <div className="text-right leading-tight">
          <div className="text-[10px] text-muted">สวัสดี</div>
          <div className="text-xs font-semibold text-brand-800 truncate max-w-[140px]">
            {user.full_name}
          </div>
        </div>
      </div>
    </header>
  );
}
