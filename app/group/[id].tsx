import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../src/constants/colors';

interface ReceiptPreview {
  id: string;
  description: string;
  total: string;
  paidBy: string;
  claimedCount: number;
  totalItems: number;
  timestamp: string;
}

const PLACEHOLDER_RECEIPTS: ReceiptPreview[] = [
  {
    id: '1',
    description: 'Warung Babi Guling',
    total: '450,000 IDR',
    paidBy: 'Dan',
    claimedCount: 6,
    totalItems: 8,
    timestamp: 'Today, 7:30 PM',
  },
  {
    id: '2',
    description: 'Grab to Uluwatu',
    total: '120,000 IDR',
    paidBy: 'Sarah',
    claimedCount: 4,
    totalItems: 4,
    timestamp: 'Today, 2:15 PM',
  },
  {
    id: '3',
    description: 'Bintang Supermarket',
    total: '280,000 IDR',
    paidBy: 'Mike',
    claimedCount: 3,
    totalItems: 12,
    timestamp: 'Yesterday',
  },
];

interface ReceiptCardProps {
  receipt: ReceiptPreview;
}

function ReceiptCard({ receipt }: ReceiptCardProps) {
  const claimProgress = receipt.claimedCount / receipt.totalItems;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.receiptCard,
        pressed && styles.receiptCardPressed,
      ]}
      onPress={() => router.push(`/receipt/${receipt.id}`)}
    >
      <View style={styles.receiptHeader}>
        <Text style={styles.receiptDescription}>{receipt.description}</Text>
        <Text style={styles.receiptTotal}>{receipt.total}</Text>
      </View>
      <View style={styles.receiptMeta}>
        <Text style={styles.receiptPaidBy}>Paid by {receipt.paidBy}</Text>
        <Text style={styles.receiptTimestamp}>{receipt.timestamp}</Text>
      </View>
      <View style={styles.claimBar}>
        <View style={styles.claimBarBackground}>
          <View
            style={[
              styles.claimBarFill,
              { width: `${claimProgress * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.claimBarText}>
          {receipt.claimedCount}/{receipt.totalItems} claimed
        </Text>
      </View>
    </Pressable>
  );
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with back button */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>&lsaquo; Back</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={styles.inviteButton}>
            <Text style={styles.inviteButtonText}>Invite</Text>
          </Pressable>
        </View>
      </View>

      {/* Group info */}
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>Bali 2026</Text>
        <Text style={styles.groupSubtitle}>8 members  IDR</Text>
      </View>

      {/* Balance summary */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your balance</Text>
        <Text style={styles.balanceAmount}>-245,000 IDR</Text>
        <Text style={styles.balanceConverted}>~ $23.50 AUD</Text>
      </View>

      {/* Receipts */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Receipts</Text>
        <Pressable
          style={({ pressed }) => [
            styles.addReceiptButton,
            pressed && styles.addReceiptButtonPressed,
          ]}
        >
          <Text style={styles.addReceiptText}>+ Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={PLACEHOLDER_RECEIPTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReceiptCard receipt={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    marginBottom: 24,
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
    color: Colors.negative,
    marginBottom: 4,
  },
  balanceConverted: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
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
    marginBottom: 12,
  },
  receiptPaidBy: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  receiptTimestamp: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  claimBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  claimBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surfaceTertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  claimBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  claimBarText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
