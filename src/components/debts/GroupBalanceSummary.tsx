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
  const sorted = [...balances]
    .filter((b) => b.net_amount !== 0)
    .sort((a, b) => b.net_amount - a.net_amount);

  const maxAbs = sorted.reduce((max, b) => Math.max(max, Math.abs(b.net_amount)), 0);

  if (sorted.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.heading}>Balances</Text>
        <View style={styles.settledState}>
          <Text style={styles.settledText}>All settled up!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Balances</Text>
      {sorted.map((balance, index) => {
        const isPositive = balance.net_amount > 0;
        const absAmount = Math.abs(balance.net_amount);
        const barWidth = maxAbs > 0 ? (absAmount / maxAbs) * 100 : 0;
        const color = isPositive ? Colors.positive : Colors.negative;
        const amountDisplay = formatCurrency(absAmount, balance.currency);
        const dualDisplay =
          rates && balance.currency !== homeCurrency
            ? formatDualCurrency(absAmount, balance.currency, homeCurrency, rates)
            : null;

        return (
          <View
            key={balance.member_id}
            style={[styles.row, index < sorted.length - 1 && styles.rowBorder]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.memberName} numberOfLines={1}>
                {balance.display_name}
              </Text>
              <Text style={[styles.amount, { color }]}>
                {isPositive ? '+' : '-'}{amountDisplay}
              </Text>
            </View>

            {/* Bar */}
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(barWidth, 4)}%`,
                    backgroundColor: isPositive ? Colors.positive : Colors.negative,
                  },
                ]}
              />
            </View>

            <View style={styles.rowBottom}>
              <Text style={[styles.statusLabel, { color }]}>
                {isPositive ? 'is owed' : 'owes'}
              </Text>
              {dualDisplay ? (
                <Text style={styles.dualAmount}>{dualDisplay}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heading: {
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
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  memberName: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceSecondary,
    marginBottom: 4,
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dualAmount: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
