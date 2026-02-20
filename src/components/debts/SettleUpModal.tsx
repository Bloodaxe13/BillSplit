import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import type { DebtWithMembers } from '../../types/database';
import type { ExchangeRates } from '../../types/currency';
import { formatCurrency, formatDualCurrency } from '../../services/currency';
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

  const primaryAmount = formatCurrency(debt.amount, debt.currency);
  const dualAmount =
    rates && debt.currency !== homeCurrency
      ? formatDualCurrency(debt.amount, debt.currency, homeCurrency, rates)
      : null;

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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Title */}
          <Text style={styles.title}>Settle Up</Text>

          {/* From -> To summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.personColumn}>
              <Text style={styles.personLabel}>From</Text>
              <Text style={styles.personName} numberOfLines={1}>
                {debt.from_member_name}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={Colors.textTertiary} />
            <View style={styles.personColumn}>
              <Text style={styles.personLabel}>To</Text>
              <Text style={styles.personName} numberOfLines={1}>
                {debt.to_member_name}
              </Text>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.amountSection}>
            <Text style={styles.amountPrimary}>{primaryAmount}</Text>
            {dualAmount ? (
              <Text style={styles.amountDual}>{dualAmount}</Text>
            ) : null}
          </View>

          {/* Info note */}
          <View style={styles.noteContainer}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.noteText}>
              This marks the debt as settled. Make sure the payment has been made outside the app.
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Actions */}
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
              <Text style={styles.confirmButtonText}>I've Settled This</Text>
            )}
          </Pressable>

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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceTertiary,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  personColumn: {
    flex: 1,
  },
  personLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  amountPrimary: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  amountDual: {
    fontSize: 15,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: Colors.negative,
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  cancelButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonPressed: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 14,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
});
