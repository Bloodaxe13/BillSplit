# BillSplit — Design Document

**Date:** 2026-02-20
**Status:** Approved

---

## 1. Overview & Problem Statement

**BillSplit** is a mobile-first expense splitting app built for travel groups. It solves the pain of splitting bills across a trip — multiple restaurants, activities, taxis, and currencies — without spreadsheets, mental math, or awkward "you owe me" conversations.

**Core problem:** Splitting a single dinner is easy. Splitting 30+ expenses across 10 people over a week-long trip in a foreign currency is not. Existing solutions (Splitwise, manual tracking) either lack receipt scanning, handle currencies poorly, or require everyone to sign up before you can start.

**Key differentiators:**

- Photo-to-split: snap a receipt, AI extracts line items, group members tap what they had
- Multi-currency with live conversion — debts shown in both local and home currency
- Low friction: only payers need accounts, others join via link
- Smart debt simplification to minimize the number of settlement transactions
- Designed for travel groups of 2-15 people

**Target user:** The "trip organizer" — the person who books the Airbnb, makes the restaurant reservations, and keeps track of who owes what. They'll drive adoption within their group.

---

## 2. Architecture & Tech Stack

**Mobile app:** Expo (React Native) — single codebase for iOS and Android. Expo provides managed builds, OTA updates, and native camera access for receipt scanning.

**Backend:** Self-hosted Supabase stack on Railway, consisting of:

- **PostgreSQL** — primary database for users, groups, trips, receipts, line items, debts
- **Supabase Auth** — email, Google, and Apple sign-in
- **Supabase Realtime** — live updates when group members claim items (everyone sees checkboxes tick in real-time)
- **Supabase Storage** — receipt image storage
- **PostgREST** — auto-generated REST API from the Postgres schema
- **Edge Functions** — for receipt processing pipeline and webhook handlers

**Receipt processing pipeline:**

1. User snaps photo → image uploaded to Supabase Storage
2. Edge function triggered → sends image to Google Document AI (or Azure Document Intelligence) for OCR extraction of line items and table structure
3. OCR output piped to LLM (GPT-5 or Claude API) for structuring — interprets tax/tip/service fee relationships, normalizes item names, outputs clean JSON
4. Structured line items written to database → realtime pushes update to all group members

**Currency conversion:** Open Exchange Rates API (free tier covers 1,000 requests/month) or Frankfurter (free, open source). Rates cached daily.

**Offline support:** Receipt photos stored locally via Expo FileSystem. Queued for processing when connectivity returns. SQLite (via expo-sqlite) for local draft state.

---

## 3. Data Model

### Core Entities

```
User
├── id, email, display_name, avatar_url, home_currency
└── created_at

Group
├── id, name, created_by (User), invite_code
├── default_currency
└── created_at

GroupMember
├── group_id, user_id (nullable for link-only members)
├── display_name, role (admin/member)
└── joined_at

Trip (optional container within a Group)
├── id, group_id, name, start_date, end_date
└── status (active/settled)

Receipt
├── id, group_id, trip_id (nullable)
├── paid_by (GroupMember), currency
├── subtotal, tax, tip, service_fee, total
├── tax_structure (JSON — captures cascading/inclusive logic)
├── image_url, ocr_raw (JSON), processing_status
└── created_at

LineItem
├── id, receipt_id, description, quantity, unit_price, total_price
└── category (food/drink/other — LLM assigned)

LineItemClaim
├── line_item_id, group_member_id
├── portion (decimal, default 1.0 — for custom split ratios)
└── claimed_at

Debt (computed/materialized)
├── id, group_id, trip_id (nullable)
├── from_member, to_member
├── amount, currency
├── settled (boolean), settled_at
└── receipt_id (source)
```

### Key Relationships

- A `Receipt` has many `LineItems`, each `LineItem` has many `LineItemClaims`
- `Debt` records are computed after all claims are in — proportional tax/tip/fees distributed based on each member's share of the subtotal
- Debt simplification runs across all unsettled debts in a group/trip to minimize transactions (e.g., 12 debts → 4 optimized payments)

### Row-Level Security

Supabase RLS ensures users can only read/write data for groups they belong to. Link-only members get scoped access via their invite token.

---

## 4. Core User Flows

### 4.1 Create a Group

1. User signs up / logs in → taps "New Group" → names it (e.g., "Bali 2026")
2. Sets default currency (IDR) and optionally creates a trip container
3. Gets a shareable invite link → sends to group chat (WhatsApp, iMessage, etc.)
4. Friends tap link → land on a claim page. Can use immediately with just a name, or sign up for full features

### 4.2 Upload a Receipt

1. Payer taps "Add Receipt" → camera opens → snaps photo
2. If offline: photo queued locally, "Processing when online" indicator shown
3. If online: processing pipeline runs (3-8 seconds) → line items appear
4. Validation step: extracted total displayed alongside receipt image — payer confirms the total matches before the group can start claiming
5. Payer reviews extracted items, fixes any OCR errors

### 4.3 Claim Your Items (Group Member View)

