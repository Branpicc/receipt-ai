// lib/xmlEscape.ts
//
// Escapes the five XML special characters so user-controlled content can
// be safely embedded inside a TwiML <Message> body without breaking the
// XML parser or allowing tag injection.
//
// Used by app/api/sms/inbound/route.ts when echoing the client's reply
// back to them in the confirmation TwiML.

export function escapeXml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
