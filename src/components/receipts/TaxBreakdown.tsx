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
  // Trim trailing zeros: 7.000 -> 7, 10.5 -> 10.5
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

  // Pick up any extra fee entries in tax_structure
  if (ts) {
    for (const [key, entry] of Object.entries(ts)) {
      if (key === 'service_fee' || key === 'tax' || !entry) continue;
      const niceName = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const label = entry.rate
        ? `${niceName} (${formatRate(entry.rate)})`
        : niceName;
      // We don't have a separate column for arbitrary fees, so skip the amount
      // unless it's reflected elsewhere. Just surface the label for transparency.
      lines.push({ label, amount: 0 });
    }
  }

  // Filter out zero-amount extra entries
  return lines.filter((l) => l.amount > 0);
}

export function TaxBreakdown({ receipt }: TaxBreakdownProps) {
  const feeLines = buildFeeLines(receipt);
  const currency = receipt.currency;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Breakdown</Text>

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

      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>
          {formatCurrency(receipt.total, currency)}
        </Text>
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
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
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
