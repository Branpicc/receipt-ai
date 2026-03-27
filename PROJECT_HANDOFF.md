ReceiptAI - Complete Project Handoff Document
Last Updated: March 26, 2026
Project Status: Firm Version MVP - 85% Complete

📋 TABLE OF CONTENTS

Project Overview
Current System Architecture
Completed Features
In-Progress Features
Known Issues & Bugs
Pending Features
Pricing Strategy
Marketing & Go-to-Market Strategy
Personal Version Roadmap
Technical Debt
Database Schema
Key File Locations
Environment & Setup
Next Session Priorities


1. PROJECT OVERVIEW
What is ReceiptAI?
A modern receipt management and expense tracking platform for Canadian accounting firms and their clients. Designed to replace email-based receipt collection with an AI-powered system that saves accountants time.
Core Value Proposition
"10 minutes at 5pm. That's it."
Instead of:

❌ Chasing receipts in email threads (2+ hours/week)
❌ Manual categorization and data entry
❌ Missing receipts at tax time
❌ Client confusion about what to submit

You get:

✅ Clients upload via app (phone/email)
✅ AI extracts & categorizes instantly
✅ 10-minute daily review: approve/flag/adjust
✅ All receipts searchable and organized
✅ Reports ready for tax season

Target Users
Primary: Small-to-medium Canadian accounting firms (5-50 clients)
Secondary: Bookkeepers, tax preparers, financial advisors
Client Types: Small businesses, sole proprietors, contractors

2. CURRENT SYSTEM ARCHITECTURE
Tech Stack

Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
Backend: Next.js API Routes, Supabase (PostgreSQL + Auth + Storage)
AI/ML: Anthropic Claude API for OCR and categorization
Payment: Stripe (Checkout + Customer Portal)
Email: SendGrid (currently disabled due to rate limits)
Deployment: Vercel (assumed)

Database: Supabase PostgreSQL
Key Tables:

firms - Accounting firms
firm_users - Users within firms (accountants, admins)
clients - Business clients of the firm
receipts - Receipt records with OCR data
receipt_items - Line items from receipts
receipt_taxes - Tax breakdown
receipt_files - Attached images/PDFs
receipt_flags - Issues flagged for review
invitations - Team invite system
email_receipts - Receipts forwarded via email
retention_offers - 30% discount tracking (anti-abuse)
user_preferences - User settings (theme, notifications)
category_budgets - Budget tracking per category
notifications - In-app notifications

File Storage: Supabase Storage

Bucket: receipt-files
Path structure: {firm_id}/{client_id}/{receipt_id}/{filename}
Supported formats: JPG, PNG, PDF, HEIC (auto-converted to JPG)


3. COMPLETED FEATURES
✅ Authentication & User Management

 Email/password login with Supabase Auth
 Magic link login (2FA)
 Role-based access control (firm_admin, accountant, client)
 Team invitation system (7-day expiry)
 Accept-invite flow with account creation
 Password reset functionality
 Display name customization
 Full dark mode support throughout

✅ Receipt Upload & Processing

 Multi-file drag & drop upload
 Camera capture (PWA) - image storage issue to fix
 HEIC to JPG auto-conversion
 OCR extraction using Claude API:

Vendor name
Receipt date
Total amount
Tax breakdown (GST/HST/PST)
Line items (description, quantity, price)
Confidence scoring


 Email receipt forwarding:

Firm-wide email: firm-{id}@receipts.example.com
Client-specific alias: {client_code}@receipts.example.com
Attachment processing (counts toward monthly limit)
Rejection handling for over-limit



✅ AI Categorization & Tax Coding

 Auto-categorization with confidence scores
 15+ expense categories (Meals, Office Supplies, Travel, etc.)
 Category reasoning explanations
 Manual category override
 Approval workflow (suggested → approved)
 Line item mismatch detection (flags mismatched categories)
 Receipt splitting for mixed categories

✅ Client Dashboard (/dashboard/client)

 Upload receipts (multi-file)
 View recent receipts
 Usage stats widget (receipts used/limit)
 Budget status tracking
 Email forwarding instructions
 Receipt limit enforcement (per-file checking with local counter)
 Auto-refresh usage stats after upload

✅ Accountant Dashboard (/dashboard)

 Overview of all clients
 Recent receipts from all clients
 Flag review workflow
 Categorization approval
 Client management (add/edit clients)
 Team invite system

✅ Receipt Detail Page

 Receipt image preview (with signed URLs)
 OCR data display
 Line items table (editable)
 Tax breakdown
 Purpose/memo field
 Category approval
 Flag system (warnings for review)
 Split receipt functionality (for mixed categories)
 PDF documentation generation for splits
 Edit mode vs. view-only mode (firm admins)

