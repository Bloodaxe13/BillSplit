-- =============================================================================
-- BillSplit: Initial Schema
-- Migration: 00001_initial_schema.sql
--
-- Creates all core tables for the BillSplit travel expense splitting app.
-- All monetary amounts are stored as integers in the smallest currency unit
-- (e.g., cents for USD) to avoid floating-point precision issues.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES — extends Supabase auth.users with app-specific fields
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  home_currency TEXT NOT NULL DEFAULT 'USD',
  is_pro        BOOLEAN NOT NULL DEFAULT FALSE,
  scans_this_month INTEGER NOT NULL DEFAULT 0,
  scans_reset_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON COLUMN public.profiles.home_currency IS 'ISO 4217 currency code for the user''s preferred display currency';
COMMENT ON COLUMN public.profiles.is_pro IS 'Whether the user has an active pro subscription';
COMMENT ON COLUMN public.profiles.scans_this_month IS 'Number of receipt OCR scans used in the current billing period';

-- ---------------------------------------------------------------------------
-- 2. GROUPS — a container for people who split expenses together
-- ---------------------------------------------------------------------------
CREATE TABLE public.groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  created_by       UUID NOT NULL REFERENCES public.profiles(id),
  invite_code      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  default_currency TEXT NOT NULL DEFAULT 'USD',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.groups IS 'Expense-splitting groups (e.g., a household, friend circle, or trip crew)';
COMMENT ON COLUMN public.groups.invite_code IS '12-char hex code used to invite others via shareable link';

-- ---------------------------------------------------------------------------
-- 3. GROUP MEMBERS — links users (or link-only placeholders) to groups
-- ---------------------------------------------------------------------------
CREATE TABLE public.group_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)  -- one membership per user per group
);

COMMENT ON TABLE public.group_members IS 'Membership junction table; user_id is nullable to support link-only (non-app) members';

-- ---------------------------------------------------------------------------
-- 4. TRIPS — optional time-bounded containers within a group
-- ---------------------------------------------------------------------------
CREATE TABLE public.trips (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_date DATE,
  end_date   DATE,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.trips IS 'Optional trip containers within a group for organizing expenses by journey';

-- ---------------------------------------------------------------------------
-- 5. RECEIPTS — a bill/receipt that was paid by one group member
-- ---------------------------------------------------------------------------
CREATE TABLE public.receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  trip_id           UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  paid_by           UUID NOT NULL REFERENCES public.group_members(id),
  currency          TEXT NOT NULL,
  subtotal          INTEGER NOT NULL DEFAULT 0,
  tax               INTEGER NOT NULL DEFAULT 0,
  tip               INTEGER NOT NULL DEFAULT 0,
  service_fee       INTEGER NOT NULL DEFAULT 0,
  total             INTEGER NOT NULL DEFAULT 0,
  tax_structure     JSONB DEFAULT '{}',
  image_url         TEXT,
  ocr_raw           JSONB,
  processing_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.receipts IS 'A receipt/bill paid by a single group member, potentially OCR-scanned';
COMMENT ON COLUMN public.receipts.subtotal IS 'Sum of line item totals, in smallest currency unit (e.g., cents)';
COMMENT ON COLUMN public.receipts.tax_structure IS 'JSON describing cascading or inclusive tax rules for accurate splitting';
COMMENT ON COLUMN public.receipts.processing_status IS 'OCR pipeline status: pending -> processing -> completed | failed';

-- ---------------------------------------------------------------------------
-- 6. LINE ITEMS — individual items on a receipt
-- ---------------------------------------------------------------------------
CREATE TABLE public.line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id  UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  category    TEXT DEFAULT 'other' CHECK (category IN ('food', 'drink', 'other')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.line_items IS 'Individual items on a receipt, priced in smallest currency unit';

-- ---------------------------------------------------------------------------
-- 7. LINE ITEM CLAIMS — who is claiming (sharing) each line item
-- ---------------------------------------------------------------------------
CREATE TABLE public.line_item_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id    UUID NOT NULL REFERENCES public.line_items(id) ON DELETE CASCADE,
  group_member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  portion         DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(line_item_id, group_member_id)
);

COMMENT ON TABLE public.line_item_claims IS 'Claims linking group members to line items they share';
COMMENT ON COLUMN public.line_item_claims.portion IS 'Fraction of the item this member is responsible for (1.0 = full item, 0.5 = half, etc.)';

-- ---------------------------------------------------------------------------
-- 8. DEBTS — computed owed amounts between group members
-- ---------------------------------------------------------------------------
CREATE TABLE public.debts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  trip_id     UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  from_member UUID NOT NULL REFERENCES public.group_members(id),
  to_member   UUID NOT NULL REFERENCES public.group_members(id),
  amount      INTEGER NOT NULL,
  currency    TEXT NOT NULL,
  receipt_id  UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
  settled     BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.debts IS 'Computed debts between members; from_member owes to_member';
COMMENT ON COLUMN public.debts.amount IS 'Amount owed in smallest currency unit';

-- ---------------------------------------------------------------------------
-- 9. EXCHANGE RATES — cached daily currency conversion rates
-- ---------------------------------------------------------------------------
CREATE TABLE public.exchange_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  rates         JSONB NOT NULL,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(base_currency, (fetched_at::date))
);

COMMENT ON TABLE public.exchange_rates IS 'Daily cached exchange rates from an external provider';


-- =============================================================================
-- INDEXES
-- =============================================================================

-- Group members: look up members of a group, or all groups for a user
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_id  ON public.group_members(user_id);

-- Receipts: filter by group or trip
CREATE INDEX idx_receipts_group_id ON public.receipts(group_id);
CREATE INDEX idx_receipts_trip_id  ON public.receipts(trip_id);

-- Line items: look up items on a receipt
CREATE INDEX idx_line_items_receipt_id ON public.line_items(receipt_id);

-- Claims: look up claims per line item, or all claims for a member
CREATE INDEX idx_line_item_claims_line_item_id    ON public.line_item_claims(line_item_id);
CREATE INDEX idx_line_item_claims_group_member_id ON public.line_item_claims(group_member_id);

-- Debts: find unsettled debts in a group; look up debts by member
CREATE INDEX idx_debts_group_settled ON public.debts(group_id, settled);
CREATE INDEX idx_debts_from_member   ON public.debts(from_member);
CREATE INDEX idx_debts_to_member     ON public.debts(to_member);

-- Exchange rates: look up latest rate for a base currency
CREATE INDEX idx_exchange_rates_base_fetched ON public.exchange_rates(base_currency, fetched_at);
