#!/bin/bash

# Replace with your actual client ID from Supabase
CLIENT_ID=143dd1b3-bad8-4377-9608-f4b4d3ca8e14

echo "Testing inbound email webhook..."
echo "Client ID: $CLIENT_ID"

curl -X POST http://localhost:3000/api/inbound-email \
  -F "from=test@client.com" \
  -F "to=receipts-${CLIENT_ID}@yourapp.com" \
  -F "subject=Receipt from Staples" \
  -F "text=Here is my receipt for office supplies" \
  -F "attachments=1"

echo ""
echo "✅ Test complete. Check Supabase email_inbox table for new row."