type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
  purpose_text: string | null;
  client_id: string;
};

type ReceiptWithClient = Receipt & {
  clients?: {
    name: string;
  } | null;
};

type TaxRow = {
  tax_type: string;
  amount_cents: number;
};

// CSV Export
export function generateCSV(receipts: ReceiptWithClient[], taxes: Record<string, TaxRow[]>): string {
  const header = "Date,Vendor,Client,Category,Purpose,Subtotal,Tax,Total,Receipt ID\n";
  
  const rows = receipts.map(r => {
    const clientName = r.clients?.name || "Unknown Client";
    const category = r.approved_category || r.suggested_category || "Uncategorized";
    const date = r.receipt_date || "—";
    const vendor = r.vendor || "Unknown";
    const purpose = (r.purpose_text || "").replace(/,/g, ";"); // Escape commas
    
    // Get taxes for this receipt
    const receiptTaxes = taxes[r.id] || [];
    const taxTotal = receiptTaxes.reduce((sum, t) => sum + t.amount_cents, 0);
    
    const total = r.total_cents || 0;
    const subtotal = total - taxTotal;
    
    return [
      date,
      vendor,
      clientName,
      category,
      `"${purpose}"`,
      (subtotal / 100).toFixed(2),
      (taxTotal / 100).toFixed(2),
      (total / 100).toFixed(2),
      r.id
    ].join(",");
  });
  
  return header + rows.join("\n");
}

// QuickBooks IIF Export
export function generateQuickBooksIIF(receipts: ReceiptWithClient[], taxes: Record<string, TaxRow[]>): string {
  let iif = "!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\n";
  iif += "!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\n";
  iif += "!ENDTRNS\n";
  
  receipts.forEach(r => {
    const date = r.receipt_date || new Date().toISOString().split('T')[0];
    const vendor = r.vendor || "Unknown Vendor";
    const category = r.approved_category || r.suggested_category || "Other Expenses";
    const purpose = r.purpose_text || "";
    const total = r.total_cents || 0;
    
    // Get taxes
    const receiptTaxes = taxes[r.id] || [];
    const taxTotal = receiptTaxes.reduce((sum, t) => sum + t.amount_cents, 0);
    const subtotal = total - taxTotal;
    
    // Format date as MM/DD/YYYY
    const [year, month, day] = date.split('-');
    const qbDate = `${month}/${day}/${year}`;
    
    // Transaction header (debit from bank account)
    iif += `TRNS\t\tEXPENSE\t${qbDate}\tChequing Account\t${vendor}\t\t${-(total / 100).toFixed(2)}\t${r.id}\t${purpose}\n`;
    
    // Expense split (credit to expense account)
    iif += `SPL\t\tEXPENSE\t${qbDate}\t${category}\t\t\t${(subtotal / 100).toFixed(2)}\t\t${purpose}\n`;
    
    // Tax split (if applicable)
    if (taxTotal > 0) {
      const taxType = receiptTaxes[0]?.tax_type || "GST/HST";
      iif += `SPL\t\tEXPENSE\t${qbDate}\t${taxType} Paid\t\t\t${(taxTotal / 100).toFixed(2)}\t\t\n`;
    }
    
    iif += "ENDTRNS\n";
  });
  
  return iif;
}

// PDF Report (HTML template for printing/PDF)
export function generatePDFReportHTML(receipts: ReceiptWithClient[], taxes: Record<string, TaxRow[]>): string {
  const totalAmount = receipts.reduce((sum, r) => sum + (r.total_cents || 0), 0);
  const totalTax = Object.values(taxes).flat().reduce((sum, t) => sum + t.amount_cents, 0);
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt Export Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #333; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f9f9f9; }
    .total-row { font-weight: bold; background: #f0f0f0; }
    @media print {
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Receipt Export Report</h1>
  
  <div class="summary">
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Receipts:</strong> ${receipts.length}</p>
    <p><strong>Total Amount:</strong> $${(totalAmount / 100).toFixed(2)}</p>
    <p><strong>Total Tax:</strong> $${(totalTax / 100).toFixed(2)}</p>
    <p><strong>Subtotal:</strong> $${((totalAmount - totalTax) / 100).toFixed(2)}</p>
  </div>
  
  <button onclick="window.print()" style="padding: 10px 20px; background: #000; color: white; border: none; cursor: pointer; margin-bottom: 20px;">
    Print / Save as PDF
  </button>
  
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Vendor</th>
        <th>Client</th>
        <th>Category</th>
        <th>Purpose</th>
        <th style="text-align: right;">Subtotal</th>
        <th style="text-align: right;">Tax</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
`;
  
  receipts.forEach(r => {
    const clientName = r.clients?.name || "Unknown";
    const category = r.approved_category || r.suggested_category || "Uncategorized";
    const receiptTaxes = taxes[r.id] || [];
    const taxTotal = receiptTaxes.reduce((sum, t) => sum + t.amount_cents, 0);
    const total = r.total_cents || 0;
    const subtotal = total - taxTotal;
    
    html += `
      <tr>
        <td>${r.receipt_date || "—"}</td>
        <td>${r.vendor || "Unknown"}</td>
        <td>${clientName}</td>
        <td>${category}</td>
        <td>${r.purpose_text || ""}</td>
        <td style="text-align: right;">$${(subtotal / 100).toFixed(2)}</td>
        <td style="text-align: right;">$${(taxTotal / 100).toFixed(2)}</td>
        <td style="text-align: right;">$${(total / 100).toFixed(2)}</td>
      </tr>
    `;
  });
  
  html += `
      <tr class="total-row">
        <td colspan="5">TOTAL</td>
        <td style="text-align: right;">$${((totalAmount - totalTax) / 100).toFixed(2)}</td>
        <td style="text-align: right;">$${(totalTax / 100).toFixed(2)}</td>
        <td style="text-align: right;">$${(totalAmount / 100).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
  `;
  
  return html;
}