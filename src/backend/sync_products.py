#!/usr/bin/env python3
"""
sync_products.py — ดึง price-event-store-500.csv จาก Google Drive แล้ว upsert ลง products table

Usage:
  python3 src/backend/sync_products.py

Cron (ตีสอง ทุกวัน):
  0 2 * * * cd /home/aiadmin/FlowSync/flowsync && python3 src/backend/sync_products.py >> /var/log/flowsync-sync.log 2>&1
"""

import csv
import io
import os
import sys
import logging
from datetime import datetime, date

import mysql.connector
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# ─── Config ───────────────────────────────────────────────────────────────────

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, "..", "..")

CREDENTIALS_FILE = os.path.join(PROJECT_ROOT, "flowsync-495308-bf9985760622.json")
TARGET_FILENAME  = "price-event-store-500.csv"
STORE_NUMBER     = 500
CSV_ENCODING     = "tis-620"

# DB — อ่านจาก .env.local ถ้ามี
def _load_env():
    env_path = os.path.join(PROJECT_ROOT, "flowsync", ".env.local")
    if not os.path.exists(env_path):
        env_path = os.path.join(PROJECT_ROOT, ".env.local")
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env

_env = _load_env()
DB_CONFIG = {
    "host":     _env.get("DB_HOST", "127.0.0.1"),
    "port":     int(_env.get("DB_PORT", 3306)),
    "user":     _env.get("DB_USER", "root"),
    "password": _env.get("DB_PASSWORD", ""),
    "database": _env.get("DB_NAME", "flowsync"),
    "charset":  "utf8mb4",
}

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def parse_date(val: str):
    """แปลง YYMMDD → date object หรือ None"""
    val = val.strip()
    if not val or val == "999999":
        return None
    try:
        # format YYMMDD → assume 2000s
        return datetime.strptime(val, "%y%m%d").date()
    except ValueError:
        return None

def to_int(val: str):
    try:
        return int(val.strip()) if val.strip() else None
    except ValueError:
        return None

def to_float(val: str):
    try:
        return float(val.strip()) if val.strip() else None
    except ValueError:
        return None

def parse_row(row: list[str]) -> dict:
    """map CSV columns → dict ตรงกับ products table"""
    # header order:
    # Store,Currency,SKU,Description,Price Use,Current Price,Price Type,
    # Current Start,Current End,Current Event,Original Use,Original Price,
    # Original Start,Original End,Original Type,Original Event,
    # D,SD,C,Dept,SubDept,Class,Mer.,ISHIDA,Vendor,Vendor Name
    if len(row) < 26:
        return {}
    return {
        "store":          to_int(row[0]),
        "currency":       row[1].strip() or "THB",
        "sku":            row[2].strip(),
        "description":    row[3].strip(),
        "price_use":      row[4].strip() or None,
        "current_price":  to_float(row[5]) or 0,
        "price_type":     row[6].strip() or None,
        "current_start":  parse_date(row[7]),
        "current_end":    parse_date(row[8]),
        "current_event":  row[9].strip() or None,
        "original_use":   row[10].strip() or None,
        "original_price": to_float(row[11]),
        "original_start": parse_date(row[12]),
        "original_end":   parse_date(row[13]),
        "original_type":  row[14].strip() or None,
        "original_event": row[15].strip() or None,
        "d":              to_int(row[16]),
        "sd":             to_int(row[17]),
        "c":              to_int(row[18]),
        "dept":           row[19].strip() or None,
        "sub_dept":       row[20].strip() or None,
        "class":          row[21].strip() or None,
        "mer":            row[22].strip() or None,
        "ishida":         row[23].strip() or None,
        "vendor":         to_int(row[24]),
        "vendor_name":    row[25].strip() or None,
    }

# ─── Google Drive ─────────────────────────────────────────────────────────────

def find_file_id(service, filename: str) -> str:
    """ค้นหาไฟล์ใน Drive ทุก folder ที่เข้าถึงได้"""
    result = service.files().list(
        q=f"name = '{filename}' and trashed = false",
        fields="files(id, name, parents)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        pageSize=5,
    ).execute()
    files = result.get("files", [])
    if not files:
        raise FileNotFoundError(f"ไม่พบไฟล์ '{filename}' ใน Google Drive")
    log.info(f"พบไฟล์: {files[0]['name']} (id={files[0]['id']})")
    return files[0]["id"]