✅ Settings (/dashboard/settings)

 Profile management (email, display name, role)
 Notification preferences (email, receipts, budget alerts)
 Email forwarding setup (clients only)
 Password change
 Theme preferences (light/dark/system)
 Billing & Plan tab:

Current plan display
Usage stats with progress bar
Plan features list
"Change Plan" button → /dashboard/billing
"Cancel Plan" button (triggers retention offer)


 Data export (CSV)
 Onboarding tour replay

✅ Billing System

 Stripe integration (Checkout + Customer Portal)
 Three pricing tiers (Free, Starter, Professional)
 Subscription management
 Upgrade/downgrade flows
 Retention offer system:

30% discount for 3 months
Card fingerprint tracking (prevent abuse)
One offer per card lifetime
Auto-expires after 3 months



✅ Limit Enforcement

 Receipt upload limits:

Free: 10/month
Starter: 100/month
Professional: Unlimited


 Per-file limit checking (avoids race conditions)
 Local usage counter (increments immediately)
 Email attachment counting toward limit
 Over-limit rejection with upgrade CTA
 Days remaining until reset display

✅ Team Management

 Invite accountants/clients via email
 Role assignment
 Pending invitations list
 Resend/revoke invitations
 Client assignment to accountants
 Email sending disabled (SendGrid rate limits)
 Manual invite link sharing (logged to terminal)

✅ Notifications

 New receipt uploaded
 Receipt flagged for review
 Budget exceeded alerts
 Limit reached notifications
 Mark as read/unread
 Delete notifications

✅ UI/UX

 Full dark mode support
 Responsive design (mobile/tablet/desktop)
 Collapsible sidebar
 Floating tooltip bubbles (not right-side popups)
 Loading states and progress bars
 Error handling with user-friendly messages
 Confirmation dialogs for destructive actions
 Upload progress tracking (multi-file)


4. IN-PROGRESS FEATURES
🚧 Currently Working On

Camera capture image storage bug - OCR works but image doesn't save

Need to debug file upload path
Check storage bucket handling for camera photos
Verify compression settings


Pricing model refactor (Designed but not implemented)

Move from receipt-based limits to client-based limits
See section 7 for details




5. KNOWN ISSUES & BUGS
High Priority 🔴

Camera capture doesn't save images

OCR extracts data successfully
Image file not stored in Supabase Storage
Likely: compression or path issue
To debug: Check file_path in database, review terminal logs


Email rate limit (SendGrid)

Free tier too restrictive for invites
Current workaround: Email sending disabled, invite URLs logged to terminal
Solution: Upgrade to SendGrid paid plan OR use different email service


"Unknown Firm" in accept-invite

Firm name not loading in invitation acceptance page
Added console.log to debug - need to check what data is returned
Related file: app/accept-invite/[token]/page.tsx line 52



Medium Priority 🟡

Storage upload failures on large files (>2MB)

Network timeout issues
Retry logic (3 attempts) sometimes fails
Workaround: Upload smaller files or one at a time
Solution: Increase timeout, implement chunked upload


Images sometimes don't load in receipt detail

Intermittent caching issue
Fixed: Changed bucket from receipts to receipt-files
May still occur occasionally


Dark mode polish needed

Some components need better contrast
Billing page recently updated
Login page recently updated
May need review of other pages



Low Priority 🟢

Mobile PWA camera needs testing

Camera capture works but needs more testing on different devices
iOS vs Android differences


Export reports need more formats

Currently only CSV
TODO: Add Excel, PDF export options


Budget settings UX

Could be more intuitive
Consider wizard-style setup




6. PENDING FEATURES
Must-Have Before Launch

 Fix camera capture image storage
 Implement client-based pricing model
 Re-enable email sending (upgrade SendGrid or switch provider)
 Comprehensive testing across all user flows
 Performance optimization (query optimization, caching)
 Security audit (RLS policies, API rate limiting)

Nice-to-Have (Post-MVP)

 QuickBooks integration
 Xero integration
 Bulk receipt editing
 Duplicate receipt detection
 Recurring receipt templates
 Advanced reporting (profit/loss, expense trends)
 Multi-currency support
 Bank account linking (Plaid)
 Mobile native apps (React Native)
 Offline mode with sync
 White-label option (Enterprise tier)
 API access for integrations
 Webhook system for events
 Advanced budgeting (forecasting, alerts)
 Receipt approval workflow (multi-level)
 Audit trail (who changed what, when)

Future Enhancements

 Machine learning improvements (better categorization over time)
 Smart receipt matching (detect duplicates, split bills)
 Expense policy enforcement (flag out-of-policy expenses)
 Mileage tracking
 Time tracking integration
 Project-based expense tracking
 Multi-language support (French for Quebec)
 Voice notes on receipts
 Receipt annotations (markup, highlights)


