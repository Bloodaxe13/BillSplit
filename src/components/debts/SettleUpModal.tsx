import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import type { DebtWithMembers } from '../../types/database';
import type { ExchangeRates } from '../../types/currency';
import { formatDualCurrency } from '../../services/currency';
import { settleDebt } from '../../services/debts';

interface SettleUpModalProps {
  visible: boolean;
  debt: DebtWithMembers | null;
  homeCurrency: string;
  rates: ExchangeRates | null;
  onClose: () => void;
  onSettled: () => void;
}

export function SettleUpModal({
  visible,
  debt,
  homeCurrency,
  rates,
  onClose,
  onSettled,
}: SettleUpModalProps) {
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!debt) return null;

  const amountDisplay = rates
    ? formatDualCurrency(debt.amount, debt.currency, homeCurrency, rates)
    : `${debt.amount} ${debt.currency}`;

  async function handleConfirm() {
    if (!debt) return;
    setSettling(true);
    setError(null);
    try {
      await settleDebt(debt.id);
      onSettled();
    } catch (err: any) {
      setError(err.message ?? 'Failed to settle debt');
    } finally {
      setSettling(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="checkmark-done-circle" size={40} color={Colors.accent} />
            <Text style={styles.title}>Settle Up</Text>
          </View>

          {/* Debt details */}
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>From</Text>
              <Text style={styles.detailValue}>{debt.from_member_name}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To</Text>
              <Text style={styles.detailValue}>{debt.to_member_name}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailAmount}>{amountDisplay}</Text>
            </View>
          </View>

          {/* Confirmation note */}
          <View style={styles.noteContainer}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.noteText}>
              This marks the debt as settled. Make sure the payment has been made outside the app.
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
              onPress={onClose}
              disabled={settling}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && styles.confirmButtonPressed,
                settling && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={settling}
            >
              {settling ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <Text style={styles.confirmButtonText}>I've Paid This</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  details: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  detailAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.accent,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: Colors.negative,
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonPressed: {
    backgroundColor: Colors.surfaceTertiary,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
