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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
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
    } catch (err) {
      console.error('GroupScreen: Failed to load group data:', err);
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
      fetchGroupMembers(id).then(setMembers).catch((err) => {
        console.error('GroupScreen: Failed to refresh members:', err);
      });
      fetchGroupBalances(id).then(setBalances).catch((err) => {
        console.error('GroupScreen: Failed to refresh balances:', err);
      });
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
    } catch (err) {
      console.error('GroupScreen: Share invite failed:', err);
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
            <Ionicons name="chevron-back" size={22} color={Colors.accent} />
            <Text style={styles.backButtonText}>Back</Text>
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
          <Ionicons name="chevron-back" size={22} color={Colors.accent} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable style={styles.inviteButton} onPress={handleShareInvite}>
          <Ionicons name="person-add-outline" size={16} color={Colors.accent} />
          <Text style={styles.inviteButtonText}>Invite</Text>
        </Pressable>
      </View>

      {/* Group info */}
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{group.name}</Text>
        <View style={styles.groupMeta}>
          <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.groupSubtitle}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
          <View style={styles.metaDot} />
          <Text style={styles.groupSubtitle}>{group.default_currency}</Text>
        </View>
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

      {/* Segmented control tab bar */}
      <View style={styles.segmentedControl}>
        {(['receipts', 'members', 'balances'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={styles.segmentTab}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.segmentTabText,
                activeTab === tab && styles.segmentTabTextActive,
              ]}
            >
              {tab === 'receipts'
                ? `Receipts (${receipts.length})`
                : tab === 'members'
                  ? `Members (${members.length})`
                  : 'Balances'}
            </Text>
            {activeTab === tab && <View style={styles.segmentIndicator} />}
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
              <Ionicons name="add" size={16} color={Colors.textInverse} />
              <Text style={styles.addReceiptText}>Add Receipt</Text>
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
                <Ionicons name="receipt-outline" size={32} color={Colors.textTertiary} />
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
              <Ionicons name="wallet-outline" size={32} color={Colors.textTertiary} />
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

// -- Sub-components -------------------------------------------------------

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
          <Text
            style={[
              styles.statusText,
              receipt.processing_status === 'completed' && { color: Colors.positive },
              receipt.processing_status === 'failed' && { color: Colors.negative },
              receipt.processing_status === 'pending' && { color: Colors.warning },
            ]}
          >
            {receipt.processing_status}
          </Text>
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

// -- Helpers --------------------------------------------------------------

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

// -- Styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfacePrimary,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 17,
    color: Colors.accent,
    fontWeight: '500',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  groupInfo: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  groupName: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
  },

  // Balance card
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
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

  // Segmented control (green underline style)
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  segmentTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  segmentTabTextActive: {
    color: Colors.accent,
  },
  segmentIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  addReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addReceiptButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  addReceiptText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textInverse,
  },

  // Lists
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },

  // Receipt card
  receiptCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  receiptCardPressed: {
    backgroundColor: Colors.surfacePrimary,
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
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
  },
  statusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
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
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent,
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
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
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
    paddingTop: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyTabSubtext: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
