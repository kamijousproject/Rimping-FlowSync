"use client";
import { useState } from "react";

export function DeleteCustomerButton({ customerId, customerName }: { 
  customerId: number; 
  customerName: string; 
}) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`ต้องการลบลูกค้า "${customerName}" ใช่หรือไม่?\n\nการลบนี้ไม่สามารถย้อนกลับได้!`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ไม่สามารถลบลูกค้าได้');
      }

      // ลบสำเร็จ ไปที่หน้าลูกค้า
      window.location.href = '/customers';
    } catch (error) {
      console.error('Delete error:', error);
      alert(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบลูกค้า');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {showConfirm ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-red-600">ยืนยันการลบ?</span>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "กำลังลบ..." : "ลบ"}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
          >
           ยกเลิก
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          ลบลูกค้า
        </button>
      )}
    </div>
  );
}
