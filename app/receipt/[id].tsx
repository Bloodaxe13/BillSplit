import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
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

  const isPayer = receipt && myMemberId === receipt.paid_by;

  // -- Data loading ----------------------------------------------------------

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

  // -- Realtime subscription -------------------------------------------------

  useEffect(() => {
    if (!receiptId) return;

    channelRef.current = subscribeToClaimChanges(receiptId, () => {
      loadData();
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromClaims(channelRef.current);
      }
    };
  }, [receiptId, loadData]);

  // -- Claim toggling --------------------------------------------------------

  const handleToggleClaim = useCallback(
    async (lineItemId: string, currentlyClaimed: boolean) => {
      if (!myMemberId) return;

      try {
        if (currentlyClaimed) {
          await deleteClaimByMember(lineItemId, myMemberId);
        } else {
          await createClaim(lineItemId, myMemberId);
        }
        await loadData();
      } catch (e) {
        await loadData();
      }
    },
    [myMemberId, loadData]
  );

  // -- Payer assignment ------------------------------------------------------

  const handleAssign = useCallback(
    async (lineItemId: string, memberId: string) => {
      try {
        await createClaim(lineItemId, memberId);
        await loadData();
      } catch (err) {
        console.error('ReceiptScreen: Failed to create claim:', err);
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
      } catch (err) {
        console.error('ReceiptScreen: Failed to delete claim:', err);
        await loadData();
      }
    },
    [loadData]
  );

  const handleNudge = useCallback(() => {
    // Nudge is Tier 2
  }, []);

  // -- Derived values --------------------------------------------------------

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

  // -- Animated progress bar -------------------------------------------------

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: claimProgress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [claimProgress, progressAnim]);

  const progressStyle = {
    width: progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }),
  };

  // -- Loading / error states ------------------------------------------------

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
            <Ionicons name="chevron-back" size={22} color={Colors.accent} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Receipt</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.negative} />
          <Text style={styles.errorText}>{error ?? 'Receipt not found'}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={loadData}
          >
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
          <Ionicons name="chevron-back" size={22} color={Colors.accent} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Receipt</Text>
        {isPayer ? (
          <Pressable
            style={({ pressed }) => [
              styles.viewToggle,
              pressed && styles.viewTogglePressed,
            ]}
            onPress={() =>
              setViewMode((v) => (v === 'claim' ? 'assign' : 'claim'))
            }
          >
            <Ionicons
              name={viewMode === 'claim' ? 'people-outline' : 'hand-left-outline'}
              size={16}
              color={Colors.accent}
            />
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
        {/* Receipt summary card */}
        <View style={styles.receiptCard}>
          {/* Decorative receipt-style dashed top edge */}
          <View style={styles.receiptDashes} />

          <View style={styles.summarySection}>
            <Text style={styles.restaurantName}>
              {receipt.description ?? 'Receipt'}
            </Text>
            <Text style={styles.receiptDate}>{dateStr}</Text>

            {payerMember && (
              <View style={styles.paidByRow}>
                <Ionicons name="wallet-outline" size={14} color={Colors.accent} />
                <Text style={styles.paidBy}>
                  Paid by {payerMember.id === myMemberId ? 'You' : payerMember.display_name}
                </Text>
              </View>
            )}
          </View>

          <TaxBreakdown receipt={receipt} />
        </View>

        {/* Claiming progress */}
        <View style={styles.claimStatus}>
          <View style={styles.claimStatusHeader}>
            <Text style={styles.claimStatusText}>
              {claimedCount} of {totalItems} items claimed
            </Text>
            <Text style={styles.claimStatusPercent}>
              {totalItems > 0 ? Math.round(claimProgress * 100) : 0}%
            </Text>
          </View>
          <View style={styles.claimStatusBar}>
            <Animated.View style={[styles.claimStatusFill, progressStyle]} />
          </View>
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
    backgroundColor: Colors.surfacePrimary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 15,
    color: Colors.negative,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryButtonPressed: {
    backgroundColor: Colors.surfaceTertiary,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.accent,
  },

  // -- Header ----------------------------------------------------------------
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    minWidth: 70,
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
    minWidth: 70,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    justifyContent: 'center',
  },
  viewTogglePressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },

  // -- Scroll ----------------------------------------------------------------
  scrollContent: {
    paddingBottom: 120,
  },

  // -- Receipt card ----------------------------------------------------------
  receiptCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    // Subtle shadow for card lift
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  receiptDashes: {
    height: 0,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    borderStyle: 'dashed' as any,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 0,
    borderRadius: 0,
  },
  summarySection: {
    gap: 4,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  receiptDate: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  paidByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  paidBy: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600',
  },

  // -- Claim progress --------------------------------------------------------
  claimStatus: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  claimStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  claimStatusText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  claimStatusPercent: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  claimStatusBar: {
    height: 6,
    backgroundColor: Colors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  claimStatusFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },

  // -- Sections --------------------------------------------------------------
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginBottom: 16,
  },
  lineItemsList: {
    gap: 4,
  },

  // -- Sticky footer ---------------------------------------------------------
  shareFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    // Top shadow
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
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
    fontSize: 26,
    fontWeight: '700',
    color: Colors.accent,
    fontVariant: ['tabular-nums'],
  },
});