7. PRICING STRATEGY
Current Model (Receipt-based) - TO BE REPLACED
Free:         10 receipts/month, 1 user, $0
Starter:     100 receipts/month, 1 user, $29/mo
Professional: ∞ receipts/month, 3 users, $79/mo
Enterprise:   Custom pricing
Problem: Almost every firm hits 100+ receipts quickly → everyone needs Professional tier → leaving money on the table.

NEW Model (Client-based) - APPROVED, NOT IMPLEMENTED
FREE TIER:
- 1 client
- 20 receipts/client/month
- 1 accountant user
- $0

STARTER: $49/month
- Up to 5 clients
- Unlimited receipts per client
- 1 accountant user
- AI categorization
- Tax code mapping
- Email support

PROFESSIONAL: $149/month
- Up to 20 clients
- Unlimited receipts per client
- 3 accountant users
- Everything in Starter
- Priority support
- Advanced reports
- API access

ENTERPRISE: $299+/month
- Unlimited clients
- Unlimited users
- White-label option
- Dedicated support
- Custom integrations
- Custom pricing based on needs
Why Client-Based Pricing is Better

Scales with firm size - 5-client firm pays $49, 20-client firm pays $149
Aligns value with price - More clients = more value = willing to pay more
Clear upgrade path - Natural progression as firm grows
Industry standard - How QuickBooks, Xero, etc. price
Better revenue - 90% more revenue vs. receipt-based model

Revenue Projections (100 paying firms, Year 1)
Current model: $7,900/mo = $94,800/year
New model: $14,900/mo = $178,800/year
Implementation Tasks for New Pricing

Update database schema:

sql   ALTER TABLE firms 
   ADD COLUMN client_limit integer DEFAULT 1,
   ADD COLUMN user_limit integer DEFAULT 1;
