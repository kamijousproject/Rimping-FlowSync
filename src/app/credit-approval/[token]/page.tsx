"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface CreditLimitRequest {
  id: number;
  request_type: "permanent_increase" | "temporary";
  customer_id: number;
  customer_name: string;
  customer_code: string;
  amount: number | null;
  extra_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requester_name: string;
  created_at: string;
}

export default function CreditApprovalPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [request, setRequest] = useState<CreditLimitRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    
    fetch(`/api/credit-approval/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "ไม่พบคำขอ");
        }
        return res.json();
      })
      .then((data) => {
        setRequest(data.request);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  async function handleApprove() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/credit-approval/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", approved_by: 1 }), // TODO: get actual user id
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "อนุมัติไม่สำเร็จ");
      }
      
      setResult({ type: "success", message: "อนุมัติคำขอสำเร็จแล้ว" });
      if (request) {
        setRequest({ ...request, status: "approved" });
      }
    } catch (err: any) {
      setResult({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/credit-approval/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "reject", 
          rejected_by: 1, // TODO: get actual user id
          reason: rejectReason 
        }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "ปฏิเสธไม่สำเร็จ");
      }
      
      setResult({ type: "success", message: "ปฏิเสธคำขอสำเร็จแล้ว" });
      if (request) {
        setRequest({ ...request, status: "rejected" });
      }
      setShowRejectForm(false);
    } catch (err: any) {
      setResult({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-muted">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-red-600 mb-2">ไม่พบคำขอ</h1>
          <p className="text-muted">{error}</p>
          <p className="text-sm text-muted mt-4">
            ลิงก์อาจหมดอายุหรือคำขอถูกดำเนินการแล้ว
          </p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const isPending = request.status === "pending";
  const isApproved = request.status === "approved";
  const isRejected = request.status === "rejected";

  const typeText = request.request_type === "permanent_increase" 
    ? "ขอเพิ่มวงเงินถาวร" 
    : "ขอเพิ่มวงเงินชั่วคราว";

  const amount = request.request_type === "permanent_increase" 
    ? request.amount 
    : request.extra_amount;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-brand-600 text-white rounded-t-xl p-6 text-center">
          <h1 className="text-2xl font-bold">{typeText}</h1>
          <p className="text-brand-100 mt-1">ระบบ FlowSync</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-b-xl shadow-lg p-6">
          {/* Status Badge */}
          <div className="text-center mb-6">
            {isPending && (
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                ⏳ รอการอนุมัติ
              </span>
            )}
            {isApproved && (
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-800 font-semibold">
                ✅ อนุมัติแล้ว
              </span>
            )}
            {isRejected && (
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-red-100 text-red-800 font-semibold">
                ❌ ปฏิเสธแล้ว
              </span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted">ลูกค้า</span>
              <span className="font-semibold">
                {request.customer_name} ({request.customer_code})
              </span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted">จำนวนที่ขอ</span>
              <span className="text-2xl font-bold text-brand-600">
                {amount?.toLocaleString()} บาท
              </span>
            </div>
            
            {request.request_type === "temporary" && (
              <>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted">วันที่เริ่มต้น</span>
                  <span className="font-semibold">{request.start_date}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted">วันที่สิ้นสุด</span>
                  <span className="font-semibold">{request.end_date}</span>
                </div>
              </>
            )}
            
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted">เหตุผล</span>
              <span className="font-semibold">{request.reason || "-"}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted">ผู้ขอ</span>
              <span className="font-semibold">{request.requester_name}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted">วันที่ขอ</span>
              <span className="font-semibold">
                {new Date(request.created_at).toLocaleDateString("th-TH")}
              </span>
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div className={`mb-6 p-4 rounded-lg text-center ${
              result.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}>
              {result.message}
            </div>
          )}

          {/* Action Buttons */}
          {isPending && (
            <div className="space-y-3">
              {!showRejectForm ? (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    {actionLoading ? "กำลังดำเนินการ..." : "✅ อนุมัติ"}
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={actionLoading}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    ❌ ปฏิเสธ
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="เหตุผลในการปฏิเสธ (ไม่บังคับ)"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                    >
                      {actionLoading ? "กำลังดำเนินการ..." : "ยืนยันการปฏิเสธ"}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t text-center text-sm text-muted">
            <p>อีเมลนี้ส่งจากระบบ FlowSync อัตโนมัติ</p>
            <p>หากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
