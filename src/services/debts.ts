import { supabase } from '../lib/supabase';
import type { Debt, DebtWithMembers, MemberBalanceSummary } from '../types/database';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Fetch debts for the current user across all groups
// ---------------------------------------------------------------------------

/**
 * Fetch all unsettled debts involving the current user's group memberships.
 * Returns debts enriched with member display names.
 */
export async function fetchMyDebts(userId: string): Promise<DebtWithMembers[]> {
  // First get all group_member IDs for this user
  const { data: memberships, error: memError } = await supabase
    .from('group_members')
    .select('id')
    .eq('user_id', userId);

  if (memError) throw memError;
  if (!memberships || memberships.length === 0) return [];

  const memberIds = memberships.map((m) => m.id);

  // Fetch unsettled debts where user is from_member or to_member
  const { data: debts, error: debtError } = await supabase
    .from('debts')
    .select(`
      *,
      from:group_members!debts_from_member_fkey(display_name),
      to:group_members!debts_to_member_fkey(display_name),
      group:groups!debts_group_id_fkey(name)
    `)
    .eq('settled', false)
    .or(`from_member.in.(${memberIds.join(',')}),to_member.in.(${memberIds.join(',')})`)
    .order('created_at', { ascending: false });

  if (debtError) throw debtError;
  if (!debts) return [];

  return debts.map((d: any) => ({
    id: d.id,
    group_id: d.group_id,
    trip_id: d.trip_id,
    from_member: d.from_member,
    to_member: d.to_member,
    amount: d.amount,
    currency: d.currency,
    receipt_id: d.receipt_id,
    settled: d.settled,
    settled_at: d.settled_at,
    created_at: d.created_at,
    from_member_name: d.from?.display_name ?? 'Unknown',
    to_member_name: d.to?.display_name ?? 'Unknown',
    _group_name: d.group?.name ?? 'Unknown',
  }));
}

// ---------------------------------------------------------------------------
// Fetch debts for a specific group
// ---------------------------------------------------------------------------

/**
 * Fetch all unsettled debts for a given group, enriched with member names.
 */
export async function fetchGroupDebts(groupId: string): Promise<DebtWithMembers[]> {
  const { data, error } = await supabase
    .from('debts')
    .select(`
      *,
      from:group_members!debts_from_member_fkey(display_name),
      to:group_members!debts_to_member_fkey(display_name)
    `)
    .eq('group_id', groupId)
    .eq('settled', false)
    .order('amount', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((d: any) => ({
    id: d.id,
    group_id: d.group_id,
    trip_id: d.trip_id,
    from_member: d.from_member,
    to_member: d.to_member,
    amount: d.amount,
    currency: d.currency,
    receipt_id: d.receipt_id,
    settled: d.settled,
    settled_at: d.settled_at,
    created_at: d.created_at,
    from_member_name: d.from?.display_name ?? 'Unknown',
    to_member_name: d.to?.display_name ?? 'Unknown',
  }));
}

// ---------------------------------------------------------------------------
// Settle a debt
// ---------------------------------------------------------------------------

/**
 * Mark a debt as settled. Sets `settled = true` and `settled_at = now()`.
 */
export async function settleDebt(debtId: string): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .update({ settled: true, settled_at: new Date().toISOString() })
    .eq('id', debtId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Compute net balances per member for a group
// ---------------------------------------------------------------------------

/**
 * Compute the net balance for each member in a group from unsettled debts.
 * Positive = they are owed money, negative = they owe money.
 */
export async function computeGroupBalances(
  groupId: string
): Promise<MemberBalanceSummary[]> {
  // Fetch all unsettled debts + all group members
  const [debtsResult, membersResult] = await Promise.all([
    supabase
      .from('debts')
      .select('from_member, to_member, amount, currency')
      .eq('group_id', groupId)
      .eq('settled', false),
    supabase
      .from('group_members')
      .select('id, display_name')
      .eq('group_id', groupId),
  ]);

  if (debtsResult.error) throw debtsResult.error;
  if (membersResult.error) throw membersResult.error;

  const debts = debtsResult.data ?? [];
  const members = membersResult.data ?? [];

  // Build a balance map: member_id -> net amount
  // Positive = owed to them, negative = they owe
  const balanceMap = new Map<string, { amount: number; currency: string }>();

  for (const debt of debts) {
    // from_member owes, so their balance decreases
    const fromEntry = balanceMap.get(debt.from_member) ?? { amount: 0, currency: debt.currency };
    fromEntry.amount -= debt.amount;
    fromEntry.currency = debt.currency;
    balanceMap.set(debt.from_member, fromEntry);

    // to_member is owed, so their balance increases
    const toEntry = balanceMap.get(debt.to_member) ?? { amount: 0, currency: debt.currency };
    toEntry.amount += debt.amount;
    toEntry.currency = debt.currency;
    balanceMap.set(debt.to_member, toEntry);
  }

  // Map members to MemberBalanceSummary
  return members.map((m) => {
    const entry = balanceMap.get(m.id);
    return {
      member_id: m.id,
      display_name: m.display_name,
      net_amount: entry?.amount ?? 0,
      currency: entry?.currency ?? 'USD',
    };
  });
}

// ---------------------------------------------------------------------------
// Realtime subscription
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time changes on the debts table for a given group.
 * Calls `onChange` whenever a debt is inserted, updated, or deleted.
 * Returns an unsubscribe function.
 */
export function subscribeToDebts(
  groupId: string,
  onChange: (payload: RealtimePostgresChangesPayload<Debt>) => void
): () => void {
  const channel = supabase
    .channel(`debts:group:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'debts',
        filter: `group_id=eq.${groupId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to all debt changes across all groups for the current user.
 * Listens on the entire debts table and filters client-side.
 * Returns an unsubscribe function.
 */
export function subscribeToAllDebts(
  onChange: (payload: RealtimePostgresChangesPayload<Debt>) => void
): () => void {
  const channel = supabase
    .channel('debts:all')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'debts',
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