```

2. Update limit checks:
   - Count `clients` table rows per firm
   - Block adding new clients when limit reached
   - Show client usage in settings (5/20 clients)

3. Update billing page with new pricing

4. Update Stripe price IDs

5. Migrate existing customers (grandfather old plans?)

---

## 8. MARKETING & GO-TO-MARKET STRATEGY

### Target Market
**Primary:** Small accounting firms in Canada (1-10 employees, 5-50 clients)
**Why:** Too small for enterprise software (QuickBooks Practice, Drake), too big for spreadsheets

**Secondary:** 
- Bookkeepers (independent or small shops)
- Tax preparers (H&R Block franchises, independent)
- Financial advisors (with tax/bookkeeping services)

### Positioning
**Category:** Receipt management for accounting firms
**Differentiation:** AI-powered, saves 90% of receipt collection time

**Messaging Hierarchy:**
1. **Main headline:** "10 minutes at 5pm. That's it."
2. **Subheadline:** "Stop chasing receipts. AI organizes everything. You approve in 10 minutes."
3. **Proof points:**
   - Clients upload via phone (10 seconds)
   - AI categorizes with 85%+ accuracy
   - Daily 5pm review workflow
   - All receipts searchable and organized
   - Tax-ready reports in seconds

### Value Proposition by Persona

**For Accountants:**
- Save 70% of time on receipt management (2 hours/week → 30 minutes/week)
- No more chasing clients for missing receipts
- Fewer errors from manual categorization
- Happier clients (easier for them to submit)
- More billable time for higher-value work

**For Clients:**
- Dead simple: snap photo → done
- No more emailing receipts
- Track spending in real-time
- Never lose a receipt
- Tax time = stress-free

### Beta Testing Strategy

**Offer:** 30-day free Professional trial (20 clients, all features, no credit card)

**Goal:** Get 10-20 firms to test, convert 60%+ to paid

**Target Beta Testers:**
- Small firms (5-15 clients)
- Tech-savvy accountants (early adopters)
- Pain-aware (currently struggling with receipts)
- Referral-friendly (will recommend if they like it)

**Where to Find Them:**
1. **Reddit:** r/Accounting, r/taxpros (post beta offer, answer questions)
2. **Facebook Groups:** "Canadian Accountants", "QuickBooks Users", firm owner groups
3. **LinkedIn:** DM 50 small firm owners with personalized message
4. **Local:** Visit 5 firms in person, offer free setup + onboarding
5. **Referrals:** Ask existing network for warm intros

**Beta Onboarding Flow:**
1. **Week 0:** Sign up, create account, add 1-2 test clients
2. **Week 1:** Accountant and clients upload sample receipts, see AI in action
3. **Week 2-3:** Real usage, daily 5pm reviews, track time saved
4. **Week 4:** Feedback call (30 mins), conversion offer (20% lifetime discount)

**Beta Success Metrics:**
- Time saved: 70%+ reduction (measure: before vs. after)
- Accuracy: 85%+ AI categorization correct
- Adoption: 80%+ of clients actively upload
- Satisfaction: NPS 50+ (industry standard: 30-40)
- Conversion: 60%+ beta → paid

### Launch Plan

**Pre-Launch (2 weeks before):**
- [ ] Beta testing complete, feedback incorporated
- [ ] Pricing finalized and published
- [ ] Landing page live with value prop, pricing, demo
- [ ] Terms of Service, Privacy Policy written
- [ ] Support email/chat set up
- [ ] Analytics installed (PostHog, Plausible)
- [ ] Press kit prepared (screenshots, founder story, demo video)

**Launch Day:**
- [ ] Announce on social media (LinkedIn, Twitter)
- [ ] Post on Reddit (r/Accounting, r/smallbusiness, r/entrepreneur)
- [ ] Email beta testers (thank them, ask for testimonials)
- [ ] Product Hunt launch (if applicable)
- [ ] Reach out to accounting publications (CPA Canada, AccountingWEB)

**Post-Launch (First 30 days):**
- [ ] Weekly usage reports (signups, activations, MRR)
- [ ] Customer feedback calls (10-15 firms)
- [ ] Iterate based on feedback (top 3 feature requests)
- [ ] Content marketing (blog posts on receipt management, tax tips)
- [ ] SEO optimization (target keywords: "receipt app for accountants", "expense tracking Canada")

### Content Marketing Ideas
**Blog Topics:**
- "How to Organize Receipts for Tax Season (Without Losing Your Mind)"
- "The True Cost of Manual Receipt Entry for Accountants"
- "CRA Audit Survival Guide: Receipt Organization Best Practices"
- "5 Ways AI is Changing Accounting (And Why You Should Care)"
- "Case Study: How [Firm Name] Saved 10 Hours/Week with ReceiptAI"

**Video Content:**
- 60-second demo (accountant POV)
- 30-second demo (client POV)
- "Day in the Life" with ReceiptAI
- Common mistakes when managing receipts
- Tax season prep checklist

### Pricing Psychology

**Anchor:** Professional at $149/mo makes Starter at $49/mo feel like a steal
**Trial:** 30-day free trial lowers barrier, builds habit
**Annual discount:** Offer 2 months free for annual payment (better retention)
**Grandfathering:** Honor beta pricing for early adopters (loyalty)

---

## 9. PERSONAL VERSION ROADMAP

### Overview
After firm version launches and stabilizes, build a standalone **personal version** for individuals (freelancers, contractors, sole proprietors).

**Timeline:** 4-6 months post-firm launch

**Why Build It:**
- Different market segment (B2C vs. B2B)
- Unique differentiator: **Material Tracker** (job costing for contractors)
- Shares 80% of codebase with firm version
- Recurring revenue from individuals

---

### Personal Version - Core Features

**Same as Firm Version:**
- Receipt upload & OCR
- AI categorization
- Tax code mapping
- Expense reports
- Budget tracking
- Dark mode
- Mobile PWA

**Personal-Specific Features:**

#### 1. **Material Tracker** (Premium Feature)
**Problem:** Contractors buy supplies in bulk, use across multiple jobs, have NO IDEA what each job cost.

**Solution:** Track receipt line items as inventory, subtract materials used per project.

**How It Works:**
```
Example: Bathroom Renovation

1. Buy supplies at Home Depot
   Receipt: $847 total
   Line items:
   - 12 drywall sheets @ $10 each = $120
   - 3 boxes of screws (40/box) @ $5 each = $15
   - 2 packs nail gun nails (50/pack) @ $8 each = $16
   - 20 concrete screws @ $12 = $12
   - Paint, tile, etc.

2. Create project folder: "123 Main St - Bathroom"

3. As you work, subtract materials used:
   - Used 8/12 drywall sheets = $80 of $120
   - Used 32/40 screws from box 1 = $4 of $5
   - Used 42/50 nail gun nails = $6.72 of $8

4. Add labor costs:
   - 40 hours @ $50/hr = $2,000

5. Enter revenue:
   - Client paid: $3,500

6. See profit:
   - Revenue: $3,500
   - Materials: $680 used
   - Labor: $2,000
   - Profit: $820 (23% margin)

