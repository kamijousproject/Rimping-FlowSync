# RPA Bot Mock

FastAPI mock of the JDA integration bot.

## Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn rpa_mock:app --port 8001 --reload
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rpa/trigger` | Submit a job. Returns `{job_id}`. |
| GET | `/rpa/jobs/{job_id}` | Poll job status. Returns `{status, value}`. |
| GET | `/health` | Liveness check. |

## Flow

1. `POST /rpa/trigger` with `{function_id: 1, data: {po_id, fully_tax, customer_id, amount, date}}`  
   → `{job_id: "JOB-XXXXXXXXXXXX"}`

2. `GET /rpa/jobs/{job_id}` before 5 minutes  
   → `{status: "not success", value: "pending"}`

3. `GET /rpa/jobs/{job_id}` after 5 minutes  
   → `{status: "success", value: "JDA123456"}`  
   (value is the JDA PO number)

## Configuration

Set `JDA_DELAY_SECONDS` in `rpa_mock.py` to change the simulated delay (default: 300 s).