def download_csv(file_id: str, service) -> str:
    """ดาวน์โหลดไฟล์ และ decode จาก TIS-620 → str"""
    log.info("กำลังดาวน์โหลด CSV...")
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request, chunksize=10 * 1024 * 1024)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buf.seek(0)
    raw = buf.read()
    log.info(f"ดาวน์โหลดสำเร็จ {len(raw):,} bytes")
    return raw.decode(CSV_ENCODING, errors="replace")

# ─── DB Upsert ────────────────────────────────────────────────────────────────

UPSERT_SQL = """
INSERT INTO products (
  store, currency, sku, description,
  price_use, current_price, price_type, current_start, current_end, current_event,
  original_use, original_price, original_start, original_end, original_type, original_event,
  d, sd, c, dept, sub_dept, class, mer, ishida, vendor, vendor_name
) VALUES (
  %(store)s, %(currency)s, %(sku)s, %(description)s,
  %(price_use)s, %(current_price)s, %(price_type)s, %(current_start)s, %(current_end)s, %(current_event)s,
  %(original_use)s, %(original_price)s, %(original_start)s, %(original_end)s, %(original_type)s, %(original_event)s,
  %(d)s, %(sd)s, %(c)s, %(dept)s, %(sub_dept)s, %(class)s, %(mer)s, %(ishida)s, %(vendor)s, %(vendor_name)s
)
ON DUPLICATE KEY UPDATE
  description    = VALUES(description),
  price_use      = VALUES(price_use),
  current_price  = VALUES(current_price),
  price_type     = VALUES(price_type),
  current_start  = VALUES(current_start),
  current_end    = VALUES(current_end),
  current_event  = VALUES(current_event),
  original_use   = VALUES(original_use),
  original_price = VALUES(original_price),
  original_start = VALUES(original_start),
  original_end   = VALUES(original_end),
  original_type  = VALUES(original_type),
  original_event = VALUES(original_event),
  d              = VALUES(d),
  sd             = VALUES(sd),
  c              = VALUES(c),
  dept           = VALUES(dept),
  sub_dept       = VALUES(sub_dept),
  class          = VALUES(class),
  mer            = VALUES(mer),
  ishida         = VALUES(ishida),
  vendor         = VALUES(vendor),
  vendor_name    = VALUES(vendor_name),
  synced_at      = CURRENT_TIMESTAMP
"""

BATCH_SIZE = 500

def upsert_rows(conn, rows: list[dict]):
    cursor = conn.cursor()
    # affected_rows from executemany: 1=insert, 2=update, 0=no change
    total_affected = 0
    total_batches  = 0
    skipped = 0
    batch = []

    def flush():
        nonlocal total_affected, total_batches
        if not batch:
            return
        cursor.executemany(UPSERT_SQL, batch)
        total_affected += cursor.rowcount
        total_batches  += len(batch)
        conn.commit()
        batch.clear()

    for r in rows:
        if not r.get("sku"):
            skipped += 1
            continue
        batch.append(r)
        if len(batch) >= BATCH_SIZE:
            flush()

    flush()
    cursor.close()

    # rowcount per row: 1=inserted, 2=updated, 0=unchanged
    # total_affected = inserts*1 + updates*2 + unchanged*0
    # We can only approximate: log total processed
    return total_batches, total_affected, skipped

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    log.info("=== FlowSync Product Sync เริ่มต้น ===")

    # 1. Auth
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_FILE,
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    # 2. หา file ID
    file_id = find_file_id(service, TARGET_FILENAME)

    # 3. Download + decode
    csv_text = download_csv(file_id, service)

    # 4. Parse CSV
    reader = csv.reader(io.StringIO(csv_text))
    header = next(reader, None)  # skip header row
    if not header:
        log.error("CSV ว่างเปล่า")
        sys.exit(1)
    log.info(f"Header: {header[:5]}...")

    rows = [parse_row(r) for r in reader]
    log.info(f"อ่านได้ {len(rows):,} แถว")

    # 5. Upsert
    conn = mysql.connector.connect(**DB_CONFIG)
    try:
        processed, affected, skipped = upsert_rows(conn, rows)
    finally:
        conn.close()

    log.info(f"ประมวลผล: {processed:,} แถว | affected rows: {affected:,} | ข้าม (ไม่มี SKU): {skipped:,}")
    log.info("=== Sync เสร็จสิ้น ===")

if __name__ == "__main__":
    main()
