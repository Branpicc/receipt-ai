// app/api/support/escalate/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { conversationId, firmId, userRole, userName, subject, transcript } = await request.json();

    const supportEmail = process.env.SUPPORT_EMAIL || 'branpiccs@gmail.com';

    // Send email via a simple fetch to a mail service
    // For now we'll use a basic approach with nodemailer or just log it
    // In production, replace with SendGrid/Resend

    console.log('📧 Support escalation received:', {
      conversationId,
      firmId,
      userRole,
      userName,
      subject,
    });

    // Try to send via Resend if available, otherwise log
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'support@Receipture.com',
          to: supportEmail,
          subject: `[Receipture Support] ${subject || 'New escalation'} — ${userName}`,
          text: `
Support Escalation Request
==========================

User: ${userName}
Role: ${userRole}
Firm ID: ${firmId}
Conversation ID: ${conversationId}
Subject: ${subject}

Conversation Transcript:
------------------------
${transcript}

Please respond to the user through the Receipture dashboard.
          `.trim(),
        }),
      });
    } else {
      // Fallback — just log for now
      console.log('📧 Would send escalation email to:', supportEmail);
      console.log('Transcript:', transcript);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Escalation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}