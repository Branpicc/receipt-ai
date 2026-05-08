import { NextRequest, NextResponse } from "next/server";
import { publicRouteRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 10 * 1024;

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

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: { firmName?: unknown; email?: unknown; phone?: unknown; size?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firmName = typeof body.firmName === "string" ? body.firmName.slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.slice(0, 200) : "";
  const phone = typeof body.phone === "string" ? body.phone.slice(0, 30) : "";
  const size = typeof body.size === "string" ? body.size.slice(0, 50) : "";
  if (!firmName || !email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  console.log("[demo-request]", { firmName, email, phone, size });
  return NextResponse.json({ success: true });
}
