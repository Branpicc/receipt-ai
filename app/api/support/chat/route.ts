// app/api/support/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedUser } from '@/lib/apiAuth';

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthedUser(request);
    if (auth instanceof NextResponse) return auth;

    const { messages, userName } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages must be an array' }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json({ error: `Too many messages (max ${MAX_MESSAGES})` }, { status: 400 });
    }
    for (const m of messages) {
      if (typeof m?.content === 'string' && m.content.length > MAX_MESSAGE_CHARS) {
        return NextResponse.json(
          { error: `Message too long (max ${MAX_MESSAGE_CHARS} chars)` },
          { status: 400 }
        );
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a helpful support assistant for Receipture, a receipt management platform for Canadian accounting firms.

You help users with questions about:
- Uploading and managing receipts
- OCR and data extraction  
- Categories and tax codes (GST/HST/PST)
- Client management
- SMS purpose collection
- Email receipt forwarding
- Reports and edit history
- Budget tracking
- Business card fraud detection
- Billing and plans
- Account settings and onboarding

Be concise, friendly, and helpful. If after genuinely trying you truly cannot solve their problem, say exactly: "I'm unable to resolve this issue and will escalate it to our support team."

Do not make up features. Stick to what Receipture actually does.`,
        messages: messages.slice(-10),
      }),
    });

const data = await response.json();
console.log('Anthropic response:', JSON.stringify(data, null, 2));
if (data.error) {
  console.error('Anthropic API error:', data.error);
  return NextResponse.json({ message: `I'm having trouble connecting right now. Please try again shortly.` });
}

const aiMessage = data.content?.[0]?.text || "I'm sorry, I couldn't process that. Please try again.";
    return NextResponse.json({ message: aiMessage });
  } catch (error: any) {
    console.error('AI chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}