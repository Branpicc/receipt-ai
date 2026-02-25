"""
Generate a professional PDF report documenting a receipt split for CRA audit purposes.
Usage: Called by the API route with receipt data
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from datetime import datetime

def generate_split_receipt_pdf(original_receipt, new_receipt, original_items, new_items, output_path):
    """
    Generate a PDF documenting the receipt split.
    
    Args:
        original_receipt: dict with {id, vendor, receipt_date, total_cents, purpose_text}
        new_receipt: dict with {id, vendor, receipt_date, total_cents, purpose_text, suggested_category}
        original_items: list of {description, quantity, unit_price_cents, total_cents}
        new_items: list of {description, quantity, unit_price_cents, total_cents}
        output_path: where to save the PDF
    """
    
    doc = SimpleDocTemplate(output_path, pagesize=letter,
                           rightMargin=0.75*inch, leftMargin=0.75*inch,
                           topMargin=0.75*inch, bottomMargin=0.75*inch)
    
    styles = getSampleStyleSheet()
    story = []
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#374151'),
        spaceAfter=12,
        spaceBefore=20,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#4b5563'),
        spaceAfter=6
    )
    
    # Title
    story.append(Paragraph("SPLIT RECEIPT DOCUMENTATION", title_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", body_style))
    story.append(Spacer(1, 0.3*inch))
    
    # Purpose box
    purpose_text = """
    <para alignment="center" spaceBefore="12" spaceAfter="12">
    <b>Purpose:</b> This document certifies that a single receipt was split into two separate 
    expense entries for proper tax categorization as required by CRA guidelines.
    </para>
    """
    story.append(Paragraph(purpose_text, body_style))
    story.append(Spacer(1, 0.2*inch))
    
    # Original Receipt Info
    story.append(Paragraph("ORIGINAL RECEIPT", heading_style))
    
    original_data = [
        ['Vendor:', original_receipt.get('vendor', 'Unknown')],
        ['Date:', original_receipt.get('receipt_date', 'Not specified')],
        ['Original Total:', f"${(original_receipt.get('total_cents', 0) / 100):.2f} CAD"],
        ['Receipt ID:', original_receipt.get('id', '')[:8] + '...'],
    ]
    
    original_table = Table(original_data, colWidths=[1.5*inch, 4.5*inch])
    original_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1f2937')),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(original_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Split Into Section
    story.append(Paragraph("SPLIT INTO TWO RECEIPTS", heading_style))
    story.append(Spacer(1, 0.15*inch))
    
    # Receipt A (Original - Remaining Items)
    story.append(Paragraph("<b>Receipt A: Office Supplies (100% Deductible)</b>", body_style))
    story.append(Spacer(1, 0.1*inch))
    
    # Line items table for original
    if original_items:
        items_data = [['Description', 'Qty', 'Unit Price', 'Total']]
        for item in original_items:
            items_data.append([
                item.get('description', ''),
                str(item.get('quantity', 1)),
                f"${(item.get('unit_price_cents', 0) / 100):.2f}",
                f"${(item.get('total_cents', 0) / 100):.2f}"
            ])
        
        items_table = Table(items_data, colWidths=[3*inch, 0.75*inch, 1*inch, 1*inch])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(items_table)
    
    receipt_a_total = original_receipt.get('total_cents', 0)
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(f"<b>Receipt A Total: ${(receipt_a_total / 100):.2f} CAD</b>", body_style))
    story.append(Paragraph("Tax Treatment: 100% deductible business expense", body_style))
    story.append(Spacer(1, 0.25*inch))
    
    # Receipt B (New - Mismatched Items)
    category = new_receipt.get('suggested_category', 'Other Expenses')
    deductible = "50%" if "Meal" in category else "100%"
    
    story.append(Paragraph(f"<b>Receipt B: {category} ({deductible} Deductible)</b>", body_style))
    story.append(Spacer(1, 0.1*inch))
    
    # Line items table for new receipt
    if new_items:
        new_items_data = [['Description', 'Qty', 'Unit Price', 'Total']]
        for item in new_items:
            new_items_data.append([
                item.get('description', ''),
                str(item.get('quantity', 1)),
                f"${(item.get('unit_price_cents', 0) / 100):.2f}",
                f"${(item.get('total_cents', 0) / 100):.2f}"
            ])
        
        new_items_table = Table(new_items_data, colWidths=[3*inch, 0.75*inch, 1*inch, 1*inch])
        new_items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fef3c7')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#fbbf24')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(new_items_table)
    
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(f"<b>Receipt B Total: ${(new_receipt.get('total_cents', 0) / 100):.2f} CAD</b>", body_style))
    story.append(Paragraph(f"Tax Treatment: {deductible} deductible ({category})", body_style))
    story.append(Spacer(1, 0.3*inch))
    
    # Summary
    story.append(Paragraph("SUMMARY", heading_style))
    
    summary_data = [
        ['', 'Receipt A', 'Receipt B', 'Total'],
        ['Subtotal + Tax', 
         f"${(receipt_a_total / 100):.2f}",
         f"${(new_receipt.get('total_cents', 0) / 100):.2f}",
         f"${((receipt_a_total + new_receipt.get('total_cents', 0)) / 100):.2f}"],
        ['Tax Category',
         'Office Supplies',
         category,
         '—'],
        ['Deductibility',
         '100%',
         deductible,
         '—'],
    ]
    
    summary_table = Table(summary_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f2937')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.3*inch))
    
    # CRA Compliance Note
    compliance_note = """
    <para alignment="left" fontSize="9" textColor="#6b7280" spaceBefore="12">
    <b>CRA Compliance:</b> This split was performed to ensure proper categorization of expenses 
    according to Canada Revenue Agency (CRA) guidelines. Each receipt maintains its connection 
    to the original transaction while allowing for accurate tax treatment based on the nature 
    of each expense. Both receipts reference the same source document for audit purposes.
    </para>
    """
    story.append(Paragraph(compliance_note, body_style))
    
    # Footer
    story.append(Spacer(1, 0.4*inch))
    footer_text = f"""
    <para alignment="center" fontSize="8" textColor="#9ca3af">
    This document was automatically generated by the Receipt Management System.<br/>
    Original Receipt ID: {original_receipt.get('id', '')[:16]}...<br/>
    New Receipt ID: {new_receipt.get('id', '')[:16]}...
    </para>
    """
    story.append(Paragraph(footer_text, body_style))
    
    # Build PDF
    doc.build(story)
    print(f"✅ PDF generated: {output_path}")
    return output_path