import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import type {
  Group,
  GroupMember,
  GroupMemberWithProfile,
  GroupPreview,
  Receipt,
  MemberBalanceSummary,
} from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Create ──────────────────────────────────────────────────

/** Generate a 12-character hex invite code. */
function generateInviteCode(): string {
  const bytes = new Uint8Array(6);
  Crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new group. The current user becomes admin.
 * Returns the newly created group.
 */
export async function createGroup(
  name: string,
  defaultCurrency: string
): Promise<Group> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const inviteCode = generateInviteCode();

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      created_by: user.id,
      invite_code: inviteCode,
      default_currency: defaultCurrency,
    })
    .select()
    .single();

  if (groupError || !group) {
    throw new Error(`Failed to create group: ${groupError?.message}`);
  }

  // Add creator as admin member
  const displayName =
    user.user_metadata?.display_name ?? user.email ?? 'Unknown';

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    display_name: displayName,
    role: 'admin',
  });

  if (memberError) {
    throw new Error(`Failed to add creator as member: ${memberError.message}`);
  }

  return group as Group;
}

// ── Read ────────────────────────────────────────────────────

/**
 * Fetch all groups the current user belongs to, with member count
 * and the user's net balance in each group.
 */
export async function fetchMyGroups(): Promise<GroupPreview[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get group IDs for the current user
  const { data: memberships, error: memError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  if (memError) {
    throw new Error(`Failed to fetch memberships: ${memError.message}`);
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const groupIds = memberships.map((m) => m.group_id);

  // Fetch groups
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('updated_at', { ascending: false });

  if (groupsError) {
    throw new Error(`Failed to fetch groups: ${groupsError.message}`);
  }

  // Fetch member counts for each group
  const previews: GroupPreview[] = await Promise.all(
    (groups ?? []).map(async (group) => {
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);

      const myBalance = await calculateMyBalance(group.id, user.id);

      return {
        ...(group as Group),
        member_count: count ?? 0,
        my_balance: myBalance,
      };
    })
  );

  return previews;
}

/**
 * Calculate the net balance for a user in a group.
 * Positive = owed to them, negative = they owe.
 * Returns amount in the group's default currency smallest unit.
 */
async function calculateMyBalance(
  groupId: string,
  userId: string
): Promise<number> {
  // Find the user's member ID in this group
  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!member) return 0;

  // Debts where I owe someone (negative)
  const { data: owedByMe } = await supabase
    .from('debts')
    .select('amount')
    .eq('group_id', groupId)
    .eq('from_member', member.id)
    .eq('settled', false);

  // Debts where someone owes me (positive)
  const { data: owedToMe } = await supabase
    .from('debts')
    .select('amount')
    .eq('group_id', groupId)
    .eq('to_member', member.id)
    .eq('settled', false);

  const totalOwedByMe = (owedByMe ?? []).reduce(
    (sum, d) => sum + (d.amount as number),
    0
  );
  const totalOwedToMe = (owedToMe ?? []).reduce(
    (sum, d) => sum + (d.amount as number),
    0
  );

  return totalOwedToMe - totalOwedByMe;
}

/** Fetch a single group by ID. */
export async function fetchGroup(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch group: ${error?.message}`);
  }

  return data as Group;
}

/** Fetch a group by its invite code. */
export async function fetchGroupByInviteCode(
  inviteCode: string
): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', inviteCode)
    .single();

  if (error) return null;
  return data as Group;
}

// ── Members ─────────────────────────────────────────────────

/** Fetch all members of a group, with profile data when available. */
export async function fetchGroupMembers(
  groupId: string
): Promise<GroupMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, profile:profiles(*)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...row,
    profile: row.profile ?? null,
  })) as GroupMemberWithProfile[];
}

/** Get the current user's member record in a group. */
export async function fetchMyMembership(
  groupId: string
): Promise<GroupMember | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  return (data as GroupMember) ?? null;
}

// ── Join ────────────────────────────────────────────────────

/**
 * Join a group as an authenticated user.
 * Returns the member record.
 */
export async function joinGroup(groupId: string): Promise<GroupMember> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const displayName =
    user.user_metadata?.display_name ?? user.email ?? 'Unknown';

  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: user.id,
      display_name: displayName,
      role: 'member',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to join group: ${error.message}`);
  }

  return data as GroupMember;
}

/**
 * Join a group as a link-only member (no account).
 * Returns the member record.
 */
export async function joinGroupAnonymous(
  groupId: string,
  displayName: string
): Promise<GroupMember> {
  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: null,
      display_name: displayName,
      role: 'member',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to join group: ${error.message}`);
  }

  return data as GroupMember;
}

// ── Receipts for a group ────────────────────────────────────

/** Fetch receipts for a group, most recent first. */
export async function fetchGroupReceipts(
  groupId: string
): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch receipts: ${error.message}`);
  }

  return (data ?? []) as Receipt[];
}

// ── Balances ────────────────────────────────────────────────

/** Fetch balance summaries for all members in a group. */
export async function fetchGroupBalances(
  groupId: string
): Promise<MemberBalanceSummary[]> {
  const members = await fetchGroupMembers(groupId);
  const group = await fetchGroup(groupId);

  const balances: MemberBalanceSummary[] = await Promise.all(
    members.map(async (member) => {
      const { data: owedByThem } = await supabase
        .from('debts')
        .select('amount')
        .eq('group_id', groupId)
        .eq('from_member', member.id)
        .eq('settled', false);

      const { data: owedToThem } = await supabase
        .from('debts')
        .select('amount')
        .eq('group_id', groupId)
        .eq('to_member', member.id)
        .eq('settled', false);

      const totalOwed = (owedByThem ?? []).reduce(
        (sum, d) => sum + (d.amount as number),
        0
      );
      const totalOwedTo = (owedToThem ?? []).reduce(
        (sum, d) => sum + (d.amount as number),
        0
      );

      return {
        member_id: member.id,
        display_name: member.display_name,
        net_amount: totalOwedTo - totalOwed,
        currency: group.default_currency,
      };
    })
  );

  return balances;
}

// ── Invite link ─────────────────────────────────────────────

/** Build a shareable invite deep link for a group. */
export function buildInviteLink(inviteCode: string): string {
  return `billsplit://join/${inviteCode}`;
}

// ── Realtime ────────────────────────────────────────────────

/**
 * Subscribe to group member changes (joins, leaves, updates).
 * Returns the channel so the caller can unsubscribe.
 */
export function subscribeToGroupMembers(
  groupId: string,
  onMemberChange: () => void
): RealtimeChannel {
  const channel = supabase
    .channel(`group-members-${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${groupId}`,
      },
      () => {
        onMemberChange();
      }
    )
    .subscribe();

  return channel;
}
