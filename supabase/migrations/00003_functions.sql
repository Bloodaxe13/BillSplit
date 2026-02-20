-- =============================================================================
-- BillSplit: Database Functions
-- Migration: 00003_functions.sql
--
-- Core business-logic functions that run inside the database for performance
-- and transactional safety.
-- =============================================================================


-- =============================================================================
-- 1. handle_new_user()
--    Trigger function: creates a profile row when a new auth.users row appears.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    -- Use the portion before '@' as a fallback display name
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  'Trigger function: auto-creates a public.profiles row for every new auth.users sign-up';


-- =============================================================================
-- 2. calculate_debts(receipt_id)
--    Computes who owes whom for a single receipt based on line-item claims.
--
--    Algorithm:
--      1. For each line item, compute each claimant's share of that item
--         (item total_price * claimant portion / sum of all portions).
--      2. Proportionally distribute tax, tip, and service_fee across all
--         claimants based on their share of the subtotal.
--      3. For each claimant who is NOT the payer, create a debt record
--         from the claimant to the payer.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_debts(_receipt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _receipt   RECORD;
  _claim     RECORD;
  _extras    INTEGER;     -- tax + tip + service_fee
  _subtotal  INTEGER;     -- receipt subtotal (sum of line items)
  _member_share INTEGER;  -- a single member's computed share
BEGIN
  -- Fetch the receipt
  SELECT *
    INTO _receipt
    FROM public.receipts
   WHERE id = _receipt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt % not found', _receipt_id;
  END IF;

  -- Delete any previously computed debts for this receipt
  DELETE FROM public.debts WHERE receipt_id = _receipt_id;

  -- Total extras to distribute proportionally
  _extras := _receipt.tax + _receipt.tip + _receipt.service_fee;

  -- Use the receipt's stored subtotal; fall back to summing line items
  SELECT COALESCE(NULLIF(_receipt.subtotal, 0), SUM(li.total_price), 0)
    INTO _subtotal
    FROM public.line_items li
   WHERE li.receipt_id = _receipt_id;

  -- Guard against division by zero
  IF _subtotal = 0 THEN
    RETURN;
  END IF;

  -- Compute each member's total share across all line items, then add
  -- their proportional share of extras.
  --
  -- The query:
  --   - Joins claims to line items
  --   - Computes each claimant's fraction of each item (portion / sum of portions)
  --   - Sums up the item-level shares per member
  --   - Adds a proportional share of extras based on that sum vs. subtotal

  FOR _claim IN
    WITH item_shares AS (
      SELECT
        lic.group_member_id,
        li.id AS line_item_id,
        li.total_price,
        lic.portion,
        -- Sum of all portions for this line item (for splitting)
        SUM(lic.portion) OVER (PARTITION BY li.id) AS total_portions
      FROM public.line_items li
      JOIN public.line_item_claims lic ON lic.line_item_id = li.id
      WHERE li.receipt_id = _receipt_id
    ),
    member_subtotals AS (
      SELECT
        group_member_id,
        -- Each member's share of the line items (rounded down; remainder handled later)
        SUM(
          ROUND(total_price * (portion / NULLIF(total_portions, 0)))
        )::INTEGER AS items_share
      FROM item_shares
      GROUP BY group_member_id
    )
    SELECT
      group_member_id,
      -- items_share + proportional extras
      (items_share + ROUND(_extras * (items_share::NUMERIC / NULLIF(_subtotal, 0))))::INTEGER
        AS total_share
    FROM member_subtotals
  LOOP
    -- Only create a debt if this member is NOT the payer
    IF _claim.group_member_id <> _receipt.paid_by THEN
      INSERT INTO public.debts (
        group_id,
        trip_id,
        from_member,
        to_member,
        amount,
        currency,
        receipt_id
      ) VALUES (
        _receipt.group_id,
        _receipt.trip_id,
        _claim.group_member_id,  -- owes money
        _receipt.paid_by,        -- is owed money
        _claim.total_share,
        _receipt.currency,
        _receipt_id
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.calculate_debts IS
  'Compute per-member debts for a receipt based on line-item claims, distributing tax/tip/service proportionally';


-- =============================================================================
-- 3. simplify_debts(group_id)
--    Debt simplification algorithm: minimizes the number of transactions
--    needed to settle all unsettled debts in a group.
--
--    Algorithm (net-balance approach):
--      1. Compute the net balance for each member across all unsettled debts
--         (positive = net creditor, negative = net debtor).
--      2. Mark all existing unsettled debts as settled.
--      3. Iteratively pair the largest debtor with the largest creditor,
--         creating a single simplified debt for the minimum of their
--         absolute balances. Repeat until all balances are zeroed out.
--
--    NOTE: This operates per-currency. Mixed-currency groups will have
--    independent simplification per currency.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.simplify_debts(_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _currency     TEXT;
  _debtor       RECORD;
  _creditor     RECORD;
  _transfer_amt INTEGER;
BEGIN
  -- Process each currency independently
  FOR _currency IN
    SELECT DISTINCT currency
      FROM public.debts
     WHERE group_id = _group_id
       AND settled = FALSE
  LOOP
    -- Create a temporary table of net balances for this currency.
    -- Positive balance = net creditor; negative = net debtor.
    CREATE TEMP TABLE IF NOT EXISTS _balances (
      member_id UUID PRIMARY KEY,
      balance   INTEGER NOT NULL
    ) ON COMMIT DROP;

    TRUNCATE _balances;

    -- Aggregate: for each member, sum amounts owed TO them minus amounts they OWE
    INSERT INTO _balances (member_id, balance)
    SELECT
      m.member_id,
      COALESCE(credits.total, 0) - COALESCE(debits.total, 0) AS balance
    FROM (
      -- All members involved in unsettled debts for this currency
      SELECT from_member AS member_id FROM public.debts
       WHERE group_id = _group_id AND settled = FALSE AND currency = _currency
      UNION
      SELECT to_member FROM public.debts
       WHERE group_id = _group_id AND settled = FALSE AND currency = _currency
    ) m
    LEFT JOIN (
      SELECT to_member AS member_id, SUM(amount) AS total
        FROM public.debts
       WHERE group_id = _group_id AND settled = FALSE AND currency = _currency
       GROUP BY to_member
    ) credits ON credits.member_id = m.member_id
    LEFT JOIN (
      SELECT from_member AS member_id, SUM(amount) AS total
        FROM public.debts
       WHERE group_id = _group_id AND settled = FALSE AND currency = _currency
       GROUP BY from_member
    ) debits ON debits.member_id = m.member_id;

    -- Mark all current unsettled debts in this currency as settled
    UPDATE public.debts
       SET settled = TRUE,
           settled_at = NOW()
     WHERE group_id = _group_id
       AND settled = FALSE
       AND currency = _currency;

    -- Iteratively match largest debtor with largest creditor
    LOOP
      -- Find the member with the most negative balance (largest debtor)
      SELECT member_id, balance
        INTO _debtor
        FROM _balances
       WHERE balance < 0
       ORDER BY balance ASC
       LIMIT 1;

      -- If no debtors remain, we're done for this currency
      EXIT WHEN NOT FOUND;

      -- Find the member with the most positive balance (largest creditor)
      SELECT member_id, balance
        INTO _creditor
        FROM _balances
       WHERE balance > 0
       ORDER BY balance DESC
       LIMIT 1;

      EXIT WHEN NOT FOUND;

      -- Transfer the smaller of the two absolute balances
      _transfer_amt := LEAST(ABS(_debtor.balance), _creditor.balance);

      -- Create a simplified debt
      INSERT INTO public.debts (
        group_id, from_member, to_member, amount, currency
      ) VALUES (
        _group_id, _debtor.member_id, _creditor.member_id, _transfer_amt, _currency
      );

      -- Update balances
      UPDATE _balances SET balance = balance + _transfer_amt WHERE member_id = _debtor.member_id;
      UPDATE _balances SET balance = balance - _transfer_amt WHERE member_id = _creditor.member_id;

      -- Remove zeroed-out members
      DELETE FROM _balances WHERE balance = 0;
    END LOOP;

  END LOOP;  -- next currency
END;
$$;

COMMENT ON FUNCTION public.simplify_debts IS
  'Minimize the number of transactions needed to settle all unsettled debts in a group, per currency';
