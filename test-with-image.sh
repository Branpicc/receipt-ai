#!/bin/bash

CLIENT_ID="143dd1b3-bad8-4377-9608-f4b4d3ca8e14"

# Create a small test image
echo "Creating test receipt image..."
echo "RECEIPT TEST" > test-receipt.txt

curl -X POST http://localhost:3000/api/inbound-email \
  -F "from=client@example.com" \
  -F "to=receipts-${CLIENT_ID}@yourapp.com" \
  -F "subject=Receipt from Target" \
  -F "text=Here is my receipt attachment" \
  -F "attachments=1" \
  -F "attachment1=@test-receipt.txt" \
  -F "attachment-info1=receipt.txt"

echo ""
echo "✅ Test complete. Check Supabase:"
echo "   1. email_inbox table - should have attachment_urls"
echo "   2. Storage → receipt-files bucket → email-attachments folder"