7. Export job cost report (PDF) for client or taxes
```

**Key Features:**
- Virtual inventory from receipt line items
- Manual quantity subtraction (enter "used 32 screws")
- Cost tracking per item
- Project folders for organizing jobs
- Labor + material costs per project
- Profit calculator (Revenue - Costs = Profit)
- Tax-compliant reports (CRA documentation)
- View-only sharing for clients/bookkeepers

#### 2. **Tax Optimization Tools**
- Self-employment tax calculator
- Quarterly tax estimates
- Deductible expense tracking
- Mileage tracking (optional)
- HST/GST filing assistance

#### 3. **Simplified Onboarding**
- No "firm" or "client" concepts
- Just "you" and your receipts
- Income type selection (employed, self-employed, incorporated, etc.)
- Industry-specific categories

---

### Personal Version - Pricing
```
FREE:
- 20 receipts/month
- Basic categorization
- CSV export
- $0

PRO: $12/month
- 200 receipts/month
- Material Tracker (3 active projects)
- Job costing
- Tax reports
- $12/mo

PREMIUM: $24/month
- Unlimited receipts
- Unlimited projects
- Advanced tax optimization
- Mileage tracking
- Priority support
- $24/mo
```

**Why Lower Than Firm Version?**
- No multi-user complexity
- Targeting individuals, not businesses
- Simpler feature set (no team management, etc.)

---

### Personal Version - Target Markets

**Primary: Contractors & Tradespeople**
- Plumbers, electricians, HVAC, renovators
- Pain: No idea what jobs actually cost
- Value: Real job costing data → better quotes → higher profits

**Secondary Markets:**
1. **Freelancers** - Writers, designers, consultants (need expense tracking)
2. **Property Managers** - Track materials per unit
3. **Event Planners** - Track supplies per event
4. **Small Manufacturers** - Track raw materials per product batch
5. **Auto Repair Shops** - Track parts per customer job

**Market Size:** ~2.3M contractors in US/Canada
**Willingness to Pay:** $12-24/mo for job costing (vs. $50-200/mo for construction software)

---

### Personal Version - Implementation Plan

#### Phase 1: Monorepo Setup (2-3 weeks)
**Goal:** Extract shared code, set up for code reuse
```
/receipt-ai-monorepo
  /packages
    /shared-ui         # React components (UploadZone, ReceiptCard, etc.)
    /shared-lib        # OCR, categorization, utils
    /database-schema   # Supabase types
  /apps
    /firm-app          # Current app
    /personal-app      # New app
Tasks:

 Set up Turborepo or Nx
 Extract components to @receipt-ai/ui
 Extract logic to @receipt-ai/lib
 Migrate firm app to use shared packages
 Test that firm app still works

Phase 2: Personal App Scaffold (1 week)
Goal: Create new Next.js app with simplified schema
Database Schema (Personal):
sql-- Personal version tables
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  name text,
  subscription_tier text, -- free, pro, premium
  created_at timestamptz DEFAULT now()
);

CREATE TABLE receipts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  -- Same receipt fields as firm version
);

CREATE TABLE projects (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  name text,
  client_name text,
  revenue_cents integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE material_inventory (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  item_description text,
  quantity decimal,
  unit_price_cents integer,
  receipt_id uuid REFERENCES receipts(id),
  project_id uuid REFERENCES projects(id), -- if assigned
  created_at timestamptz DEFAULT now()
);

-- No firms table, no clients table, no firm_users table
Tasks:

 Create new Next.js app
 Set up Supabase auth (same instance)
 Create simplified database schema
 Build basic dashboard layout

Phase 3: Port Core Features (4-6 weeks)
Goal: Reuse components, connect to personal schema
Week 1: Dashboard & Upload

Import <UploadZone> from shared UI
Import uploadReceipt() from shared lib
Connect to personal database

Week 2: Receipt List & Detail

Import <ReceiptCard>, <ReceiptDetail>
Adjust for single-user context

Week 3: Categories & Reports

Import categorizeReceipt()
Import chart components
Generate tax reports

Week 4: Settings & Billing

Build personal billing (Stripe)
Simpler pricing (no team seats)
Personal preferences

Phase 4: Material Tracker (2-3 weeks)
Goal: Build the differentiator
Tasks:

 Materials page (list all receipt line items)
 "Use Materials" modal (subtract quantities)
 Project folders UI
 Assign materials to projects
 Job cost calculator
 Labor cost tracking
 Profit margin display
 Export job cost report (PDF)

Total Timeline: ~4 months to personal version v1

Personal Version - Competitive Advantage
Most receipt apps:

Store receipts ✅
Categorize expenses ✅
Generate reports ✅

ReceiptAI Personal:

Everything above PLUS:
Job costing system 🔥
Material inventory tracking 🔥
Project-based profit analysis 🔥

Positioning: "Receipt app for contractors" - niche with money and real pain
Why It Works:

Most contractors use spreadsheets (tedious) or expensive software (overkill)
You're building a lightweight job costing system disguised as a receipt app
Key insight: Receipts contain line items = inventory tracking is possible


10. TECHNICAL DEBT
Code Quality

 Extract repeated logic into shared utils
 Add comprehensive tests (Jest for units, Playwright for E2E)
 Improve TypeScript coverage (fix any types)
 Document API routes (OpenAPI spec)
 Add JSDoc comments to complex functions

Performance

 Add caching layer (Redis for session data?)
 Optimize image loading (lazy loading, WebP conversion)
 Database indexing review (ensure queries are fast)
 Query optimization (reduce N+1 queries with joins)
 Implement pagination for large lists

Security

 Security audit (penetration testing)
 Rate limiting on all API routes (prevent abuse)
 CORS configuration review
 RLS policy audit (ensure no data leaks)
 Input validation on all forms
 SQL injection prevention (already using Supabase ORM, but verify)
 XSS prevention (sanitize user input)

Monitoring & Observability

 Error tracking (Sentry or similar)
 Performance monitoring (Vercel Analytics)
 User analytics (PostHog, Mixpanel)
 Uptime monitoring (Better Uptime, Pingdom)
 Log aggregation (if scaling beyond Vercel logs)


11. DATABASE SCHEMA
Core Tables
firms
sqlCREATE TABLE firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subscription_plan text, -- legacy: free, starter, professional
  subscription_tier text, -- new: free, starter, professional, enterprise
  subscription_status text, -- active, canceled, past_due
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
firm_users
sqlCREATE TABLE firm_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'firm_admin', 'accountant', 'client')),
  display_name text,
  client_id uuid REFERENCES clients(id), -- if role = client
  created_at timestamptz DEFAULT now(),
  UNIQUE(auth_user_id, firm_id)
);
clients
sqlCREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) NOT NULL,
  name text NOT NULL,
  email_alias text, -- for email forwarding
  client_code text, -- short code (e.g., 'branpicc')
  is_active boolean DEFAULT true,
  assigned_accountant_id uuid REFERENCES firm_users(id),
  email_forwarding_address text, -- user's personal email for forwarding
  income_type text, -- employed, self_employed, incorporated, etc.
  secondary_income jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
