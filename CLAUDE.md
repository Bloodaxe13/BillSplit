# BillSplit

Travel group expense splitting app — snap receipts, claim items, settle up.

## Project Overview

- **Repo:** https://github.com/Bloodaxe13/BillSplit
- **Design doc:** `docs/plans/2026-02-20-billsplit-design.md`
- **Owner:** daniel.king380@me.com

## Tech Stack

- **Mobile:** Expo (React Native) — iOS and Android from single codebase
- **Backend:** Self-hosted Supabase stack on Railway
  - PostgreSQL (Railway-managed)
  - Supabase Auth (email, Google, Apple sign-in)
  - Supabase Realtime (live claim updates)
  - Supabase Storage (receipt images)
  - PostgREST (auto-generated REST API)
  - Edge Functions (receipt processing pipeline)
- **Receipt processing:** Google Document AI (OCR) → OpenAI GPT-5.2 (structuring)
- **Currency:** Open Exchange Rates API (daily cached rates)
- **Hosting:** Railway (all services)
- **Railway project:** `determined-courage` (ID: `1d5323eb-c1e6-441e-99a6-bd7fbd49313c`)

## Architecture Decisions

- Hybrid OCR + LLM for receipt scanning (not pure vision — better line-item accuracy)
- Supabase RLS for authorization (row-level security, not application-level)
- Offline capture with sync-later pattern (photos queue locally, process on WiFi)
- Link-only members (no account required to join a group and claim items)

## Environment Variables (Railway)

These must be set as Railway service variables, never committed to code:

Set on Railway `api` service (production environment). **Never commit these to code.**

- `GOOGLE_CLOUD_API_KEY` — Google Document AI (set)
- `OPENAI_API_KEY` — OpenAI GPT-5.2 for receipt structuring (set)
- `OPEN_EXCHANGE_RATES_APP_ID` — currency conversion (set)
- `SUPABASE_JWT_SECRET` — to be generated during Supabase deploy
- `SUPABASE_ANON_KEY` — to be generated during Supabase deploy
- `SUPABASE_SERVICE_ROLE_KEY` — to be generated during Supabase deploy

## UI/Frontend

- Use the `frontend-design` skill for all UI work — distinctive, production-grade interfaces
- Avoid generic AI aesthetics — aim for polished, creative design
- Follow Expo/React Native best practices for component structure

## Code Conventions

- Use TypeScript throughout (Expo app and Edge Functions)
- Prefer Supabase client SDK over raw PostgREST calls in the app
- All database access goes through RLS — no service role key in client code
- Receipt processing is async (upload → queue → process → notify)
- Currency amounts stored as integers in smallest unit (cents/sen) to avoid floating point

## Key Flows

1. **Receipt processing:** Photo → Supabase Storage → Edge Function → Document AI OCR → GPT-5.2 structuring → DB write → Realtime push
2. **Claiming:** Push notification → open receipt → tap checkboxes → debts auto-calculated
3. **Settlement:** View debts → mark as settled (or future: in-app payment)

## Monetization

- Free tier: unlimited groups/members, 20 scans/month, full splitting features
- BillSplit Pro ($4.99/mo or $34.99/yr): unlimited scans, debt simplification, analytics, export, auto-reminders
- Transaction fees (1.5-2.5%) on future in-app payments

## MVP Scope

See Tier 1 in the design doc. Key items:
- Auth, groups, invite links, link-only members
- Receipt upload + hybrid OCR/LLM extraction
- Receipt validation step (payer confirms total before claiming opens)
- Tap-to-claim UI, payer assignment view
- Debt tracker, multi-currency, push notifications
