import { Resend } from "resend";

const MANAGER_EMAIL = process.env.MANAGER_EMAIL || "thanapong@rimping.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@rimping.com";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendCreditLimitApprovalEmail(
  requestId: number,
  token: string,
  customerName: string,
  customerCode: string,
  requestType: "permanent_increase" | "temporary",
  amount: number,
  reason: string | null,
  requesterName: string
): Promise<void> {
  if (!resend) {
    console.warn("Resend not configured. Set RESEND_API_KEY in .env.local");
    console.log(`[EMAIL MOCK] Approval email would be sent to ${MANAGER_EMAIL}`);
    console.log(`[EMAIL MOCK] Approval link: ${BASE_URL}/credit-approval/${token}`);
    return;
  }

  const approvalLink = `${BASE_URL}/credit-approval/${token}`;
  
  const typeText = requestType === "permanent_increase" 
    ? "ขอเพิ่มวงเงินถาวร" 
    : "ขอเพิ่มวงเงินชั่วคราว";

  const subject = `[FlowSync] ${typeText} - ลูกค้า ${customerName}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .detail-row { margin-bottom: 12px; }
    .label { font-weight: bold; color: #374151; }
    .value { color: #111827; }
    .amount { font-size: 24px; color: #16a34a; font-weight: bold; }
    .button-container { text-align: center; margin: 30px 0; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      margin: 0 10px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
    }
    .approve-btn { background: #16a34a; color: white; }
    .reject-btn { background: #dc2626; color: white; }
    .footer { margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${typeText}</h1>
      <p>ระบบ FlowSync - รอการอนุมัติจากผู้จัดการ</p>
    </div>
    <div class="content">
      <div class="detail-row">
        <span class="label">ลูกค้า:</span>
        <span class="value">${customerName} (${customerCode})</span>
      </div>
      <div class="detail-row">
        <span class="label">จำนวนที่ขอ:</span>
        <div class="amount">${amount.toLocaleString()} บาท</div>
      </div>
      <div class="detail-row">
        <span class="label">เหตุผล:</span>
        <span class="value">${reason || "-"}</span>
      </div>
      <div class="detail-row">
        <span class="label">ผู้ขอ:</span>
        <span class="value">${requesterName}</span>
      </div>
      
      <div class="button-container">
        <a href="${approvalLink}" class="button approve-btn">ดูรายละเอียดและอนุมัติ</a>
      </div>
      
      <p style="text-align: center; color: #6b7280; font-size: 14px;">
        หรือคลิกลิงก์นี้: <a href="${approvalLink}" style="color: #16a34a;">${approvalLink}</a>
      </p>
    </div>
    <div class="footer">
      <p>อีเมลนี้ส่งจากระบบ FlowSync อัตโนมัติ กรุณาอย่าตอบกลับ</p>
      <p>หากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${typeText} - รอการอนุมัติ

ลูกค้า: ${customerName} (${customerCode})
จำนวนที่ขอ: ${amount.toLocaleString()} บาท
เหตุผล: ${reason || "-"}
ผู้ขอ: ${requesterName}

กรุณาคลิกลิงก์ด้านล่างเพื่อดูรายละเอียดและอนุมัติ:
${approvalLink}

---
ระบบ FlowSync
  `;

  try {
    const { error } = await resend.emails.send({
      from: `FlowSync System <${FROM_EMAIL}>`,
      to: MANAGER_EMAIL,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(error.message);
    }

    console.log(`Approval email sent to ${MANAGER_EMAIL} for request ${requestId}`);
  } catch (error) {
    console.error("Failed to send approval email:", error);
    throw new Error("ไม่สามารถส่งอีเมลแจ้งเตือนได้");
  }
}
