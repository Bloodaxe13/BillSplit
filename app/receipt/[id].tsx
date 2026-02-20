import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Colors } from '../../src/constants/colors';
import { formatCurrency } from '../../src/services/currency';
import {
  fetchReceiptWithClaims,
  fetchGroupMembers,
  findMyMembership,
  createClaim,
  deleteClaimByMember,
  subscribeToClaimChanges,
  unsubscribeFromClaims,
  calculateMemberShare,
} from '../../src/services/claims';
import { useAuth } from '../../src/contexts/AuthContext';
import { LineItemRow } from '../../src/components/receipts/LineItemRow';
import { TaxBreakdown } from '../../src/components/receipts/TaxBreakdown';
import { PayerAssignView } from '../../src/components/receipts/PayerAssignView';
import type { ReceiptWithItems, GroupMemberWithProfile } from '../../src/types/database';

type ViewMode = 'claim' | 'assign';

export default function ReceiptDetailScreen() {
  const { id: receiptId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [receipt, setReceipt] = useState<ReceiptWithItems | null>(null);
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('claim');

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Is the current user the payer?
  const isPayer = receipt && myMemberId === receipt.paid_by;

  // ── Data loading ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!receiptId) return;

    try {
      const receiptData = await fetchReceiptWithClaims(receiptId);
      setReceipt(receiptData);

      const membersData = await fetchGroupMembers(receiptData.group_id);
      setMembers(membersData);

      if (user?.id) {
        const membershipId = await findMyMembership(
          receiptData.group_id,
          user.id
        );
        setMyMemberId(membershipId);
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load receipt');
    } finally {
      setIsLoading(false);
    }
  }, [receiptId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Realtime subscription ─────────────────────────────────

  useEffect(() => {
    if (!receiptId) return;

    channelRef.current = subscribeToClaimChanges(receiptId, () => {
      // Re-fetch on any claim change
      loadData();
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromClaims(channelRef.current);
      }
    };
  }, [receiptId, loadData]);

  // ── Claim toggling ────────────────────────────────────────

  const handleToggleClaim = useCallback(
    async (lineItemId: string, currentlyClaimed: boolean) => {
      if (!myMemberId) return;

      try {
        if (currentlyClaimed) {
          await deleteClaimByMember(lineItemId, myMemberId);
        } else {
          await createClaim(lineItemId, myMemberId);
        }
        // Optimistic: realtime will trigger a full refresh, but also reload now
        await loadData();
      } catch (e) {
        // Reload to reset state on error
        await loadData();
      }
    },
    [myMemberId, loadData]
  );

  // ── Payer assignment ──────────────────────────────────────

  const handleAssign = useCallback(
    async (lineItemId: string, memberId: string) => {
      try {
        await createClaim(lineItemId, memberId);
        await loadData();
      } catch {
        await loadData();
      }
    },
    [loadData]
  );

  const handleUnassign = useCallback(
    async (lineItemId: string, memberId: string) => {
      try {
        await deleteClaimByMember(lineItemId, memberId);
        await loadData();
      } catch {
        await loadData();
      }
    },
    [loadData]
  );

  const handleNudge = useCallback(() => {
    // Nudge is Tier 2 — for now just show an alert concept
    // In production this would send push notifications to unclaimed-item members
  }, []);

  // ── Derived values ────────────────────────────────────────

  const claimedCount = receipt
    ? receipt.line_items.filter((li) => li.claims.length > 0).length
    : 0;
  const totalItems = receipt?.line_items.length ?? 0;
  const claimProgress = totalItems > 0 ? claimedCount / totalItems : 0;

  const myShare =
    receipt && myMemberId
      ? calculateMemberShare(receipt, myMemberId)
      : 0;

  const payerMember = receipt
    ? members.find((m) => m.id === receipt.paid_by)
    : null;

  // ── Animated progress bar ─────────────────────────────────

  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withTiming(claimProgress, { duration: 400 });
  }, [claimProgress, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  // ── Loading / error states ────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !receipt) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{'\u2039'} Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Receipt</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Receipt not found'}</Text>
          <Pressable style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currency = receipt.currency;
  const receiptDate = new Date(receipt.created_at);
  const dateStr = receiptDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{'\u2039'} Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Receipt</Text>
        {isPayer ? (
          <Pressable
            style={styles.viewToggle}
            onPress={() =>
              setViewMode((v) => (v === 'claim' ? 'assign' : 'claim'))
            }
          >
            <Text style={styles.viewToggleText}>
              {viewMode === 'claim' ? 'Assign' : 'Claim'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Receipt summary card with TaxBreakdown */}
        <View style={styles.summarySection}>
          <View style={styles.summaryHeader}>
            <Text style={styles.restaurantName}>
              {receipt.description ?? 'Receipt'}
            </Text>
            <Text style={styles.receiptDate}>{dateStr}</Text>
          </View>

          <TaxBreakdown receipt={receipt} />

          {payerMember && (
            <Text style={styles.paidBy}>
              Paid by {payerMember.id === myMemberId ? 'You' : payerMember.display_name}
            </Text>
          )}
        </View>

        {/* Claiming progress */}
        <View style={styles.claimStatus}>
          <View style={styles.claimStatusBar}>
            <Animated.View style={[styles.claimStatusFill, progressStyle]} />
          </View>
          <Text style={styles.claimStatusText}>
            {claimedCount} of {totalItems} items claimed
          </Text>
        </View>

        {/* View modes */}
        {viewMode === 'assign' && isPayer && myMemberId ? (
          <View style={styles.section}>
            <PayerAssignView
              lineItems={receipt.line_items}
              currency={currency}
              members={members}
              myMemberId={myMemberId}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
              onNudge={handleNudge}
            />
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            <Text style={styles.sectionSubtitle}>
              Tap items you had to claim them
            </Text>

            <View style={styles.lineItemsList}>
              {receipt.line_items.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  myMemberId={myMemberId}
                  members={members}
                  onToggleClaim={handleToggleClaim}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky "Your share" footer */}
      {myMemberId && (
        <View style={styles.shareFooter}>
          <View style={styles.shareFooterInner}>
            <View>
              <Text style={styles.shareLabel}>Your share</Text>
              <Text style={styles.shareSubtext}>
                {receipt.line_items.filter((li) =>
                  li.claims.some((c) => c.group_member_id === myMemberId)
                ).length}{' '}
                items
              </Text>
            </View>
            <Text style={styles.shareAmount}>
              {formatCurrency(myShare, currency)}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorText: {
    fontSize: 15,
    color: Colors.negative,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 4,
    minWidth: 60,
  },
  backButtonText: {
    fontSize: 17,
    color: Colors.accent,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerSpacer: {
    minWidth: 60,
  },
  viewToggle: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 60,
    alignItems: 'center',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ── Scroll ──────────────────────────────────────────────
  scrollContent: {
    paddingBottom: 120,
  },

  // ── Summary ─────────────────────────────────────────────
  summarySection: {
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  summaryHeader: {
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  receiptDate: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  paidBy: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600',
  },

  // ── Claim progress ──────────────────────────────────────
  claimStatus: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  claimStatusBar: {
    height: 6,
    backgroundColor: Colors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  claimStatusFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  claimStatusText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // ── Sections ────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginBottom: 16,
  },
  lineItemsList: {
    gap: 2,
  },

  // ── Sticky footer ───────────────────────────────────────
  shareFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34, // safe area bottom
  },
  shareFooterInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  shareSubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  shareAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.accent,
    fontVariant: ['tabular-nums'],
  },
});
