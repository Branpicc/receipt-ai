// app/api/generate-split-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { requireFirmMember } from '@/lib/apiAuth';

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { originalReceiptId, newReceiptId } = await request.json();

    if (!originalReceiptId || !newReceiptId) {
      return NextResponse.json(
        { error: 'Missing receipt IDs' },
        { status: 400 }
      );
    }

    // Resolve the firm_id of both receipts so we can verify the caller
    // belongs to it, and that both receipts are in the SAME firm (no
    // cross-firm splits).
    const { data: originalReceipt } = await supabase
      .from('receipts')
      .select('*, firm_id')
      .eq('id', originalReceiptId)
      .single();

    const { data: newReceipt } = await supabase
      .from('receipts')
      .select('*, firm_id')
      .eq('id', newReceiptId)
      .single();

    if (!originalReceipt || !newReceipt) {
      return NextResponse.json(
        { error: 'Receipts not found' },
        { status: 404 }
      );
    }

    if (originalReceipt.firm_id !== newReceipt.firm_id) {
      return NextResponse.json(
        { error: 'Receipts belong to different firms' },
        { status: 400 }
      );
    }

    const auth = await requireFirmMember(request, originalReceipt.firm_id);
    if (auth instanceof NextResponse) return auth;

    console.log('📄 Generating PDF for receipts:', { originalReceiptId, newReceiptId });

    // Fetch line items
    const { data: originalItems } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', originalReceiptId)
      .order('line_index');

    const { data: newItems } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', newReceiptId)
      .order('line_index');

    // Create Python script with data in /tmp
    const scriptPath = '/tmp/generate_pdf.py';
    const outputPath = `/tmp/split_receipt_${Date.now()}.pdf`;
    
    // Get the absolute path to the Python module
    const projectRoot = process.cwd();
    const pythonModulePath = path.join(projectRoot, 'lib');

    const pythonCode = `
import sys
sys.path.append('${pythonModulePath}')

from generate_split_receipt_pdf import generate_split_receipt_pdf
import json

original = json.loads('''${JSON.stringify(originalReceipt)}''')
new = json.loads('''${JSON.stringify(newReceipt)}''')
original_items = json.loads('''${JSON.stringify(originalItems || [])}''')
new_items = json.loads('''${JSON.stringify(newItems || [])}''')

generate_split_receipt_pdf(original, new, original_items, new_items, "${outputPath}")
`;

    console.log('📝 Writing Python script to:', scriptPath);
    await fs.writeFile(scriptPath, pythonCode);

    // Run Python script
    console.log('🐍 Executing Python script...');
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`);
    
    if (stdout) console.log('Python stdout:', stdout);
    if (stderr) console.log('Python stderr:', stderr);

    // Read the generated PDF
    console.log('📖 Reading PDF from:', outputPath);
    const pdfBuffer = await fs.readFile(outputPath);

    // Upload to Supabase Storage
    const fileName = `split-receipt-${originalReceiptId.slice(0, 8)}-${Date.now()}.pdf`;
    console.log('☁️ Uploading to Supabase:', fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipt-files')
      .upload(`split-receipts/${fileName}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    console.log('✅ Upload successful:', uploadData.path);

    // Clean up temp files
    await fs.unlink(scriptPath).catch(e => console.warn('Cleanup script failed:', e));
    await fs.unlink(outputPath).catch(e => console.warn('Cleanup PDF failed:', e));

    // Return the file path
    return NextResponse.json({
      success: true,
      filePath: uploadData.path,
    });

  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}