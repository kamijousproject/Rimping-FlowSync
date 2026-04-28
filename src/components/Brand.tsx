import Image from "next/image";

export function Brand({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-lg bg-brand-600 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.svg"
          alt="Rimping"
          width={size - 8}
          height={size - 8}
          style={{
            filter: "brightness(0) invert(1)",
            objectFit: "contain",
          }}
        />
      </div>
      <div className="leading-tight">
        <div className="text-base font-bold text-brand-800">FlowSync</div>
        <div className="text-[10px] text-muted -mt-0.5">by Rimping</div>
      </div>
    </div>
  );
}
