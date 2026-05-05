import { NextRequest, NextResponse } from "next/server";
import { testLineConnection } from "@/backend/services/notifications";

export async function POST() {
  try {
    const success = await testLineConnection();
    
    return NextResponse.json({
      success,
      message: success ? "LINE notification test successful" : "LINE notification test failed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("LINE notification test error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "LINE notification test error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
