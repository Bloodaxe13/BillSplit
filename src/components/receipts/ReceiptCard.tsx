/**
 * ReceiptCard — card component for receipt list items.
 *
 * Shows vendor name, total, date, and a processing status indicator
 * with appropriate colors and animations for each state.
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../services/currency';
import type { Receipt, ReceiptProcessingStatus } from '../../types/database';

// ── Status config ───────────────────────────────────────────

interface StatusConfig {
  label: string;
  color: string;
  showSpinner: boolean;
}

const STATUS_MAP: Record<ReceiptProcessingStatus, StatusConfig> = {
  pending: {
    label: 'Queued',
    color: Colors.warning,
    showSpinner: false,
  },
  processing: {
    label: 'Processing',
    color: Colors.info,
    showSpinner: true,
  },
  completed: {
    label: 'Ready',
    color: Colors.positive,
    showSpinner: false,
  },
  failed: {
    label: 'Failed',
    color: Colors.negative,
    showSpinner: false,
  },
};

// ── Component ───────────────────────────────────────────────

interface ReceiptCardProps {
  receipt: Receipt;
}

export function ReceiptCard({ receipt }: ReceiptCardProps) {
  const status = STATUS_MAP[receipt.processing_status];
  const displayName = receipt.vendor_name || receipt.description || 'Receipt';
  const displayTotal =
    receipt.total > 0 && receipt.currency
      ? formatCurrency(receipt.total, receipt.currency)
      : '--';

  const dateStr = formatDate(receipt.created_at);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={() => router.push(`/receipt/${receipt.id}`)}
    >
      <View style={styles.topRow}>
        <View style={styles.nameContainer}>
          <Text style={styles.vendorName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <Text style={styles.total}>{displayTotal}</Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.date}>{dateStr}</Text>

        <View style={styles.statusBadge}>
          {status.showSpinner && (
            <ActivityIndicator
              size={10}
              color={status.color}
              style={styles.statusSpinner}
            />
          )}
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusLabel, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  nameContainer: {
    flex: 1,
    marginRight: 12,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusSpinner: {
    marginRight: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
