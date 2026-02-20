import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import type { DebtWithMembers } from '../../types/database';
import type { ExchangeRates } from '../../types/currency';
import { formatCurrency, formatDualCurrency } from '../../services/currency';

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
  const personName = iOwe ? debt.to_member_name : debt.from_member_name;
  const initials = personName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const primaryAmount = formatCurrency(debt.amount, debt.currency);
  const dualAmount =
    rates && debt.currency !== homeCurrency
      ? formatDualCurrency(debt.amount, debt.currency, homeCurrency, rates)
      : null;

  const amountColor = iOwe ? Colors.negative : Colors.positive;

  return (
    <View style={styles.card}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: iOwe ? 'rgba(239,68,68,0.08)' : Colors.accentSurface }]}>
        <Text style={[styles.avatarText, { color: amountColor }]}>{initials}</Text>
      </View>

      {/* Name + group */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {personName}
        </Text>
        {debt._group_name ? (
          <Text style={styles.group} numberOfLines={1}>
            {debt._group_name}
          </Text>
        ) : null}
      </View>

      {/* Amount */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {iOwe ? '-' : '+'}{primaryAmount}
        </Text>
        {dualAmount ? (
          <Text style={styles.dualAmount}>{dualAmount}</Text>
        ) : null}
      </View>

      {/* Settle button */}
      <Pressable
        style={({ pressed }) => [
          styles.settleButton,
          pressed && styles.settleButtonPressed,
        ]}
        onPress={() => onSettle(debt.id)}
      >
        <Text style={styles.settleButtonText}>Settle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  group: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  amountContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  dualAmount: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  settleButton: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  settleButtonPressed: {
    backgroundColor: Colors.accentSurface,
  },
  settleButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
  },
});
