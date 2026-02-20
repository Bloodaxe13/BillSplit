import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Share,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  fetchGroup,
  fetchGroupMembers,
  fetchGroupReceipts,
  fetchGroupBalances,
  fetchMyMembership,
  buildInviteLink,
  subscribeToGroupMembers,
} from '../../src/services/groups';
import { formatCurrency } from '../../src/services/currency';
import type {
  Group,
  GroupMemberWithProfile,
  Receipt,
  MemberBalanceSummary,
  GroupMember,
} from '../../src/types/database';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [balances, setBalances] = useState<MemberBalanceSummary[]>([]);
  const [myMembership, setMyMembership] = useState<GroupMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'receipts' | 'members' | 'balances'>('receipts');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [groupData, membersData, receiptsData, balancesData, membership] =
        await Promise.all([
          fetchGroup(id),
          fetchGroupMembers(id),
          fetchGroupReceipts(id),
          fetchGroupBalances(id),
          fetchMyMembership(id),
        ]);
      setGroup(groupData);
      setMembers(membersData);
      setReceipts(receiptsData);
      setBalances(balancesData);
      setMyMembership(membership);
    } catch {
      // Failed to load data
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to realtime member changes
  useEffect(() => {
    if (!id) return;
    const channel = subscribeToGroupMembers(id, () => {
      // Reload members and balances when membership changes
      fetchGroupMembers(id).then(setMembers).catch(() => {});
      fetchGroupBalances(id).then(setBalances).catch(() => {});
    });
    return () => {
      channel.unsubscribe();
    };
  }, [id]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }

  async function handleShareInvite() {
    if (!group) return;
    const link = buildInviteLink(group.invite_code);
    try {
      await Share.share({
        message: `Join my BillSplit group "${group.name}"!\n\n${link}`,
      });
    } catch {
      // User cancelled share
    }
  }

  // Calculate my balance from the balances array
  const myBalance = balances.find(
    (b) => b.member_id === myMembership?.id
  )?.net_amount ?? 0;
  const isPositive = myBalance > 0;

  if (isLoading || !group) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{'\u2039'} Back</Text>
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{'\u2039'} Back</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={styles.inviteButton} onPress={handleShareInvite}>
            <Text style={styles.inviteButtonText}>Invite</Text>
          </Pressable>
        </View>
      </View>

      {/* Group info */}
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupSubtitle}>
          {members.length} {members.length === 1 ? 'member' : 'members'}  {group.default_currency}
        </Text>
      </View>

      {/* Balance summary */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your balance</Text>
        <Text
          style={[
            styles.balanceAmount,
            {
              color:
                myBalance === 0
                  ? Colors.textTertiary
                  : isPositive
                    ? Colors.positive
                    : Colors.negative,
            },
          ]}
        >
          {myBalance === 0
            ? 'Settled'
            : `${isPositive ? '+' : ''}${formatCurrency(myBalance, group.default_currency)}`}
        </Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['receipts', 'members', 'balances'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === 'receipts'
                ? `Receipts (${receipts.length})`
                : tab === 'members'
                  ? `Members (${members.length})`
                  : 'Balances'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content based on active tab */}
      {activeTab === 'receipts' && (
        <>
          <View style={styles.sectionHeader}>
            <Pressable
              style={({ pressed }) => [
                styles.addReceiptButton,
                pressed && styles.addReceiptButtonPressed,
              ]}
              onPress={() => router.push('/(tabs)/scan')}
            >
              <Text style={styles.addReceiptText}>+ Add Receipt</Text>
            </Pressable>
          </View>

          <FlatList
            data={receipts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ReceiptCard
                receipt={item}
                members={members}
                currency={group.default_currency}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.accent}
                colors={[Colors.accent]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>No receipts yet</Text>
                <Text style={styles.emptyTabSubtext}>
                  Add a receipt to start splitting expenses.
                </Text>
              </View>
            }
          />
        </>
      )}

      {activeTab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              isCurrentUser={item.user_id === user?.id}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        />
      )}

      {activeTab === 'balances' && (
        <FlatList
          data={balances}
          keyExtractor={(item) => item.member_id}
          renderItem={({ item }) => <BalanceRow balance={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabText}>No balances</Text>
              <Text style={styles.emptyTabSubtext}>
                Balances will appear once receipts are claimed.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────

interface ReceiptCardProps {
  receipt: Receipt;
  members: GroupMemberWithProfile[];
  currency: string;
}

function ReceiptCard({ receipt, members, currency }: ReceiptCardProps) {
  const paidByMember = members.find((m) => m.id === receipt.paid_by);
  const paidByName = paidByMember?.display_name ?? 'Unknown';

  const timeAgo = formatTimeAgo(new Date(receipt.created_at));

  return (
    <Pressable
      style={({ pressed }) => [
        styles.receiptCard,
        pressed && styles.receiptCardPressed,
      ]}
      onPress={() => router.push(`/receipt/${receipt.id}`)}
    >
      <View style={styles.receiptHeader}>
        <Text style={styles.receiptDescription} numberOfLines={1}>
          {receipt.description ?? 'Receipt'}
        </Text>
        <Text style={styles.receiptTotal}>
          {formatCurrency(receipt.total, receipt.currency)}
        </Text>
      </View>
      <View style={styles.receiptMeta}>
        <Text style={styles.receiptPaidBy}>Paid by {paidByName}</Text>
        <Text style={styles.receiptTimestamp}>{timeAgo}</Text>
      </View>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusBadge,
            receipt.processing_status === 'completed'
              ? styles.statusCompleted
              : receipt.processing_status === 'failed'
                ? styles.statusFailed
                : styles.statusPending,
          ]}
        >
          <Text style={styles.statusText}>{receipt.processing_status}</Text>
        </View>
      </View>
    </Pressable>
  );
}

interface MemberRowProps {
  member: GroupMemberWithProfile;
  isCurrentUser: boolean;
}

function MemberRow({ member, isCurrentUser }: MemberRowProps) {
  const initials = member.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>{initials}</Text>
      </View>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName}>
            {member.display_name}
            {isCurrentUser ? ' (you)' : ''}
          </Text>
          {member.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>
        <Text style={styles.memberDetail}>
          {member.user_id ? 'Account linked' : 'Link-only member'}
        </Text>
      </View>
    </View>
  );
}