1. Push notification: "Dan added a receipt from Warung Babi Guling"
2. Open receipt → see list of line items with checkboxes
3. Tap items you had → checkbox fills, defaults to 1x portion
4. Shared item (e.g., "Bottle of Wine x2") → multiple people tick it → split equally by default → long-press to adjust portions
5. Real-time: everyone sees who's claimed what as it happens

### 4.4 Payer Assignment View

1. Payer sees all line items with member avatars
2. Can drag-assign unclaimed items to specific members
3. Can nudge individuals: "You haven't claimed anything yet"
4. Confirms when all items are accounted for → debts calculated

### 4.5 Settle Up

1. Group dashboard shows running totals: "You owe Sarah 350,000 IDR (≈ $33 AUD)"
2. Tap a debt → "Mark as settled" (free tier) or "Pay now" (future: in-app payment)
3. Debt simplification (Pro): "Instead of 8 payments, only 3 needed" with optimized amounts shown
4. Trip close-out: summary screen with full breakdown per person

---

## 5. Tax, Tip & Service Fee Handling

Receipts worldwide have varying fee structures:

- **US:** flat sales tax on subtotal + voluntary tip
- **Bali/Indonesia:** service fee (e.g., 7%) on subtotal, then tax (e.g., 10%) on subtotal + service fee (cascading)
- **Europe:** VAT typically included in listed price
- **Australia:** GST included in listed price

The LLM layer interprets the receipt's fee lines and determines the calculation method. This is stored as a `tax_structure` JSON on the Receipt, e.g.:

```json
{
  "service_fee": { "rate": 0.07, "base": "subtotal" },
  "tax": { "rate": 0.10, "base": "subtotal + service_fee" }
}
```

Each member's share of fees is calculated proportionally based on their items' share of the subtotal.

---

## 6. Multi-Currency

- Each receipt stores its original currency
- Group members set a home currency on their profile
- Debts displayed in both original and home currency: "450,000 IDR (≈ $42 AUD)"
- Exchange rates fetched daily from Open Exchange Rates or Frankfurter API, cached in database
- Settlement can happen in any currency — the app shows the converted amount

---

## 7. Monetization & Pricing

### Free Tier (Growth Engine)

- Unlimited groups and members
- 20 receipt scans per month
- Tap-to-claim and payer assignment
- Running debt tracker with "mark as settled"
- Multi-currency display and conversion
- Smart nudge notifications
- 3 months receipt archive

### BillSplit Pro — $4.99/month or $34.99/year

- Unlimited receipt scans
- Smart debt simplification (minimize number of settlement transactions)
- Auto-settle reminder sequences (app chases people for you)
- Trip spending analytics and budget tracking ("$800 of $2,000 budget remaining")
- Export to CSV/PDF (expense reports for business travelers)
- Unlimited receipt archive
- Priority OCR processing

### Transaction Fees (Tier 2)

- 1.5-2.5% on in-app payment settlements
- Users who settle outside the app pay nothing
- Revenue scales naturally with usage

### Monetization Thesis

Every travel group has one organizer — the person uploading receipts, assigning items, chasing payments. That person will pay $35/year to remove the friction. With 10-person groups, the conversion target is 1 in 10 (the organizer). The free tier must be generous enough that the other 9 never feel limited.

---

## 8. MVP Scope & Roadmap

### Tier 1 — MVP

- User auth (email, Google, Apple via Supabase Auth)
- Group creation with invite links
- Link-only members (no account required to join/claim)
- Receipt photo upload with offline queueing
- Hybrid OCR + LLM line-item extraction
- Tax/tip/service fee interpretation and proportional splitting
- Tap-to-claim checkbox UI (1x default)
- Payer assignment view
- Receipt validation step (extracted total shown against receipt image for payer confirmation before group claiming begins)
- Running debt tracker per group with "mark as settled"
- Multi-currency with live conversion rates
- Smart nudge push notifications
- Basic group dashboard

### Tier 2 — Fast Follow

- Trip containers within groups
- Shared item custom split ratios (long-press to adjust)
- Configurable notification preferences
- Auto-settle reminder sequences (Pro)
- Smart debt simplification (Pro)
- Receipt history and search
- Payment provider integration (Venmo, Wise) with transaction fees
- Trip spending analytics (Pro)
- Comment thread per receipt (resolve "who had the extra side?" without leaving the app)

### Tier 3 — Future

- Responsive web app
- Export to CSV/PDF (Pro)
- Budget tracking per trip (Pro)
- Recurring expense splitting (flatmate use case)
- Group spending insights and trends
- Receipt archive management
- Dispute resolution flow (flag an item assignment, notify payer to review)
- Receipt co-ownership (split-payer receipts — two people pay one bill)
- Smart claim suggestions (learn patterns from past behavior, pre-suggest claims)
- Deep link invite flow (app deep-link if installed, web fallback if not)

### Success Metrics for MVP

- Receipt extraction accuracy > 95% across currencies/formats
- Time from photo to claimable items < 10 seconds on WiFi
- Group invite → first claim in under 60 seconds for link-only members
- 40%+ of line items claimed within 1 hour of receipt upload
