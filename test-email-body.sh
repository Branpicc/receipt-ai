#!/bin/bash

CLIENT_ID="143dd1b3-bad8-4377-9608-f4b4d3ca8e14"

echo "Testing Uber receipt email (no attachment)..."

curl -X POST http://localhost:3000/api/inbound-email \
  -F "from=uber@uber.com" \
  -F "to=receipts-${CLIENT_ID}@yourapp.com" \
  -F "subject=Your Uber trip receipt" \
  -F 'text=Thanks for riding with Uber

Trip Details:
From: 123 Main St
To: 456 Oak Ave
Date: February 13, 2026

Total: $23.45
Payment method: Mastercard
' \
  -F "attachments=0"

echo ""
echo "✅ Test complete. Check:"
echo "   1. Receipts table - should have new receipt with vendor=Uber, total=$23.45"
echo "   2. Email inbox - should have auto_processed status"