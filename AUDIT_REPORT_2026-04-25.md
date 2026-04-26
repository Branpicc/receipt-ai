# Receipture Codebase Audit — 2026-04-25

Read-only audit performed by Claude Code subagent. **Total findings: 49** (14 critical, 17 important, 13 cleanup, 5 second-look).

---

## Executive summary

Receipture is broadly functional but ships with a serious set of security and data-flow problems that should block beta launch. The most serious issues:

1. A Google Vision API key is **exposed in the client bundle** (`NEXT_PUBLIC_` prefix).
2. Every Stripe-related API route accepts an arbitrary `firmId` with **no auth check** — one user can cancel another firm's subscription, open their billing portal, or apply a retention coupon to their bill.
3. `/api/invite-user` does not verify the caller is an admin, so any authenticated user can invite themselves (or anyone) as `firm_admin`.
4. Several AI/report endpoints (`generate-comprehensive-report`, `generate-monthly-report`, `support/chat`) have no authentication at all.
5. There is duplicated, broken auth code (`lib/auth.ts`, `app/accept-invitation/`, `components/InviteUserModal.tsx`, `lib/checkOnboarding.ts`) that references nonexistent tables/columns. The dead `accept-invitation` page is publicly reachable through middleware.

There are also multiple multi-tenant scoping gaps, a monthly-report cron that generates a report for the wrong month, the global FAB upload attaches to the wrong client, and ~86 debug `console.log` calls in API routes.

---

## 🔴 Critical (bugs / security / scoping)

### 1. Google Vision API key exposed in client bundle — `lib/extractReceiptData.ts:26`
Uses `process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY`. Any `NEXT_PUBLIC_` value is inlined into JS shipped to the browser. The OCR helper is server-only, but the env var name itself causes inlining and any attacker can extract it from the bundle to use your Google quota for free.
**Fix:** Rename to `GOOGLE_VISION_API_KEY`, update `.env.local`, rotate the leaked key.

### 2. `/api/stripe/create-checkout-session` has no auth and DOSes existing subs — `app/api/stripe/create-checkout-session/route.ts:11-55`
Accepts `firmId` from body. Line 49-54: if firm has `stripe_subscription_id`, it **immediately cancels** before creating a new checkout session. Anyone who guesses a firm UUID can cancel that firm's subscription as DOS.
**Fix:** Authenticate the caller, verify `firm_admin`/`owner` of `firmId`, and use Stripe's subscription update API instead of cancel-then-recreate.

### 3. `/api/stripe/cancel-subscription` has no auth — `app/api/stripe/cancel-subscription/route.ts:5-19`
Takes `subscriptionId` from body and cancels it. Anyone with a sub ID can cancel it.
**Fix:** Authenticate, look up the firm's `stripe_subscription_id`, verify match.

### 4. `/api/stripe/create-portal-session` has no auth — `app/api/stripe/create-portal-session/route.ts:11-42`
Accepts arbitrary `firmId` and returns a billing portal URL for that firm. Anyone can manage anyone's billing.
**Fix:** Authenticate, require firm-admin/owner membership.

### 5. `/api/retention/accept-offer` has no auth — `app/api/retention/accept-offer/route.ts:14-77`
Accepts `firmId`, `cardFingerprint`, `customerId` and applies the Stripe coupon. Attacker can apply discounts to any firm's bill or burn the once-per-card retention offer for arbitrary firms.
**Fix:** Authenticate; re-derive cardFingerprint/customerId server-side.

### 6. `/api/retention/check-eligibility` has no auth — `app/api/retention/check-eligibility/route.ts:14-77`
Accepts `firmId`, returns whether a card has been used for retention. Information disclosure.
**Fix:** Authenticate.

### 7. `/api/invite-user` does not check admin role — `app/api/invite-user/route.ts:65-78`
Verifies the bearer token belongs to a `firm_users` row in the firm but does NOT check role is admin. Lines 39-43 also allow `role: "firm_admin"` in the request. Any authenticated user (incl. a `client`) can issue themselves a `firm_admin` invite.
**Fix:** Require `firmUser.role IN ('firm_admin','owner')`. Reject `firm_admin` invites unless caller is `owner`.

### 8. `/api/generate-comprehensive-report` and `/api/generate-monthly-report` have no auth — `app/api/generate-comprehensive-report/route.ts:9-14`, `app/api/generate-monthly-report/route.ts:10-16`
Anyone with a valid `clientId`+`firmId` can trigger Anthropic calls (cost) and overwrite stored reports via `upsert`. Cross-tenant write.
**Fix:** Require auth, verify firm/client membership.

