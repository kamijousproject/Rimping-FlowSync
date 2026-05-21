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

CREDENTIALS_FILE = os.path.join(PROJECT_ROOT, "flowsync-495308-2ce290275168.json")  # ใช้ service account ใหม่
TARGET_FILENAME  = "price-event-store-500.csv"  # ไฟล์ล่าสุดที่อัปเดท 2026-05-12
INVENTORY_FILENAME = "Inventory-500-Horeca.csv"  # ไฟล์ inventory
INVENTORY_FOLDER_ID = "1QkJxHiQojhPZC0N_NbbseEk55v1JCs7I"  # folder inventory
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
        v = val.strip()
        return int(float(v)) if v else None
    except (ValueError, OverflowError):
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

def parse_inventory_row(row: list[str]) -> dict:
    """map inventory CSV columns → dict ตรงกับ inventory table"""
    # header order:
    # Store,SKU,UPC,Description,Vendor,Vendor Name,D,SD,C,SC,Group,Group-SD,Group-Cat,Mer.,Mer. Name,ISHIDA,
    # On Hand,On Order,On Transfer,In Transit,Hold Qty,Stock Value,Date Last Sold
    if len(row) < 22:
        return {}
    return {
        "store":           to_int(row[0]),
        "sku":             row[1].strip(),
        "upc":             row[2].strip() or None,
        "description":     row[3].strip(),
        "vendor":          to_int(row[4]),
        "vendor_name":     row[5].strip() or None,
        "d":               to_int(row[6]),
        "sd":              to_int(row[7]),
        "c":               to_int(row[8]),
        "sc":              row[9].strip() or None,
        "group_name":      row[10].strip() or None,
        "group_sd":        row[11].strip() or None,
        "group_cat":       row[12].strip() or None,
        "mer":             row[13].strip() or None,
        "mer_name":        row[14].strip() or None,
        "ishida":          row[15].strip() or None,
        "on_hand":         to_int(row[16]) or 0,
        "on_order":        to_int(row[17]) or 0,
        "on_transfer":     to_int(row[18]) or 0,
        "in_transit":      to_int(row[19]) or 0,
        "hold_qty":        to_int(row[20]) or 0,
        "stock_value":     to_float(row[21]) or 0,
        "date_last_sold":  parse_date(row[22]) if len(row) > 22 else None,
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

def find_inventory_file_id(service, filename: str) -> str:
    """ค้นหาไฟล์ใน folder inventory ที่กำหนด"""
    result = service.files().list(
        q=f"name = '{filename}' and '{INVENTORY_FOLDER_ID}' in parents and trashed = false",
        fields="files(id, name, parents)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        pageSize=5,
    ).execute()
    files = result.get("files", [])
    if not files:
        raise FileNotFoundError(f"ไม่พบไฟล์ '{filename}' ใน folder inventory")
    log.info(f"พบไฟล์ inventory: {files[0]['name']} (id={files[0]['id']})")
    return files[0]["id"]

def download_inventory_csv(file_id: str, service) -> str:
    """ดาวน์โหลดไฟล์ inventory และ decode จาก UTF-8 → str"""
    log.info("กำลังดาวน์โหลด inventory CSV...")
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request, chunksize=10 * 1024 * 1024)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buf.seek(0)
    raw = buf.read()
    log.info(f"ดาวน์โหลด inventory สำเร็จ {len(raw):,} bytes")
    return raw.decode("utf-8", errors="replace")

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

    # rowcount per row: 1=inserted, 2=update, 0=unchanged
    # total_affected = inserts*1 + updates*2 + unchanged*0
    # We can only approximate: log total processed
    return total_batches, total_affected, skipped

INVENTORY_UPSERT_SQL = """
INSERT INTO inventory (
  store, sku, upc, description, vendor, vendor_name, d, sd, c, sc,
  group_name, group_sd, group_cat, mer, mer_name, ishida,
  on_hand, on_order, on_transfer, in_transit, hold_qty, stock_value, date_last_sold
) VALUES (
  %(store)s, %(sku)s, %(upc)s, %(description)s, %(vendor)s, %(vendor_name)s, %(d)s, %(sd)s, %(c)s, %(sc)s,
  %(group_name)s, %(group_sd)s, %(group_cat)s, %(mer)s, %(mer_name)s, %(ishida)s,
  %(on_hand)s, %(on_order)s, %(on_transfer)s, %(in_transit)s, %(hold_qty)s, %(stock_value)s, %(date_last_sold)s
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  vendor = VALUES(vendor),
  vendor_name = VALUES(vendor_name),
  d = VALUES(d),
  sd = VALUES(sd),
  c = VALUES(c),
  sc = VALUES(sc),
  group_name = VALUES(group_name),
  group_sd = VALUES(group_sd),
  group_cat = VALUES(group_cat),
  mer = VALUES(mer),
  mer_name = VALUES(mer_name),
  ishida = VALUES(ishida),
  on_hand = VALUES(on_hand),
  on_order = VALUES(on_order),
  on_transfer = VALUES(on_transfer),
  in_transit = VALUES(in_transit),
  hold_qty = VALUES(hold_qty),
  stock_value = VALUES(stock_value),
  date_last_sold = VALUES(date_last_sold),
  synced_at = CURRENT_TIMESTAMP
"""