receipts
sqlCREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) NOT NULL,
  client_id uuid REFERENCES clients(id) NOT NULL,
  uploaded_by uuid REFERENCES firm_users(id),
  vendor text,
  receipt_date date,
  total_cents integer,
  currency text DEFAULT 'CAD',
  status text DEFAULT 'pending', -- pending, approved, flagged
  source text, -- upload, email, camera, split
  file_path text, -- Supabase Storage path
  purpose_text text,
  purpose_source text, -- accountant, client, ai
  purpose_updated_at timestamptz,
  suggested_category text,
  category_confidence integer, -- 0-100
  approved_category text,
  category_reasoning text,
  category_approved_by uuid REFERENCES firm_users(id),
  category_approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
receipt_items
sqlCREATE TABLE receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  description text,
  quantity decimal,
  unit_price_cents integer,
  total_cents integer,
  line_index integer,
  created_at timestamptz DEFAULT now()
);
receipt_taxes
sqlCREATE TABLE receipt_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  firm_id uuid REFERENCES firms(id),
  tax_type text, -- GST, HST, PST, QST
  rate decimal,
  amount_cents integer,
  created_at timestamptz DEFAULT now()
);
receipt_flags
sqlCREATE TABLE receipt_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  firm_id uuid REFERENCES firms(id),
  flag_type text, -- purpose_vendor_mismatch, line_item_mismatch, duplicate, etc.
  severity text CHECK (severity IN ('info', 'warn', 'high')),
  message text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
invitations
sqlCREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('accountant', 'client', 'firm_admin')),
  token text UNIQUE NOT NULL,
  invited_by uuid REFERENCES firm_users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  client_id uuid REFERENCES clients(id), -- pre-created client for invitation
  assigned_accountant_id uuid REFERENCES firm_users(id),
  created_at timestamptz DEFAULT now()
);
email_receipts
sqlCREATE TABLE email_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) NOT NULL,
  client_id uuid REFERENCES clients(id), -- if using client alias
  from_email text,
  subject text,
  body text,
  attachment_count integer DEFAULT 0,
  rejection_reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);
retention_offers
sqlCREATE TABLE retention_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) NOT NULL,
  stripe_card_fingerprint text UNIQUE NOT NULL,
  stripe_customer_id text NOT NULL,
  offer_type text DEFAULT '30_percent_3_months',
  offered_at timestamptz DEFAULT now(),
  accepted boolean DEFAULT false,
  accepted_at timestamptz,
  expires_at timestamptz, -- 3 months from accepted_at
  created_at timestamptz DEFAULT now()
);
user_preferences
sqlCREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  theme text DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language text DEFAULT 'en',
  email_notifications boolean DEFAULT true,
  receipt_notifications boolean DEFAULT true,
  budget_alerts boolean DEFAULT true,
  weekly_digest boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
