import { NextRequest, NextResponse } from "next/server";
import { checkOverdueCustomers } from "@/backend/services/notifications";

export async function POST(request: NextRequest) {
  try {
    // ตรวจสอบว่ามีการเรียกจาก cron job หรือไม่ (security check)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ตรวจสอบและแจ้งเตือนลูกค้าเลยกำหนดชำระ
    await checkOverdueCustomers();

    return NextResponse.json({
      success: true,
      message: "Overdue customer check completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in overdue check cron job:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to check overdue customers",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// รองรับ GET สำหรับการทดสอบ
export async function GET() {
  try {
    await checkOverdueCustomers();
    
    return NextResponse.json({
      success: true,
      message: "Overdue customer check completed (manual test)",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in manual overdue check:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to check overdue customers",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
