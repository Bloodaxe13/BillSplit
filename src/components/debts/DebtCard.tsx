import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import type { DebtWithMembers } from '../../types/database';
import type { ExchangeRates } from '../../types/currency';
import { formatDualCurrency } from '../../services/currency';

interface DebtCardProps {
  debt: DebtWithMembers & { _group_name?: string };
  /** The current user's group_member IDs (to determine owe direction) */
  myMemberIds: string[];
  homeCurrency: string;
  rates: ExchangeRates | null;
  onSettle: (debtId: string) => void;
}

export function DebtCard({ debt, myMemberIds, homeCurrency, rates, onSettle }: DebtCardProps) {
  const iOwe = myMemberIds.includes(debt.from_member);
  const directionLabel = iOwe
    ? `You owe ${debt.to_member_name}`
    : `${debt.from_member_name} owes you`;

  const amountDisplay = rates
    ? formatDualCurrency(debt.amount, debt.currency, homeCurrency, rates)
    : `${debt.amount} ${debt.currency}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <View style={styles.directionRow}>
          <Ionicons
            name={iOwe ? 'arrow-up-outline' : 'arrow-down-outline'}
            size={18}
            color={iOwe ? Colors.negative : Colors.positive}
          />
          <Text style={[styles.directionLabel, { color: iOwe ? Colors.negative : Colors.positive }]}>
            {directionLabel}
          </Text>
        </View>

        <Text style={styles.amount}>{amountDisplay}</Text>

        {debt._group_name ? (
          <Text style={styles.groupName}>{debt._group_name}</Text>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.settleButton,
          pressed && styles.settleButtonPressed,
        ]}
        onPress={() => onSettle(debt.id)}
      >
        <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textInverse} />
        <Text style={styles.settleButtonText}>Settle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    marginRight: 12,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  directionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  amount: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  groupName: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  settleButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settleButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  settleButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