def get_today_sales(conn) -> dict[str, int]:
    """Return {sku: total_qty} for all non-cancelled POs created since 00:00 today."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pi.product_name, SUM(pi.quantity)
        FROM po_items pi
        JOIN purchase_orders po ON pi.po_id = po.id
        WHERE po.created_at >= CURDATE()
          AND po.status != 'cancelled'
        GROUP BY pi.product_name
    """)
    result = {row[0]: int(row[1]) for row in cursor.fetchall()}
    cursor.close()
    log.info(f"Today's sales: {len(result)} SKUs with sold qty")
    return result


def upsert_inventory_rows(conn, rows: list[dict]):
    cursor = conn.cursor()
    total_affected = 0
    total_batches  = 0
    skipped = 0
    batch = []

    def flush():
        nonlocal total_affected, total_batches
        if not batch:
            return
        cursor.executemany(INVENTORY_UPSERT_SQL, batch)
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
    return total_batches, total_affected, skipped

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    log.info("=== FlowSync Product & Inventory Sync เริ่มต้น ===")

    # 1. Auth
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_FILE,
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    # === Sync Products ===
    log.info("--- Sync Products ---")
    try:
        # 2. หา file ID
        file_id = find_file_id(service, TARGET_FILENAME)

        # 3. Download + decode
        csv_text = download_csv(file_id, service)

        # 4. Parse CSV
        reader = csv.reader(io.StringIO(csv_text))
        header = next(reader, None)  # skip header row
        if not header:
            log.error("Products CSV ว่างเปล่า")
            sys.exit(1)
        log.info(f"Products Header: {header[:5]}...")

        rows = [parse_row(r) for r in reader]
        log.info(f"อ่านได้ {len(rows):,} แถว (products)")

        # 5. Upsert products
        conn = mysql.connector.connect(**DB_CONFIG)
        try:
            processed, affected, skipped = upsert_rows(conn, rows)
            log.info(f"Products: ประมวลผล {processed:,} แถว | affected rows: {affected:,} | ข้าม {skipped:,}")
        finally:
            conn.close()
    except Exception as e:
        log.error(f"Products sync failed: {e}")

    # === Sync Inventory ===
    log.info("--- Sync Inventory ---")
    try:
        # 2. หา file ID ของ inventory
        inv_file_id = find_inventory_file_id(service, INVENTORY_FILENAME)

        # 3. Download + decode
        inv_csv_text = download_inventory_csv(inv_file_id, service)

        # 4. Parse CSV
        inv_reader = csv.reader(io.StringIO(inv_csv_text))
        inv_header = next(inv_reader, None)  # skip header row
        if not inv_header:
            log.error("Inventory CSV ว่างเปล่า")
            sys.exit(1)
        log.info(f"Inventory Header: {inv_header[:5]}...")

        inv_rows = [parse_inventory_row(r) for r in inv_reader]
        log.info(f"อ่านได้ {len(inv_rows):,} แถว (inventory)")

        # 5. Upsert inventory
        conn = mysql.connector.connect(**DB_CONFIG)
        try:
            # Subtract today's PO sales so on_hand reflects real-time stock
            sales_today = get_today_sales(conn)
            for row in inv_rows:
                sold = sales_today.get(row["sku"], 0)
                row["on_hand"] = row["on_hand"] - sold
            log.info(f"Applied today's sales deduction to {len(sales_today)} SKUs")

            inv_processed, inv_affected, inv_skipped = upsert_inventory_rows(conn, inv_rows)
            log.info(f"Inventory: ประมวลผล {inv_processed:,} แถว | affected rows: {inv_affected:,} | ข้าม {inv_skipped:,}")
        finally:
            conn.close()
    except Exception as e:
        log.error(f"Inventory sync failed: {e}")

    log.info("=== Sync เสร็จสิ้น ===")

if __name__ == "__main__":
    main()
