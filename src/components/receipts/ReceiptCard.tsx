/**
 * ReceiptCard -- card component for receipt list items.
 *
 * Shows vendor name, total, date, and a processing status indicator
 * with appropriate colors for each state.
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../services/currency';
import type { Receipt, ReceiptProcessingStatus } from '../../types/database';

// -- Status config -----------------------------------------------------------

interface StatusConfig {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  showSpinner: boolean;
}

const STATUS_MAP: Record<ReceiptProcessingStatus, StatusConfig> = {
  pending: {
    label: 'Queued',
    color: Colors.warning,
    icon: 'time-outline',
    showSpinner: false,
  },
  processing: {
    label: 'Processing',
    color: Colors.info,
    icon: 'sync-outline',
    showSpinner: true,
  },
  completed: {
    label: 'Ready',
    color: Colors.positive,
    icon: 'checkmark-circle-outline',
    showSpinner: false,
  },
  failed: {
    label: 'Failed',
    color: Colors.negative,
    icon: 'alert-circle-outline',
    showSpinner: false,
  },
};

// -- Component ---------------------------------------------------------------

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
      {/* Left accent stripe for processing status */}
      <View style={[styles.statusStripe, { backgroundColor: status.color }]} />

      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={styles.nameContainer}>
            <Text style={styles.vendorName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <Text style={styles.total}>{displayTotal}</Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.statusBadge}>
            {status.showSpinner ? (
              <ActivityIndicator
                size={12}
                color={status.color}
              />
            ) : (
              <Ionicons name={status.icon} size={14} color={status.color} />
            )}
            <Text style={[styles.statusLabel, { color: status.color }]}>
              {status.label}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </View>
      </View>
    </Pressable>
  );
}

// -- Helpers -----------------------------------------------------------------

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

// -- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: Colors.surfacePrimary,
  },
  statusStripe: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameContainer: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  date: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  total: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
