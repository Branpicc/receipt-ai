import { NextRequest, NextResponse } from "next/server";
export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("Demo request:", body);
  return NextResponse.json({ success: true });
}