### 9. `/api/process-existing-receipt` is broken and dead — `app/api/process-existing-receipt/route.ts`
Multiple problems:
- Line 31: uses bucket `"receipts"` (correct bucket is `"receipt-files"`).
- Line 18 reads `request.json()`, line 95 calls it again in catch — body already consumed, throws.
- No auth check.
- Line 61-68: `receipt_taxes` insert missing `firm_id` (compare `upload-receipt/route.ts:194-202`).
- Has no callers (only `.next/dev` types reference it). Dead code.

**Fix:** Delete.

### 10. Inbound SMS XML/TwiML injection — `app/api/sms/inbound/route.ts:236-240, 313-321`
User-controlled `purposeSummary`/`confirmMessage` (derived from inbound SMS body) interpolated directly into `<Message>` XML without escaping. Inbound `<`, `>`, `&` will break TwiML.
**Fix:** Escape XML entities or use a TwiML builder.

### 11. `lib/auth.ts` references a non-existent `user_invitations` table — `lib/auth.ts:62, 107, 230, 258`
Real table is `invitations`. `signUp()`, `createInvitation()`, `validateInvitation()`, `getCurrentUser()`, plus consumers `app/accept-invitation/page.tsx` and `components/InviteUserModal.tsx`, would crash if anyone hit them. Middleware `publicRoutes.startsWith('/accept-invite')` makes `/accept-invitation` publicly reachable too.
**Fix:** Delete `app/accept-invitation/`, `components/InviteUserModal.tsx`, and the dead exports from `lib/auth.ts`. Active flow lives at `app/accept-invite/[token]/page.tsx` + `app/api/accept-invite/route.ts`.

### 12. UploadFab uploads to the wrong client — `components/UploadFab.tsx:42-55`
`select("id, name").eq("firm_id", firmId).limit(1)` then `client = clients[0]`. Multi-client firms always get whichever client comes back first; never consults `ClientContext`.
**Fix:** Use `useClientContext()`; require a client to be selected.

### 13. Monthly-report cron uses the wrong month — `app/api/cron/monthly-reports/route.ts:62-65`
Cron runs `0 0 1 * *` (day 1 of new month) but submits `month: '${now.getFullYear()}-${now.getMonth()+1}-01'` — the new month, which has zero data. Reports for the month that just ended are never generated. Comment line 63 also misleading.
**Fix:** Subtract one month before formatting.

### 14. `checkOnboarding.ts` queries the wrong column — `lib/checkOnboarding.ts:18`
Filters `firm_users` by `user_id`; actual column is `auth_user_id`. `checkOnboardingStatus()` always returns `hasFirm: false` for all users. Called from `app/onboarding/page.tsx:25`.
**Fix:** Change to `.eq("auth_user_id", userId)`.

---

## 🟡 Important (logic gaps / broken connections / dead code)

### 15. Duplicate `accept-invitation` vs `accept-invite` pages
Two complete invite-acceptance flows. The old one (`app/accept-invitation/page.tsx`) is broken (depends on dead `lib/auth.ts`, wrong table). Old uses 8-char min password, new (`app/accept-invite/[token]/page.tsx`) uses 6-char. Inconsistent and confusing.
**Fix:** Delete `app/accept-invitation/`. Standardize on 8+ char password.

### 16. Dead `components/InviteUserModal.tsx`
Never imported (active component is `ImprovedInviteModal.tsx`). References nonexistent `clients.business_name` (column is `name`). Links to broken `/accept-invitation`.
**Fix:** Delete.

### 17. Dead `lib/parseEmailBody.ts`
Never imported anywhere. inbound-email/route.ts has its own inline `parseEmailText()`.
**Fix:** Delete.

### 18. Dead `lib/convertImage.ts` (`convertToJpg`)
Never imported. Brings in `sharp` (optional dep) for nothing. HEIC path goes through `convertHeicClient.ts`.
**Fix:** Delete.

### 19. Dead `app/api/process-existing-receipt/route.ts` (see #9). Delete.

### 20. Contact and demo-request routes silently no-op — `app/api/contact/route.ts`, `app/api/demo-request/route.ts`
Both routes literally `console.log(body)` and return success. Landing-page CTAs (`app/page.tsx:32-54`) fire-and-forget thinking they sent leads. They didn't.
**Fix:** Wire to SendGrid/Resend/Slack and persist to DB.

