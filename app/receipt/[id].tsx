import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../src/constants/colors';

interface PlaceholderLineItem {
  id: string;
  description: string;
  price: string;
  claimedBy: string[];
}

const PLACEHOLDER_LINE_ITEMS: PlaceholderLineItem[] = [
  { id: '1', description: 'Nasi Goreng', price: '45,000', claimedBy: ['Dan'] },
  { id: '2', description: 'Babi Guling Portion', price: '85,000', claimedBy: ['Sarah', 'Mike'] },
  { id: '3', description: 'Sate Lilit (5pc)', price: '55,000', claimedBy: [] },
  { id: '4', description: 'Es Kelapa Muda', price: '25,000', claimedBy: ['Dan'] },
  { id: '5', description: 'Bintang Beer 620ml', price: '45,000', claimedBy: ['Mike'] },
  { id: '6', description: 'Fresh Juice', price: '30,000', claimedBy: ['Sarah'] },
  { id: '7', description: 'Gado Gado', price: '40,000', claimedBy: [] },
  { id: '8', description: 'Extra Rice x3', price: '15,000', claimedBy: ['Dan', 'Sarah', 'Mike'] },
];

interface LineItemRowProps {
  item: PlaceholderLineItem;
}

function LineItemRow({ item }: LineItemRowProps) {
  const isClaimed = item.claimedBy.length > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.lineItem,
        pressed && styles.lineItemPressed,
      ]}
    >
      <View style={styles.lineItemCheckbox}>
        <View
          style={[
            styles.checkbox,
            isClaimed && styles.checkboxChecked,
          ]}
        >
          {isClaimed && <Text style={styles.checkmark}>&#10003;</Text>}
        </View>
      </View>
      <View style={styles.lineItemContent}>
        <Text style={styles.lineItemDescription}>{item.description}</Text>
        {isClaimed && (
          <Text style={styles.lineItemClaimedBy}>
            {item.claimedBy.join(', ')}
          </Text>
        )}
      </View>
      <Text style={styles.lineItemPrice}>{item.price}</Text>
    </Pressable>
  );
}

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>&lsaquo; Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Receipt</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Receipt summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.restaurantName}>Warung Babi Guling</Text>
          <Text style={styles.receiptDate}>Today, 7:30 PM</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>340,000</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service (7%)</Text>
            <Text style={styles.summaryValue}>23,800</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (10%)</Text>
            <Text style={styles.summaryValue}>36,380</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>450,000 IDR</Text>
          </View>
          <Text style={styles.paidBy}>Paid by Dan</Text>
        </View>

        {/* Claiming status */}
        <View style={styles.claimStatus}>
          <View style={styles.claimStatusBar}>
            <View style={[styles.claimStatusFill, { width: '75%' }]} />
          </View>
          <Text style={styles.claimStatusText}>
            6 of 8 items claimed
          </Text>
        </View>

        {/* Line items */}
        <View style={styles.lineItemsSection}>
          <Text style={styles.sectionTitle}>Items</Text>
          <Text style={styles.sectionSubtitle}>
            Tap items you had to claim them
          </Text>

          <View style={styles.lineItemsList}>
            {PLACEHOLDER_LINE_ITEMS.map((item) => (
              <LineItemRow key={item.id} item={item} />
            ))}
          </View>
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
  },
  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  summaryTotalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    marginTop: 8,
    paddingTop: 12,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  paidBy: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 12,
  },
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
  lineItemsSection: {
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
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  lineItemPressed: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 8,
  },
  lineItemCheckbox: {
    marginRight: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    fontSize: 14,
    color: Colors.textInverse,
    fontWeight: '700',
  },
  lineItemContent: {
    flex: 1,
  },
  lineItemDescription: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  lineItemClaimedBy: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  lineItemPrice: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    marginLeft: 12,
  },
});
