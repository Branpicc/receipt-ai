# ReceiptAI Roadmap

## 🎯 Current Focus: Firm Version (MVP)
**Target: 1-2 weeks to completion**

### Core Features (In Progress)
- [x] Receipt upload & OCR extraction
- [x] AI categorization with tax codes
- [x] Client dashboard with upload
- [x] Accountant approval workflow
- [x] Email receipt ingestion (with client aliases)
- [x] Upload limit enforcement (per-file checking)
- [x] Settings with Billing & Plan tab
- [x] Dark mode throughout
- [x] Receipt detail view with image display
- [x] Budget tracking
- [x] Team invites & roles
- [ ] Email rate limit fix (disable SendGrid temporarily)
- [ ] Auto-refresh UsageStats after uploads
- [ ] Onboarding polish

---

## 💰 Pricing Model Refactor
**Status: Designed, not implemented**

### Current (Receipt-based limits):
- Free: 10 receipts/month
- Starter: 100 receipts/month, $29/mo
- Professional: Unlimited, $79/mo

### NEW (Client-based limits):
- **Free:** 1 client, 20 receipts/client/month, $0
- **Starter:** 5 clients, unlimited receipts, 1 user, $49/mo
- **Professional:** 20 clients, unlimited receipts, 3 users, $149/mo
- **Enterprise:** Unlimited clients/users, custom pricing, $299+/mo

**Rationale:** Firms scale by client count, not receipt count. This aligns pricing with value.

### Implementation Tasks:
- [ ] Update database schema (add `client_limit`, `user_limit` columns)
- [ ] Change limit checks (count clients, not receipts)
- [ ] Update `UsageStats` to show client usage (5/20 clients)
- [ ] Update billing page with new pricing
- [ ] Update Stripe price IDs
- [ ] Test upgrade/downgrade flows

---

## 🎁 Beta Testing Program
**Status: Planned for post-MVP**

### Strategy:
- **Offer:** 30-day free Professional trial (20 clients, all features)
- **Target:** 10-20 small accounting firms
- **Goal:** Validate "10 minutes at 5pm" value prop
- **Conversion:** Aim for 60%+ to paid plans

### Beta Program Tasks:
- [ ] Create beta landing page
- [ ] Build signup form (no credit card)
- [ ] Write onboarding email sequence
- [ ] Create feedback survey
- [ ] Set up weekly check-in calls
- [ ] Track metrics (time saved, accuracy, adoption)

### Where to Find Beta Testers:
- Reddit: r/Accounting, r/taxpros
- Facebook: Accounting firm groups
- LinkedIn: DM small firm owners
- Local: Visit 5 firms in person

---

## 🎨 Value Proposition & Messaging

### Core Message:
**"10 minutes at 5pm. That's it."**

### For Accountants:
- Stop chasing receipts in email threads
- Clients upload → AI categorizes → You approve in 10 mins
- Save 70% of time on receipt management
- No more missing receipts at tax time

### For Clients:
- Snap photo → Done
- No more emailing receipts to accountant
- Everything organized automatically
- Track your spending in real-time

### Marketing Taglines:
- "Stop chasing receipts. Start closing books faster."
- "Your clients upload. AI categorizes. You approve. Done."
- "10 minutes a day. Zero receipt headaches."

---

## 🏗️ Personal Version (Post-Firm Launch)
**Status: Planned for 4-6 months post-firm launch**

### Overview:
Stand-alone app for individuals (freelancers, contractors, sole proprietors) to manage their own receipts. Shares 80% of code with firm version via monorepo.

### Core Features (Same as Firm):
- Receipt upload & OCR
- AI categorization
- Tax code mapping
- Expense reports
- Budget tracking
- Dark mode

### Personal-Specific Features:
1. **Material Tracker** (Premium Feature)
   - Track line items as inventory
   - Subtract materials used per project
   - Cost tracking per item
   
2. **Project Folders**
   - Organize receipts by job/project
   - Track materials + labor costs per project
   - Calculate profit margins (Revenue - Costs)
   
3. **Tax Optimization**
   - Self-employment tax calculator
   - Quarterly tax estimates
   - Deductible expense tracking
   - Mileage tracking (optional)

### Target Markets:
- **Primary:** Contractors, tradespeople (plumbers, electricians, renovators)
- **Secondary:** Freelancers, consultants, small business owners
- **Tertiary:** Property managers, event planners, makers

### Pricing (Personal Version):
- **Free:** 20 receipts/month, basic features, $0
- **Pro:** 200 receipts/month, Material Tracker (3 projects), $12/mo
- **Premium:** Unlimited receipts, unlimited projects, tax reports, $24/mo

### Implementation Plan:
**Phase 1: Monorepo Setup (2-3 weeks)**
- [ ] Set up Turborepo/Nx
- [ ] Extract shared packages (`@receipt-ai/ui`, `@receipt-ai/lib`, `@receipt-ai/types`)
- [ ] Migrate firm app to use shared packages

**Phase 2: Personal App Scaffold (1 week)**
- [ ] Create new Next.js app
- [ ] Set up authentication (Supabase)
- [ ] Create simplified database schema (no firms/clients)