category_budgets
sqlCREATE TABLE category_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) NOT NULL,
  category text NOT NULL,
  monthly_budget_cents integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(firm_id, category)
);
notifications
sqlCREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id),
  user_id uuid REFERENCES auth.users(id), -- specific user (optional)
  type text, -- receipt_uploaded, receipt_flagged, budget_exceeded, etc.
  title text,
  message text,
  receipt_id uuid REFERENCES receipts(id),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
Indexes
sql-- Receipts
CREATE INDEX idx_receipts_firm ON receipts(firm_id);
CREATE INDEX idx_receipts_client ON receipts(client_id);
CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_created ON receipts(created_at);
CREATE INDEX idx_receipts_status ON receipts(status);

-- Email receipts
CREATE INDEX idx_email_receipts_firm_created ON email_receipts(firm_id, created_at);
CREATE INDEX idx_email_receipts_status ON email_receipts(firm_id, status);
CREATE INDEX idx_email_receipts_client ON email_receipts(client_id);

-- Invitations
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_firm_status ON invitations(firm_id, status);

-- Retention offers
CREATE INDEX idx_retention_offers_card ON retention_offers(stripe_card_fingerprint);
CREATE INDEX idx_retention_offers_firm ON retention_offers(firm_id);
```

---

## 12. KEY FILE LOCATIONS

### API Routes (`app/api/`)
```
/accept-invite/route.ts          - Accept team invitation (service role)
/categorize-receipt/route.ts     - AI categorization
/inbound-email/route.ts          - Email receipt processing
/invite-user/route.ts            - Send team invitation
/ocr-extract/route.ts            - OCR extraction from images
/retention/
  /check-eligibility/route.ts    - Check if eligible for discount
  /accept-offer/route.ts         - Apply 30% discount
/stripe/
  /cancel-subscription/route.ts  - Cancel Stripe subscription
  /create-checkout-session/route.ts - Start Stripe checkout
  /create-portal-session/route.ts - Open customer portal
  /webhook/route.ts              - Stripe webhook handler
/upload-receipt/route.ts         - Upload & process receipt
```

### Pages (`app/`)
```
/accept-invite/[token]/page.tsx  - Accept invitation page
/dashboard/
  /page.tsx                      - Accountant dashboard (firm admin)
  /client/page.tsx               - Client dashboard ⚠️ THIS IS THE ACTIVE CLIENT PAGE
  /receipts/
    /page.tsx                    - Receipt list
    /[id]/page.tsx               - Receipt detail
  /settings/page.tsx             - Settings with Billing tab
  /billing/page.tsx              - Billing & plans
  /team/page.tsx                 - Team management
  /clients/page.tsx              - Client management
  /budget-settings/page.tsx      - Budget configuration
  /flags/page.tsx                - Flagged receipts
  /layout.tsx                    - Sidebar navigation
/login/page.tsx                  - Login page (dark mode fixed)
/signup/page.tsx                 - Signup (currently disabled)
```

### Components (`components/`)
```
/UsageStats.tsx                  - Monthly usage widget (auto-refreshes)
/UploadFab.tsx                   - Floating upload button
/LogoutButton.tsx                - Logout button
/ThemeProvider.tsx               - Dark mode provider
/RequestChangesModal.tsx         - Firm admin change request modal
/onboardingSteps.tsx             - Client onboarding with income type
```

### Libraries (`lib/`)
```
/auth.ts                         - Auth helpers (login, logout, magic link)
/categorizeReceipt.ts            - AI categorization logic
/checkUsageLimits.ts             - Receipt limit checking
/convertHeicClient.ts            - HEIC to JPG conversion
/detectLineItemMismatches.ts     - Flag mismatched categories
/getFirmId.ts                    - Get user's firm ID
/getUserRole.ts                  - Get user's role
/supabaseClient.ts               - Supabase client (browser)
/useOnboarding.ts                - Onboarding state management
```

### Configuration
```
/.env.local                      - Environment variables
/middleware.ts                   - Auth & routing middleware
/tailwind.config.ts              - Tailwind configuration (dark mode)
/next.config.mjs                 - Next.js configuration
/ROADMAP.md                      - Product roadmap
/package.json                    - Dependencies

13. ENVIRONMENT & SETUP
Environment Variables (.env.local)
bash# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic (Claude API for OCR)
ANTHROPIC_API_KEY=sk-ant-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SendGrid (currently disabled)
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@receiptai.app

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
Installation
bash# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
Database Setup

Create Supabase project
Run schema migrations (see section 11)
Enable Row Level Security (RLS) policies
Configure storage bucket: receipt-files
Set up email templates (if re-enabling SendGrid)

