import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import type { MemberBalanceSummary } from '../../types/database';
import type { ExchangeRates } from '../../types/currency';
import { formatCurrency, formatDualCurrency } from '../../services/currency';

interface GroupBalanceSummaryProps {
  balances: MemberBalanceSummary[];
  homeCurrency: string;
  rates: ExchangeRates | null;
}

export function GroupBalanceSummary({ balances, homeCurrency, rates }: GroupBalanceSummaryProps) {
  // Sort: creditors first (positive), then debtors (negative)
  const sorted = [...balances]
    .filter((b) => b.net_amount !== 0)
    .sort((a, b) => b.net_amount - a.net_amount);

  if (sorted.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Balances</Text>
        <View style={styles.settledState}>
          <Text style={styles.settledText}>All settled up!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Balances</Text>
      {sorted.map((balance) => {
        const isPositive = balance.net_amount > 0;
        const absAmount = Math.abs(balance.net_amount);
        const amountDisplay = rates
          ? formatDualCurrency(absAmount, balance.currency, homeCurrency, rates)
          : formatCurrency(absAmount, balance.currency);

        return (
          <View key={balance.member_id} style={styles.row}>
            <View style={styles.memberInfo}>
              <View style={[styles.indicator, { backgroundColor: isPositive ? Colors.positive : Colors.negative }]} />
              <Text style={styles.memberName}>{balance.display_name}</Text>
            </View>
            <View style={styles.amountInfo}>
              <Text style={[styles.amountLabel, { color: isPositive ? Colors.positive : Colors.negative }]}>
                {isPositive ? 'is owed' : 'owes'}
              </Text>
              <Text style={[styles.amount, { color: isPositive ? Colors.positive : Colors.negative }]}>
                {amountDisplay}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  settledState: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  settledText: {
    fontSize: 15,
    color: Colors.positive,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  memberName: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
