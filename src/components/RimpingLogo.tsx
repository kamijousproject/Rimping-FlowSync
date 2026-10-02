/** โลโก้ Rimping สีเขียว (ใช้ /logo.svg เป็น mask) */
export function RimpingLogo({ size = 64 }: { size?: number }) {
  return (
    <div
      aria-label="Rimping"
      className="bg-brand-700 print:bg-brand-700"
      style={{
        width: size,
        height: size,
        WebkitMaskImage: "url(/logo.svg)",
        maskImage: "url(/logo.svg)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    />
  );
}
