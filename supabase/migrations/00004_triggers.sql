-- =============================================================================
-- BillSplit: Triggers
-- Migration: 00004_triggers.sql
--
-- Wires up trigger functions to table events for automatic side effects.
-- =============================================================================


-- =============================================================================
-- 1. AUTO-CREATE PROFILE ON SIGN-UP
--    When a new row is inserted into auth.users, automatically create a
--    corresponding public.profiles row via handle_new_user().
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Note: COMMENT ON TRIGGER omitted because we don't own auth.users


-- =============================================================================
-- 2. AUTO-CALCULATE DEBTS WHEN RECEIPT IS COMPLETED
--    When a receipt's processing_status transitions to 'completed',
--    automatically compute debts from the line-item claims.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_calculate_debts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when processing_status has just changed to 'completed'
  IF NEW.processing_status = 'completed'
     AND (OLD.processing_status IS DISTINCT FROM 'completed')
  THEN
    PERFORM public.calculate_debts(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_calculate_debts IS
  'Wrapper trigger function that calls calculate_debts() when a receipt is marked completed';

CREATE TRIGGER on_receipt_completed
  AFTER UPDATE OF processing_status ON public.receipts
  FOR EACH ROW
  WHEN (NEW.processing_status = 'completed')
  EXECUTE FUNCTION public.trigger_calculate_debts();

COMMENT ON TRIGGER on_receipt_completed ON public.receipts IS
  'Compute debts automatically when receipt processing finishes';


-- =============================================================================
-- 3. AUTO-UPDATE updated_at TIMESTAMP
--    Generic trigger function that sets updated_at = NOW() on any UPDATE.
--    Applied to profiles, groups, and receipts.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at IS
  'Generic trigger function: sets updated_at to current timestamp on row update';

-- profiles.updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- groups.updated_at
CREATE TRIGGER set_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- receipts.updated_at
CREATE TRIGGER set_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
