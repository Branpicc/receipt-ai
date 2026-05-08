import { NextRequest, NextResponse } from "next/server";
import { publicRouteRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 10 * 1024; // 10 KB — contact forms don't need more

export async function POST(request: NextRequest) {
  const limit = publicRouteRateLimit(request);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests, try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds || 60) },
      }
    );
  }

  // Reject oversized payloads before parsing.
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: { name?: unknown; email?: unknown; message?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Minimal validation — these are the fields the landing page sends.
  const name = typeof body.name === "string" ? body.name.slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.slice(0, 5000) : "";
  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  console.log("[contact]", { name, email, messagePreview: message.slice(0, 100) });
  return NextResponse.json({ success: true });
}