**Phase 3: Port Core Features (4-6 weeks)**
- [ ] Dashboard & upload flow
- [ ] Receipt list & detail
- [ ] Categories & reports
- [ ] Settings & billing

**Phase 4: Personal-Specific Features (2-3 weeks)**
- [ ] Material Tracker UI
- [ ] Project folders
- [ ] Job costing calculator
- [ ] Tax optimization tools

**Total Timeline: ~4 months**

---

## 🔧 Retention Offer System
**Status: Built, not tested in production**

### How It Works:
1. User clicks "Cancel Plan" in Settings
2. System checks if their card has been used for retention offer before
3. If eligible: Show "30% off for 3 months" popup
4. If accepted: Apply Stripe coupon, record in database
5. If declined: Proceed to cancellation

### Database:
```sql
CREATE TABLE retention_offers (
  id uuid PRIMARY KEY,
  firm_id uuid REFERENCES firms(id),
  stripe_card_fingerprint text UNIQUE,
  stripe_customer_id text,
  offer_type text DEFAULT '30_percent_3_months',
  accepted boolean DEFAULT false,
  accepted_at timestamptz,
  expires_at timestamptz
);
```

### API Routes:
- `/api/retention/check-eligibility` - Check if card is eligible
- `/api/retention/accept-offer` - Apply coupon and record offer

### Testing:
- [ ] Test with real Stripe subscription
- [ ] Verify card fingerprint tracking works
- [ ] Test offer expiration after 3 months

---

## 🐛 Known Issues

### High Priority:
- [ ] Storage upload failures on large files (network timeouts)
- [ ] UsageStats doesn't auto-refresh after uploads
- [ ] Email rate limit (SendGrid free tier too restrictive)

### Medium Priority:
- [ ] Receipt images sometimes don't load (caching issue?)
- [ ] Dark mode: Some components need polish
- [ ] Mobile PWA: Camera capture needs testing

### Low Priority:
- [ ] Export reports: Add more formats (Excel, PDF)
- [ ] Budget settings: Better UX for setting limits
- [ ] Notifications: Add in-app notifications (not just email)

---

## 📊 Success Metrics

### Pre-Launch (Firm Version):
- ✅ Core features complete
- ✅ No critical bugs
- ✅ 5 beta testers signed up
- ⏳ 60%+ beta → paid conversion

### Post-Launch (Year 1):
- **Revenue:** $10k MRR (67 firms @ $149/mo)
- **Users:** 100 paying firms
- **Retention:** 80%+ month-over-month
- **NPS:** 50+ (industry standard: 30-40)

### Post-Launch (Year 2):
- **Revenue:** $50k MRR (335 firms @ $149/mo)
- **Users:** 500 paying firms
- Launch personal version
- Add integrations (QuickBooks, Xero)

---

## 🔮 Future Features (Post-MVP)

### Integrations:
- [ ] QuickBooks sync
- [ ] Xero sync
- [ ] Stripe automatic invoice import
- [ ] Bank account linking (Plaid)

### Advanced Features:
- [ ] Multi-currency support
- [ ] Recurring receipt detection
- [ ] Duplicate receipt detection
- [ ] Bulk receipt editing
- [ ] Custom tax code mapping per firm
- [ ] White-label option (Enterprise)

### Mobile:
- [ ] Native iOS app (React Native?)
- [ ] Native Android app
- [ ] Offline mode with sync

---

## 📝 Technical Debt

### Code Quality:
- [ ] Extract repeated logic into shared utils
- [ ] Add comprehensive tests (Jest + Playwright)
- [ ] Improve TypeScript coverage (fix `any` types)
- [ ] Document API routes (OpenAPI spec)

### Performance:
- [ ] Add caching layer (Redis?)
- [ ] Optimize image loading (lazy loading, compression)
- [ ] Database indexing review
- [ ] Query optimization (reduce N+1 queries)

### Security:
- [ ] Security audit (penetration testing)
- [ ] Rate limiting on all API routes
- [ ] CORS configuration review
- [ ] RLS policy audit

---

## 🎓 Learning & Research

### To Explore:
- [ ] Accounting industry best practices
- [ ] CRA tax code requirements (Canadian compliance)
- [ ] IRS guidelines (US compliance)
- [ ] GDPR compliance (if expanding to EU)
- [ ] Competitor analysis (Receipt Bank, Dext, Expensify)

---

## 🚀 Launch Checklist

### Pre-Launch:
- [ ] All core features complete
- [ ] No critical bugs
- [ ] Beta testing feedback incorporated
- [ ] Pricing finalized
- [ ] Stripe production mode configured
- [ ] Domain & SSL set up
- [ ] Terms of Service written
- [ ] Privacy Policy written
- [ ] Support email set up

### Launch Day:
- [ ] Announce on social media
- [ ] Post on Reddit (r/Accounting)
- [ ] Email beta testers
- [ ] Update website with pricing
- [ ] Set up analytics (PostHog, Plausible)
- [ ] Monitor for bugs

### Post-Launch:
- [ ] Weekly usage reports
- [ ] Customer feedback calls
- [ ] Iterate based on feedback
- [ ] Plan next features

---

**Last Updated:** March 25, 2026
**Next Review:** After firm version MVP complete