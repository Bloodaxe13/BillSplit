-- =============================================================================
-- BillSplit: Fix group_members RLS policies
-- Migration: 00006_fix_group_members_rls.sql
--
-- The original group_members_insert_admin policy only allows admins to insert
-- new members. This creates a chicken-and-egg problem: when creating a group,
-- the creator cannot add themselves as the first member because they are not
-- yet an admin (no member row exists).
--
-- Fix: Allow users to insert themselves (user_id = auth.uid()) into a group
-- if they are the group creator OR if they are already an admin.
-- Also allow self-insert for joining via invite code.
-- =============================================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "group_members_insert_admin" ON public.group_members;

-- Allow a user to insert a member row if:
--   1. They are the group creator (inserting themselves as first admin), OR
--   2. They are already a group admin (inviting others), OR
--   3. They are inserting themselves (self-join via invite link)
CREATE POLICY "group_members_insert"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Group creator can add themselves as first member
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND g.created_by = auth.uid()
    )
    -- Existing admin can add others
    OR is_group_admin(group_id)
    -- Any authenticated user can join themselves (for invite links)
    OR user_id = auth.uid()
  );
