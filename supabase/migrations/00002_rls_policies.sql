-- =============================================================================
-- BillSplit: Row-Level Security Policies
-- Migration: 00002_rls_policies.sql
--
-- Enables RLS on every public table and defines fine-grained access policies.
-- Helper functions are created first so policies can reference them.
-- =============================================================================


-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- is_group_member(group_id) — returns TRUE if the current user belongs to the group
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_group_member IS 'Check whether the authenticated user is a member of the given group';

-- ---------------------------------------------------------------------------
-- is_group_admin(group_id) — returns TRUE if the current user is an admin of the group
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_group_admin IS 'Check whether the authenticated user is an admin of the given group';

-- ---------------------------------------------------------------------------
-- get_member_groups() — returns all group IDs the current user belongs to
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_member_groups()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id
  FROM public.group_members
  WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_member_groups IS 'Return the set of group IDs that the authenticated user is a member of';


-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_item_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates   ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- PROFILES
-- Users can read any profile (for displaying names/avatars in shared groups).
-- Users can only update their own profile.
-- =============================================================================

CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- =============================================================================
-- GROUPS
-- Members can read groups they belong to.
-- Any authenticated user can create a group (they become admin via app logic).
-- Only the group creator can update the group.
-- =============================================================================

CREATE POLICY "groups_select_members"
  ON public.groups FOR SELECT
  TO authenticated
  USING (is_group_member(id));

CREATE POLICY "groups_insert_authenticated"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "groups_update_creator"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());


-- =============================================================================
-- GROUP MEMBERS
-- Members can read all members of groups they belong to.
-- Admins can insert new members into their groups.
-- Admins can delete members from their groups (or a member can remove themselves).
-- =============================================================================

CREATE POLICY "group_members_select"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (is_group_member(group_id));

CREATE POLICY "group_members_insert_admin"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (is_group_admin(group_id));

CREATE POLICY "group_members_delete_admin_or_self"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    is_group_admin(group_id)
    OR user_id = auth.uid()
  );


-- =============================================================================
-- TRIPS
-- Members of the group can perform full CRUD on trips.
-- =============================================================================

CREATE POLICY "trips_select_members"
  ON public.trips FOR SELECT
  TO authenticated
  USING (is_group_member(group_id));

CREATE POLICY "trips_insert_members"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member(group_id));

CREATE POLICY "trips_update_members"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (is_group_member(group_id))
  WITH CHECK (is_group_member(group_id));

CREATE POLICY "trips_delete_members"
  ON public.trips FOR DELETE
  TO authenticated
  USING (is_group_member(group_id));


-- =============================================================================
-- RECEIPTS
-- Members of the group can read all receipts.
-- Any group member can insert a receipt.
-- Only the payer (paid_by member linked to auth user) can update.
-- =============================================================================

CREATE POLICY "receipts_select_members"
  ON public.receipts FOR SELECT
  TO authenticated
  USING (is_group_member(group_id));

CREATE POLICY "receipts_insert_members"
  ON public.receipts FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member(group_id));

CREATE POLICY "receipts_update_payer"
  ON public.receipts FOR UPDATE
  TO authenticated
  USING (
    -- The payer's group_members row must be linked to the authenticated user
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.id = paid_by
        AND gm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.id = paid_by
        AND gm.user_id = auth.uid()
    )
  );


-- =============================================================================
-- LINE ITEMS
-- Members of the group can read line items.
-- The receipt payer can insert, update, and delete line items.
-- =============================================================================

CREATE POLICY "line_items_select_members"
  ON public.line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.receipts r
      WHERE r.id = receipt_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "line_items_insert_payer"
  ON public.line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.receipts r
      JOIN public.group_members gm ON gm.id = r.paid_by
      WHERE r.id = receipt_id
        AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "line_items_update_payer"
  ON public.line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.receipts r
      JOIN public.group_members gm ON gm.id = r.paid_by
      WHERE r.id = receipt_id
        AND gm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.receipts r
      JOIN public.group_members gm ON gm.id = r.paid_by
      WHERE r.id = receipt_id
        AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "line_items_delete_payer"
  ON public.line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.receipts r
      JOIN public.group_members gm ON gm.id = r.paid_by
      WHERE r.id = receipt_id
        AND gm.user_id = auth.uid()
    )
  );


-- =============================================================================
-- LINE ITEM CLAIMS
-- Members can read all claims within their groups.
-- Members can insert claims for themselves (their own group_member_id).
-- Members can delete their own claims.
-- =============================================================================

CREATE POLICY "line_item_claims_select_members"
  ON public.line_item_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.line_items li
      JOIN public.receipts r ON r.id = li.receipt_id
      WHERE li.id = line_item_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "line_item_claims_insert_own"
  ON public.line_item_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    -- The group_member_id must belong to the authenticated user
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.id = group_member_id
        AND gm.user_id = auth.uid()
    )
    -- And the line item must be in one of the user's groups
    AND EXISTS (
      SELECT 1
      FROM public.line_items li
      JOIN public.receipts r ON r.id = li.receipt_id
      WHERE li.id = line_item_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "line_item_claims_delete_own"
  ON public.line_item_claims FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.id = group_member_id
        AND gm.user_id = auth.uid()
    )
  );


-- =============================================================================
-- DEBTS
-- Members can read all debts within their groups.
-- Debts are system-computed, so no direct insert/update/delete by users.
-- =============================================================================

CREATE POLICY "debts_select_members"
  ON public.debts FOR SELECT
  TO authenticated
  USING (is_group_member(group_id));


-- =============================================================================
-- EXCHANGE RATES
-- Any authenticated user can read exchange rates (global reference data).
-- Rates are inserted by backend/cron, so no user-facing insert policy.
-- =============================================================================

CREATE POLICY "exchange_rates_select_authenticated"
  ON public.exchange_rates FOR SELECT
  TO authenticated
  USING (true);
