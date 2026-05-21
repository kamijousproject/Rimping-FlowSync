"""
RPA Bot Mock — FastAPI

Stateless design: creation time and function_id are encoded in the job_id itself,
so the server can be restarted freely without losing job state.

Job ID format: JOB-{unix_timestamp}-{function_id}-{random_hex8}

Endpoints:
  POST /rpa/trigger         — receive function call, return job_id
  GET  /rpa/jobs/{job_id}   — poll job status with granular progress steps

Run:
  uvicorn rpa_mock:app --port 8001 --reload
"""

import hashlib
import random
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any

app = FastAPI(title="RPA Bot Mock", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Total simulated delay before the bot finishes (seconds)
JDA_DELAY_SECONDS = 300  # 5 minutes

# Progress steps: (min_elapsed, max_elapsed, step_key, label_th, progress_pct)
_STEPS_FN1 = [
    (0,   60,  "queued",     "รับคำสั่งแล้ว รอคิว",       5),
    (60,  120, "connecting", "กำลังเชื่อมต่อระบบ JDA",     25),
    (120, 180, "creating",   "กำลังสร้าง PO ใน JDA",       50),
    (180, 240, "verifying",  "กำลังตรวจสอบข้อมูล",         70),
    (240, 300, "confirming", "กำลังยืนยันและบันทึก",        90),
]

_STEPS_FN2 = [
    (0,   60,  "queued",     "รับคำสั่งแล้ว รอคิว",       5),
    (60,  120, "connecting", "กำลังเชื่อมต่อระบบ JDA",     25),
    (120, 180, "matching",   "จับคู่ PO และยอดชำระ",        50),
    (180, 240, "deducting",  "กำลังตัดยอดหนี้ใน JDA",      70),
    (240, 300, "confirming", "กำลังยืนยันและบันทึก",        90),
]


def _get_step(elapsed: float, function_id: int) -> dict:
    steps = _STEPS_FN1 if function_id == 1 else _STEPS_FN2
    for min_e, max_e, key, label, pct in steps:
        if min_e <= elapsed < max_e:
            return {"step": key, "step_label": label, "progress": pct}
    return {"step": "confirming", "step_label": "กำลังยืนยันและบันทึก", "progress": 95}


def _deterministic_result(job_id: str, function_id: int) -> str:
    """Generate a stable result value from the job_id so it never changes between polls."""
    seed = int(hashlib.md5(job_id.encode()).hexdigest(), 16)
    rng = random.Random(seed)
    if function_id == 1:
        return f"JDA{rng.randint(100000, 999999)}"
    return f"TXN{rng.randint(1000000, 9999999)}"


def _make_job_id(function_id: int) -> str:
    ts = int(time.time())
    rand = uuid.uuid4().hex[:8].upper()
    return f"JOB-{ts}-{function_id}-{rand}"


def _parse_job_id(job_id: str) -> tuple[float, int] | None:
    """Return (created_at, function_id) or None if the format is unrecognised."""
    parts = job_id.split("-")
    # Expected: ['JOB', '{ts}', '{fn_id}', '{rand}']
    if len(parts) != 4 or parts[0] != "JOB":
        return None
    try:
        return float(parts[1]), int(parts[2])
    except ValueError:
        return None


class TriggerRequest(BaseModel):
    function_id: int
    data: dict[str, Any]


@app.post("/rpa/trigger")
def trigger(req: TriggerRequest):
    if req.function_id not in (1, 2):
        raise HTTPException(status_code=400, detail=f"Unknown function_id: {req.function_id}")

    job_id = _make_job_id(req.function_id)
    return {"job_id": job_id}


@app.get("/rpa/jobs/{job_id}")
def check_job(job_id: str):
    parsed = _parse_job_id(job_id)
    if parsed is None:
        raise HTTPException(status_code=404, detail="Job not found — invalid job_id format")

    created_at, function_id = parsed
    elapsed = time.time() - created_at

    if elapsed < 0:
        raise HTTPException(status_code=400, detail="Job timestamp is in the future")

    if elapsed < JDA_DELAY_SECONDS:
        step_info = _get_step(elapsed, function_id)
        remaining_sec = max(0, int(JDA_DELAY_SECONDS - elapsed))
        return {
            "status": "not success",
            "value": "pending",
            **step_info,
            "remaining_seconds": remaining_sec,
        }

    result_value = _deterministic_result(job_id, function_id)
    return {
        "status": "success",
        "value": result_value,
        "step": "done",
        "step_label": "เสร็จสิ้น",
        "progress": 100,
        "remaining_seconds": 0,
    }


@app.get("/health")
def health():
    return {"ok": True}