Deployment

Platform: Vercel (recommended) or similar
Environment: Node.js 18+
Database: Supabase PostgreSQL
Storage: Supabase Storage
CDN: Vercel Edge Network


14. NEXT SESSION PRIORITIES
Immediate (This Week)

Fix camera capture image storage bug 🔴

Debug: Check file_path in database
Review terminal logs during camera upload
Test storage bucket path handling
Verify compression settings


Fix "Unknown Firm" in invite acceptance 🔴

Console.log is already added (line 52 in accept-invite page)
Check what data is returned from Supabase query
Verify firm name join is working


Test complete user flows 🟡

Firm admin: Create account → Invite client → Client accepts → Upload receipt → Approve
Client: Accept invite → Upload receipt → View in dashboard
Accountant: Review receipts → Categorize → Flag → Resolve



Short-Term (Next 2 Weeks)

Implement client-based pricing model 🟡

Update database schema (add client_limit, user_limit)
Change limit checks (count clients, not receipts)
Update Settings to show client usage
Update billing page with new pricing
Update Stripe price IDs
Test upgrade/downgrade flows


Re-enable email sending 🟡

Upgrade SendGrid plan OR switch to different provider
Test email delivery
Update invite flow to send emails again


Performance optimization 🟢

Review slow queries
Add database indexes where needed
Optimize image loading (lazy load, WebP)
Add caching where appropriate



Before Beta Launch

Security audit 🔴

Review RLS policies (ensure no data leaks)
Add rate limiting to API routes
Test for common vulnerabilities (XSS, SQL injection)
Ensure proper input validation


Polish & bug fixes 🟡

Test on different browsers (Chrome, Safari, Firefox)
Test on mobile devices (iOS, Android)
Fix any remaining dark mode issues
Improve error messages


Documentation 🟢

Write user guide for accountants
Write user guide for clients
Create onboarding emails
Record demo video


Beta program setup 🟡

Create landing page for beta signups
Set up 30-day trial (no credit card)
Write outreach emails
Prepare feedback survey




TESTING CREDENTIALS
Test Firm

Firm ID: aaf4cc88-c700-431a-ac5a-20b28247c9ab
Firm Name: Test Client Inc
Subscription: Starter (100 receipts/month)

Test Users

Firm Admin:

Email: (your email)
User ID: 6a3dc80f-5438-4785-933b-85ddc849ff09
Firm User ID: e76b6cb5-cba5-4419-bc3b-09c6a5a4f501
Role: firm_admin


Test Client:

Client ID: 1e3dd519-7674-4edc-8389-ca06b6ac146b
Email: (test client email)




RECENT SESSION NOTES (March 26, 2026)
What We Fixed Today

✅ Email rate limit - Disabled SendGrid, invites still work (URLs logged)
✅ Accept-invite API - Created service role route to bypass RLS
✅ Login dark mode - Full dark mode styling, inputs now visible
✅ UsageStats auto-refresh - Refreshes after uploads using React key

What We Discovered

Camera capture bug - OCR works but image doesn't save (to debug next session)
"Unknown Firm" issue - Added console.log to debug firm name loading
Client dashboard is separate - /dashboard/client/page.tsx is the active client page (NOT /dashboard/page.tsx)

Current State

Upload limit enforcement: ✅ Working (local counter prevents race conditions)
Billing & Plan tab: ✅ Complete with retention offer system
Dark mode: ✅ Fully implemented across all pages
Email sending: ⏸️ Disabled (to re-enable with production SendGrid)
Camera capture: ⚠️ OCR works, image storage broken


IMPORTANT REMINDERS

Two dashboard pages exist:

/dashboard/page.tsx - For firm admins/accountants
/dashboard/client/page.tsx - For clients ⚠️ THIS IS WHAT CLIENTS SEE


Storage bucket name:

Use receipt-files (NOT receipts)


Subscription tiers:

subscription_tier takes priority over subscription_plan
Professional plan = 999999 receipts (unlimited)


Limit enforcement:

Uses local counter (increments immediately after each upload)
Checks limit BEFORE each file upload
Prevents race conditions


Email forwarding:

Firm-wide: firm-{id}@receipts.example.com
Client-specific: {client_code}@receipts.example.com


Retention offers:

Locked per card fingerprint (prevent abuse)
30% discount for 3 months
Expires automatically
Only eligible once per card




QUESTIONS TO ASK NEXT SESSION

Did you test camera capture image storage? What did you find?
Did the "Unknown Firm" console.log show anything useful?
Are there any other bugs or issues discovered?
Ready to implement client-based pricing model?
When do you want to start beta testing?

END OF HANDOFF DOCUMENT
This document should provide complete context for the next session. All major decisions, features, bugs, and future plans are documented above.