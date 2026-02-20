import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../services/currency';
import type { Receipt, TaxStructure } from '../../types/database';

interface TaxBreakdownProps {
  receipt: Receipt;
}

/** Format a tax rate as a human-readable percentage. */
function formatRate(rate: number): string {
  const pct = rate * 100;
  return `${parseFloat(pct.toFixed(2))}%`;
}

/** Build fee descriptions from the tax_structure JSON. */
function buildFeeLines(
  receipt: Receipt
): Array<{ label: string; amount: number }> {
  const lines: Array<{ label: string; amount: number }> = [];
  const ts: TaxStructure | null = receipt.tax_structure;

  if (receipt.service_fee > 0) {
    const rate = ts?.service_fee?.rate;
    const label = rate
      ? `Service fee (${formatRate(rate)})`
      : 'Service fee';
    lines.push({ label, amount: receipt.service_fee });
  }

  if (receipt.tax > 0) {
    const rate = ts?.tax?.rate;
    const base = ts?.tax?.base;
    let label = 'Tax';
    if (rate) {
      label = `Tax (${formatRate(rate)})`;
      if (base && base !== 'subtotal') {
        label += ` on ${base.replace(/_/g, ' ')}`;
      }
    }
    lines.push({ label, amount: receipt.tax });
  }

  if (receipt.tip > 0) {
    lines.push({ label: 'Tip', amount: receipt.tip });
  }

  if (ts) {
    for (const [key, entry] of Object.entries(ts)) {
      if (key === 'service_fee' || key === 'tax' || !entry) continue;
      const niceName = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const label = entry.rate
        ? `${niceName} (${formatRate(entry.rate)})`
        : niceName;
      lines.push({ label, amount: 0 });
    }
  }

  return lines.filter((l) => l.amount > 0);
}

export function TaxBreakdown({ receipt }: TaxBreakdownProps) {
  const feeLines = buildFeeLines(receipt);
  const currency = receipt.currency;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Breakdown</Text>

      <View style={styles.table}>
        <View style={styles.row}>
          <Text style={styles.label}>Subtotal</Text>
          <Text style={styles.value}>
            {formatCurrency(receipt.subtotal, currency)}
          </Text>
        </View>

        {feeLines.map((line, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.label}>{line.label}</Text>
            <Text style={styles.value}>
              {formatCurrency(line.amount, currency)}
            </Text>
          </View>
        ))}

        {/* Green divider line */}
        <View style={styles.greenDivider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(receipt.total, currency)}
          </Text>
        </View>
      </View>

      {receipt.subtotal > 0 && receipt.total > receipt.subtotal && (
        <Text style={styles.explanation}>
          Fees are split proportionally based on each person's share of the
          subtotal.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  table: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  value: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  greenDivider: {
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  explanation: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 12,
    lineHeight: 16,
  },
});