### 21. `app/dashboard/flags/page.tsx:90-92` builds query with broken indentation
The `let query = supabase.from(...).select(...).eq("firm_id", firmId)` chain ends mid-comment, then `query = query.order(...)` reassigns. Works thanks to ASI but extremely fragile.
**Fix:** Add semicolon, re-indent.

### 22. Multi-file upload `batchId` is regenerated per file — `app/dashboard/page.tsx:244, 254`
Outer `batchId` declared at line 244, then **redeclared** inside the loop at line 254 with `Date.now()`. Each file gets a different batchId, defeating the SMS batching/grouping in `lib/triggerSms.ts:107-147`. The combined batch SMS never goes out. (Note: client dashboard at `app/dashboard/client/page.tsx:247` does this correctly.)
**Fix:** Delete the inner `const batchId = ...` at line 254.

### 23. Monthly-report cron calls comprehensive-report over HTTP without auth header — `app/api/cron/monthly-reports/route.ts:55-67`
Currently works because comprehensive-report has no auth (#8). The moment you fix #8, this cron breaks.
**Fix:** Call the function module directly server-side, OR include `Authorization: Bearer ${CRON_SECRET}` and accept it in the comprehensive-report route.

### 24. Notification scoping doesn't enforce role — `components/NotificationBell.tsx:60-90`
Notifications loaded with `eq("firm_id", firmId)` only. An `accountant` sees notifications for clients they aren't assigned to. Only `selectedClient` filtering happens in the component.
**Fix:** When role is `accountant`, look up assigned client_ids and filter.

### 25. Dashboard flags-count misses accountant filter — `app/dashboard/page.tsx:161-168`
When firm-admin selects an accountant, all other stats are restricted by `accountantClientIds`, but the flags query only filters by `firm_id` and `resolved_at IS NULL`.
**Fix:** Apply the same `accountantClientIds`/`effectiveClientId` filtering.

### 26. Inbound-email duplicate firm lookup + dead limit code — `app/api/inbound-email/route.ts:88-110, 128-152`
Identical `from('firms')` query at lines 88 and 104. Lines 128-151 count receipts/email_receipts to compare against `monthlyLimit = 999999` (hardcoded, comment says check is disabled). Dead code.
**Fix:** Combine the firm lookups, delete the unreachable usage block.

### 27. Inbound-SMS may dereference null `receipt_id` — `app/api/sms/inbound/route.ts:256-264, 289`
Line 249 allows the case where only `email_receipt_id` exists, but lines 256-260 still do `.eq('id', queueEntry.receipt_id).single()` and `recategorizeAfterPurpose` at line 289 receives a null receiptId.
**Fix:** Branch the lookup based on which ID is present.

### 28. Stripe SDK version mismatch — `lib/stripe.ts:9` vs `app/api/retention/*/route.ts:11`
`lib/stripe.ts` pins `2024-12-18.acacia`; the retention routes pin `2026-02-25.clover` and instantiate their own `Stripe`. Drift causes subtle behavior differences.
**Fix:** One version, exported from `lib/stripe.ts`.

### 29. Twilio module-level env var asserts — `lib/twilio.ts:4-6`
Module-level `throw new Error('TWILIO_ACCOUNT_SID is not set')` etc. fails the entire build (preview/CI) when env vars aren't set.
**Fix:** Lazy-initialize inside the functions.

### 30. Hardcoded support email — `app/api/support/escalate/route.ts:8`
`process.env.SUPPORT_EMAIL || 'branpiccs@gmail.com'` leaks personal email into source.
**Fix:** Remove fallback.

### 31. `/api/support/chat` has no auth, no rate limit, no message-size cap — `app/api/support/chat/route.ts`
Anyone can hit it and burn Anthropic tokens with attacker-controlled `messages`.
**Fix:** Authenticate, cap `messages.length`, rate-limit.

---

## 🟢 Optimization / cleanup

### 32. N+1 client-badge queries — `lib/ClientContext.tsx:86-137`
For each client: 4 separate Supabase queries (total/uncategorized/flags/pending) = 80 round trips for a 20-client firm on every dashboard load.
**Fix:** One aggregate query (group by client_id) or a Postgres view.

### 33. Per-client report lookup loop — `app/dashboard/reports/clients/page.tsx:44-62`
Same N+1 shape as #32. One query per client to fetch latest `client_reports`.
**Fix:** `select distinct on (client_id) ... order by client_id, report_month desc`.

### 34. Dashboard stats issues 8+ separate count queries — `app/dashboard/page.tsx:134-191`
Each card is its own count query. Could be one RPC/view.

### 35. 86 `console.log` calls in API routes
`getFirmId.ts` alone fires 7 logs every authenticated request. Middleware logs role checks (`middleware.ts:100-101, 109, 136, 142`). Slows cold starts and clutters Vercel logs.
**Fix:** Strip non-error logs or gate behind `DEBUG=true`.

### 36. Pervasive `any` types in API route catches and casts
Examples: `inbound-email/route.ts:477`, `sms/inbound/route.ts:249, 274`, `triggerSms.ts:108`, `stripe/webhook/route.ts:127, 159`. Stripe `as any` at `accept-offer/route.ts:51` may be silently sending an invalid update payload.
**Fix:** Use `unknown` + `instanceof Error` narrowing; replace casts with proper Stripe SDK types.

### 37. `select('*')` in many list queries
Email-inbox page line 92, multiple receipts/flags pages issue `select("*")` for filtered lists where you need a handful of columns.

### 38. Client-dashboard receipts/budgets queries omit `firm_id` filter — `app/dashboard/client/page.tsx:151-156, 191-196`
RLS likely catches it, but adding `.eq("firm_id", firmId)` makes intent explicit and protects against future RLS regressions.

### 39. PDF report HTML escapes nothing — `lib/exportReceipts.ts:154-167`
`r.vendor`, `r.purpose_text`, `clientName` interpolated raw into `<td>`. OCR vendor name with `<script>` would execute when the PDF report is opened. Internal-only audience so 🟢, but easy to fix.
**Fix:** Add `escapeHtml(s)` helper, wrap every `${r.foo}`.

### 40. CSV escape is a hack — `lib/exportReceipts.ts:32`
`r.purpose_text.replace(/,/g, ";")` loses information; ignores quotes/newlines. Use proper CSV quoting.

### 41. `generate-split-pdf/route.ts` interpolates JSON into Python triple-quoted strings — `app/api/generate-split-pdf/route.ts:77-83`
A `'''` in any field breaks the script. Also no auth check.
**Fix:** Pass JSON via stdin/temp file; or replace Python with a JS PDF library (pdf-lib).

### 42. Inconsistent role checks across files
- `lib/auth.ts:184-208` `hasPermission` uses a `UserRole` type that omits `owner` (line 4).
- `getUserRole.ts:33-36` lists `owner` as firm_admin-equivalent.
- `middleware.ts:108` and `app/dashboard/team/page.tsx:50` duplicate the same check inline.
**Fix:** Centralize (`canAccessBilling(role)`, `canManageTeam(role)`).

### 43. `firm_users.email` doesn't exist but team page treats it as a column — `app/dashboard/team/page.tsx:14, 69`
`email: u.display_name || u.auth_user_id` — stuffs display name or UUID into an `email` field. Misleading types and confusing UI.

### 44. `lib/getFirmId.ts` fires 7 `console.log` calls per invocation
Strip or gate behind `DEBUG`.

---

## Areas where I want a second look

### A. Middleware `publicRoutes.startsWith('/accept-invite')` matches `/accept-invitation`
Confirmed in code. Verify no other routes have similar accidental prefix matches; the same `startsWith` pattern is everywhere.

### B. RLS coverage
I only audited code-side scoping. Several queries (notifications, client dashboard receipts, sms_queue, client_reports, receipt_flags, client_cards) rely on RLS to enforce tenancy. Worth confirming these tables actually have RLS enabled — if not, several findings escalate to 🔴.

### C. Stripe webhook silently no-ops on missing firm — `app/api/stripe/webhook/route.ts:138-172`
`if (!firm) ... return;` on customer-id mismatch. If the customer-to-firm mapping is ever wrong, updates silently disappear. Suggest alerting.

### D. Inbound-email `if/else if` brace structure — `app/api/inbound-email/route.ts:210-253`
Manually traced and it appears syntactically valid (the `else if` on line 253 chains with the outer `if` opened at line 210; nested `if` at 225-251 lives inside the `try/catch`). The indentation is misleading. A second human read would help confirm I tracked the braces correctly.

### E. Email-receipt OCR fall-through — `app/api/inbound-email/route.ts:210-251`
If attachment upload succeeds but `extractReceiptData` throws and the inline-image fallback also fails, `extractedData` stays null and the `else if (text || html || rawEmail)` text-parse branch is **not** entered (we're in the truthy attachments branch). The `email_receipt` row is created (line 180) but `extraction_status` stays `'pending'`. Verify the UI handles this state.