interface BalanceRowProps {
  balance: MemberBalanceSummary;
}

function BalanceRow({ balance }: BalanceRowProps) {
  const isPositive = balance.net_amount > 0;
  const isZero = balance.net_amount === 0;

  return (
    <View style={styles.balanceRow}>
      <Text style={styles.balanceRowName}>{balance.display_name}</Text>
      <Text
        style={[
          styles.balanceRowAmount,
          {
            color: isZero
              ? Colors.textTertiary
              : isPositive
                ? Colors.positive
                : Colors.negative,
          },
        ]}
      >
        {isZero
          ? 'Settled'
          : `${isPositive ? '+' : ''}${formatCurrency(balance.net_amount, balance.currency)}`}
      </Text>
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 17,
    color: Colors.accent,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  inviteButton: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  groupInfo: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  groupName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  groupSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  balanceCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.surfaceTertiary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.textPrimary,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  addReceiptButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addReceiptButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  addReceiptText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textInverse,
  },

  // Lists
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },

  // Receipt card
  receiptCard: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  receiptCardPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  receiptDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  receiptTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  receiptMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  receiptPaidBy: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  receiptTimestamp: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  statusRow: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusCompleted: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  statusFailed: {
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
  },
  statusPending: {
    backgroundColor: 'rgba(255, 183, 77, 0.12)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },

  // Member row
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  adminBadge: {
    backgroundColor: Colors.accentSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  memberDetail: {
    fontSize: 13,
    color: Colors.textTertiary,
  },

  // Balance row
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  balanceRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  balanceRowAmount: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Empty states
  emptyTab: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
  },
  emptyTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  emptyTabSubtext: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
