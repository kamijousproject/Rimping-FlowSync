// Convert a number to Thai baht text (อ่านเป็นตัวอักษร)
// e.g. 25382 -> "สองหมื่นห้าพันสามร้อยแปดสิบสองบาทถ้วน"

const NUM = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function readInt(numStr: string): string {
  if (numStr === "0") return "ศูนย์";
  let result = "";
  const len = numStr.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(numStr[i]);
    const pos = len - i - 1;
    if (digit === 0) continue;
    if (pos === 1 && digit === 1) {
      result += "สิบ";
    } else if (pos === 1 && digit === 2) {
      result += "ยี่สิบ";
    } else if (pos === 0 && digit === 1 && len > 1) {
      result += "เอ็ด";
    } else {
      result += NUM[digit] + POS[pos];
    }
  }
  return result;
}

export function bahtText(n: number): string {
  if (isNaN(n)) return "";
  const negative = n < 0;
  const abs = Math.abs(n);
  const baht = Math.floor(abs);
  const satang = Math.round((abs - baht) * 100);

  let text = "";
  if (baht > 0) {
    // Handle numbers >= 1,000,000 by splitting
    if (baht >= 1000000) {
      const millions = Math.floor(baht / 1000000);
      const remainder = baht % 1000000;
      text += readInt(String(millions)) + "ล้าน";
      if (remainder > 0) text += readInt(String(remainder));
    } else {
      text += readInt(String(baht));
    }
    text += "บาท";
  }

  if (satang === 0) {
    text += baht > 0 ? "ถ้วน" : "ศูนย์บาทถ้วน";
  } else {
    text += readInt(String(satang)) + "สตางค์";
  }

  return (negative ? "ลบ" : "") + text;
}
