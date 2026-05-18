import { NextRequest, NextResponse } from "next/server";
import { query, exec } from "@/backend/db";
import { sendLineNotification } from "@/backend/services/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    const { amount, reason, start_date, end_date } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // ดึงข้อมูลลูกค้าปัจจุบัน
    const [customers] = await query<any[]>(
      "SELECT * FROM customers WHERE id = ?",
      [customerId]
    );

    if (customers.length === 0) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const customer = customers[0];
    const oldLimit = customer.credit_limit;

    // สร้างวงเงินชั่วคราว
    await exec(
      `INSERT INTO temp_credit_limits 
       (customer_id, extra_amount, reason, start_date, end_date, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, 1, 1)`,
      [customerId, amount, reason || null, start_date || new Date().toISOString().split('T')[0], end_date || null]
    );

    const newLimit = oldLimit + amount;

    // ส่ง LINE notification
    try {
      await sendLineNotification('temporary_credit_increase', {
        customer_id: customerId,
        customer_name: customer.name,
        customer_code: customer.code,
        old_limit: oldLimit,
        amount: amount,
        new_limit: newLimit,
        reason: reason,
      });
    } catch (error) {
      console.error('Failed to send LINE notification for temporary credit:', error);
    }

    return NextResponse.json({
      success: true,
      message: "Temporary credit limit added successfully",
      data: {
        customer_id: customerId,
        old_limit: oldLimit,
        extra_amount: amount,
        new_limit: newLimit,
      },
    });
  } catch (error) {
    console.error("Error adding temporary credit:", error);
    return NextResponse.json(
      { error: "Failed to add temporary credit" },
      { status: 500 }
    );
  }
}
