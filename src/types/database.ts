/**
 * TypeScript types matching the BillSplit database schema.
 *
 * These types mirror the tables defined in supabase/migrations/00001_initial_schema.sql.
 * Currency amounts are stored as integers in the smallest unit (cents/sen)
 * to avoid floating-point precision issues.
 */

// ── Enums ───────────────────────────────────────────────────

export type GroupMemberRole = 'admin' | 'member';

export type TripStatus = 'active' | 'settled';

export type ReceiptProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type LineItemCategory = 'food' | 'drink' | 'other';

// ── Tax structure ───────────────────────────────────────────

export interface TaxFeeEntry {
  /** The rate as a decimal (e.g. 0.07 for 7%) */
  rate: number;
  /** What this fee is calculated on (e.g. "subtotal", "subtotal + service_fee") */
  base: string;
}

export interface TaxStructure {
  service_fee?: TaxFeeEntry;
  tax?: TaxFeeEntry;
  [key: string]: TaxFeeEntry | undefined;
}

// ── Core Entities ───────────────────────────────────────────

/** Mirrors public.profiles — extends Supabase auth.users with app-specific fields */
export interface Profile {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  home_currency: string;
  push_token: string | null;
  is_pro: boolean;
  scans_this_month: number;
  scans_reset_at: string;
  created_at: string;
  updated_at: string;
}

/** Mirrors public.groups */
export interface Group {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

/** Mirrors public.group_members */
export interface GroupMember {
  id: string;
  group_id: string;
  /** Null for link-only members who haven't signed up */
  user_id: string | null;
  display_name: string;
  role: GroupMemberRole;
  joined_at: string;
}

/** Mirrors public.trips */
export interface Trip {
  id: string;
  group_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  created_at: string;
}

/** Mirrors public.receipts */
export interface Receipt {
  id: string;
  group_id: string;
  trip_id: string | null;
  /** References group_members.id */
  paid_by: string;
  currency: string;
  /** Amount in smallest currency unit (cents) */
  subtotal: number;
  /** Amount in smallest currency unit (cents) */
  tax: number;
  /** Amount in smallest currency unit (cents) */
  tip: number;
  /** Amount in smallest currency unit (cents) */
  service_fee: number;
  /** Amount in smallest currency unit (cents) */
  total: number;
  tax_structure: TaxStructure | null;
  vendor_name: string | null;
  image_url: string | null;
  ocr_raw: Record<string, unknown> | null;
  processing_status: ReceiptProcessingStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors public.line_items */
export interface LineItem {
  id: string;
  receipt_id: string;
  description: string;
  quantity: number;
  /** Amount in smallest currency unit (cents) */
  unit_price: number;
  /** Amount in smallest currency unit (cents) */
  total_price: number;
  category: LineItemCategory;
  sort_order: number;
  created_at: string;
}

/** Mirrors public.line_item_claims */
export interface LineItemClaim {
  id: string;
  line_item_id: string;
  group_member_id: string;
  /** Portion of the item claimed (1.0 = full item, 0.5 = half) */
  portion: number;
  claimed_at: string;
}

/** Mirrors public.debts */
export interface Debt {
  id: string;
  group_id: string;
  trip_id: string | null;
  /** References group_members.id — the member who owes */
  from_member: string;
  /** References group_members.id — the member who is owed */
  to_member: string;
  /** Amount in smallest currency unit (cents) */
  amount: number;
  currency: string;
  receipt_id: string | null;
  settled: boolean;
  settled_at: string | null;
  created_at: string;
}

/** Mirrors public.exchange_rates */
export interface ExchangeRate {
  id: string;
  base_currency: string;
  rates: Record<string, number>;
  fetched_at: string;
}

// ── Joined / View Types ─────────────────────────────────────

/** A line item with its claims for display in the claiming UI */
export interface LineItemWithClaims extends LineItem {
  claims: LineItemClaim[];
}

/** A receipt with its line items for the receipt detail screen */
export interface ReceiptWithItems extends Receipt {
  line_items: LineItemWithClaims[];
}

/** A group member enriched with profile data (when the member has an account) */
export interface GroupMemberWithProfile extends GroupMember {
  profile: Profile | null;
}

/** A debt enriched with member display names */
export interface DebtWithMembers extends Debt {
  from_member_name: string;
  to_member_name: string;
}

/** Summary of what a member owes / is owed in a group */
export interface MemberBalanceSummary {
  member_id: string;
  display_name: string;
  /** Net amount: positive = owed to them, negative = they owe */
  net_amount: number;
  currency: string;
}

/** Group with member count and user's balance for the group list */
export interface GroupPreview extends Group {
  member_count: number;
  my_balance: number;
}
