#!/bin/bash

# FlowSync Overdue Customer Check Script
# This script checks for overdue customers and sends LINE notifications

# Configuration
BASE_URL="http://localhost:3000"
CRON_SECRET="flowsync-cron-secret-2024"
LOG_FILE="/var/log/flowsync-overdue.log"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if the application is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
    log_message "ERROR: FlowSync application is not running at $BASE_URL"
    exit 1
fi

# Send request to check overdue customers
log_message "Starting overdue customer check..."

RESPONSE=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$BASE_URL/api/cron/check-overdue" \
    -d '{}')

HTTP_CODE="${RESPONSE: -3}"
RESPONSE_BODY="${RESPONSE%???}"

if [ "$HTTP_CODE" -eq 200 ]; then
    log_message "SUCCESS: Overdue check completed successfully"
    log_message "Response: $RESPONSE_BODY"
else
    log_message "ERROR: Overdue check failed with HTTP code $HTTP_CODE"
    log_message "Response: $RESPONSE_BODY"
    exit 1
fi

log_message "Overdue customer check completed"
