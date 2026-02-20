import { supabase } from '../lib/supabase';
import type {
  LineItemClaim,
  LineItemWithClaims,
  ReceiptWithItems,
  GroupMemberWithProfile,
  Receipt,
} from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Fetch receipt with items and claims ────────────────────────

/**
 * Fetch a full receipt with all line items and their claims.
 * Returns the receipt with nested line_items[].claims[].
 */
export async function fetchReceiptWithClaims(
  receiptId: string
): Promise<ReceiptWithItems> {
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', receiptId)
    .single();

  if (receiptError || !receipt) {
    throw new Error(
      `Failed to fetch receipt: ${receiptError?.message ?? 'not found'}`
    );
  }

  const { data: lineItems, error: itemsError } = await supabase
    .from('line_items')
    .select('*')
    .eq('receipt_id', receiptId)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    throw new Error(`Failed to fetch line items: ${itemsError.message}`);
  }

  const lineItemIds = (lineItems ?? []).map((li) => li.id);

  let claims: LineItemClaim[] = [];
  if (lineItemIds.length > 0) {
    const { data: claimsData, error: claimsError } = await supabase
      .from('line_item_claims')
      .select('*')
      .in('line_item_id', lineItemIds);

    if (claimsError) {
      throw new Error(`Failed to fetch claims: ${claimsError.message}`);
    }
    claims = (claimsData ?? []) as LineItemClaim[];
  }

  // Group claims by line_item_id
  const claimsByItem = new Map<string, LineItemClaim[]>();
  for (const claim of claims) {
    const existing = claimsByItem.get(claim.line_item_id) ?? [];
    existing.push(claim);
    claimsByItem.set(claim.line_item_id, existing);
  }

  const itemsWithClaims: LineItemWithClaims[] = (lineItems ?? []).map((li) => ({
    ...li,
    claims: claimsByItem.get(li.id) ?? [],
  })) as LineItemWithClaims[];

  return {
    ...(receipt as Receipt),
    line_items: itemsWithClaims,
  };
}

// ── Fetch group members ───────────────────────────────────────

/**
 * Fetch all members of a group, with optional profile data.
 */
export async function fetchGroupMembers(
  groupId: string
): Promise<GroupMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, profile:profiles(*)')
    .eq('group_id', groupId);

  if (error) {
    throw new Error(`Failed to fetch group members: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...row,
    profile: row.profile ?? null,
  })) as GroupMemberWithProfile[];
}

// ── Create / delete claims ────────────────────────────────────

/**
 * Create a claim for the current user on a line item.
 * Default portion is 1.0 (full item / equal split with others).
 */
export async function createClaim(
  lineItemId: string,
  groupMemberId: string,
  portion: number = 1.0
): Promise<LineItemClaim> {
  const { data, error } = await supabase
    .from('line_item_claims')
    .insert({
      line_item_id: lineItemId,
      group_member_id: groupMemberId,
      portion,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create claim: ${error.message}`);
  }

  return data as LineItemClaim;
}

/**
 * Remove a claim (unclaim an item).
 */
export async function deleteClaim(claimId: string): Promise<void> {
  const { error } = await supabase
    .from('line_item_claims')
    .delete()
    .eq('id', claimId);

  if (error) {
    throw new Error(`Failed to delete claim: ${error.message}`);
  }
}

/**
 * Remove a claim by line item + member (useful when you don't have the claim ID).
 */
export async function deleteClaimByMember(
  lineItemId: string,
  groupMemberId: string
): Promise<void> {
  const { error } = await supabase
    .from('line_item_claims')
    .delete()
    .eq('line_item_id', lineItemId)
    .eq('group_member_id', groupMemberId);

  if (error) {
    throw new Error(`Failed to delete claim: ${error.message}`);
  }
}

// ── Realtime subscription ─────────────────────────────────────

/**
 * Subscribe to claim changes for all line items on a receipt.
 * Calls `onUpdate` whenever a claim is inserted or deleted so the UI
 * can re-fetch and re-render.
 */
export function subscribeToClaimChanges(
  receiptId: string,
  onUpdate: () => void
): RealtimeChannel {
  const channel = supabase
    .channel(`claims:${receiptId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'line_item_claims',
        // We filter on the client side since the claim table references
        // line_item_id, not receipt_id directly
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe and remove a realtime channel.
 */
export function unsubscribeFromClaims(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Find the current user's group_member record for a group.
 */
export async function findMyMembership(
  groupId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.id;
}

/**
 * Calculate how much a specific member owes for a receipt,
 * factoring in proportional tax/tip/service fee distribution.
 *
 * Formula: member_share = (member_claimed_subtotal / receipt_subtotal) * receipt_total
 * This proportionally distributes all fees (tax, tip, service) based on
 * the member's share of the subtotal.
 */
export function calculateMemberShare(
  receipt: ReceiptWithItems,
  groupMemberId: string
): number {
  if (receipt.subtotal === 0) return 0;

  let memberSubtotal = 0;

  for (const item of receipt.line_items) {
    const myClaim = item.claims.find(
      (c) => c.group_member_id === groupMemberId
    );
    if (!myClaim) continue;

    // Total portions on this item (sum of all claimants' portions)
    const totalPortions = item.claims.reduce((sum, c) => sum + c.portion, 0);
    if (totalPortions === 0) continue;

    // My fraction of this item
    const myFraction = myClaim.portion / totalPortions;
    memberSubtotal += Math.round(item.total_price * myFraction);
  }

  // Proportionally allocate fees
  const feeMultiplier = receipt.total / receipt.subtotal;
  return Math.round(memberSubtotal * feeMultiplier);
}
