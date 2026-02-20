/**
 * ReceiptValidation — validation step after OCR processing.
 *
 * Shows the receipt image side-by-side with the extracted total so the
 * payer can confirm the amounts match before claiming opens for the group.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../services/currency';
import { getReceiptImageUrl, confirmReceiptTotal } from '../../services/receipts';
import type { Receipt } from '../../types/database';

// ── Component ───────────────────────────────────────────────

interface ReceiptValidationProps {
  receipt: Receipt;
  onConfirmed: () => void;
  onCancel: () => void;
}

export function ReceiptValidation({
  receipt,
  onConfirmed,
  onCancel,
}: ReceiptValidationProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTotal, setEditedTotal] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (receipt.image_url) {
      getReceiptImageUrl(receipt.image_url)
        .then(setImageUrl)
        .catch(() => setImageUrl(null));
    }
  }, [receipt.image_url]);

  const currency = receipt.currency ?? 'USD';
  const displayTotal = formatCurrency(receipt.total, currency);
  const displaySubtotal = formatCurrency(receipt.subtotal, currency);
  const displayTax = formatCurrency(receipt.tax, currency);
  const displayServiceFee = receipt.service_fee > 0
    ? formatCurrency(receipt.service_fee, currency)
    : null;
  const displayTip = receipt.tip > 0
    ? formatCurrency(receipt.tip, currency)
    : null;

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      let finalTotal = receipt.total;

      if (isEditing && editedTotal.trim()) {
        const parsed = parseFloat(editedTotal.replace(/,/g, ''));
        if (isNaN(parsed) || parsed <= 0) {
          Alert.alert('Invalid amount', 'Please enter a valid total amount.');
          setIsConfirming(false);
          return;
        }
        // Convert to minor units — for simplicity, assume input is in major units
        const decimals = currency === 'JPY' || currency === 'KRW' || currency === 'IDR' || currency === 'VND' ? 0 : 2;
        finalTotal = decimals === 0 ? Math.round(parsed) : Math.round(parsed * 100);
      }

      await confirmReceiptTotal(receipt.id, finalTotal);
      onConfirmed();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to confirm receipt.',
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Receipt image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.receiptImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator color={Colors.textTertiary} />
            <Text style={styles.imagePlaceholderText}>Loading image...</Text>
          </View>
        )}
      </View>

      {/* Extracted data */}
      <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>Extracted totals</Text>
        <Text style={styles.cardSubtitle}>
          Verify these match your receipt
        </Text>

        {receipt.vendor_name && (
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Vendor</Text>
            <Text style={styles.dataValue}>{receipt.vendor_name}</Text>
          </View>
        )}

        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Subtotal</Text>
          <Text style={styles.dataValue}>{displaySubtotal}</Text>
        </View>

        {displayServiceFee && (
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Service fee</Text>
            <Text style={styles.dataValue}>{displayServiceFee}</Text>
          </View>
        )}

        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Tax</Text>
          <Text style={styles.dataValue}>{displayTax}</Text>
        </View>

        {displayTip && (
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Tip</Text>
            <Text style={styles.dataValue}>{displayTip}</Text>
          </View>
        )}

        <View style={[styles.dataRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          {isEditing ? (
            <TextInput
              style={styles.totalInput}
              value={editedTotal}
              onChangeText={setEditedTotal}
              keyboardType="decimal-pad"
              placeholder={displayTotal}
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
          ) : (
            <Text style={styles.totalValue}>{displayTotal}</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!isEditing ? (
          <Pressable
            style={styles.editButton}
            onPress={() => {
              setIsEditing(true);
              setEditedTotal('');
            }}
          >
            <Text style={styles.editButtonText}>Total doesn't match?</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.editButton}
            onPress={() => {
              setIsEditing(false);
              setEditedTotal('');
            }}
          >
            <Text style={styles.editButtonText}>Use extracted total</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.confirmButtonPressed,
            isConfirming && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? (
            <ActivityIndicator color={Colors.textInverse} size="small" />
          ) : (
            <Text style={styles.confirmButtonText}>
              Confirm & open for claiming
            </Text>
          )}
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  imageContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surfacePrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  receiptImage: {
    width: '100%',
    height: 300,
  },
  imagePlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  dataCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginBottom: 20,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dataLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  dataValue: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    marginTop: 8,
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.accent,
    fontVariant: ['tabular-nums'],
  },
  totalInput: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.accent,
    fontVariant: ['tabular-nums'],
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingVertical: 2,
    paddingHorizontal: 8,
    minWidth: 120,
    textAlign: 'right',
  },
  actions: {
    paddingHorizontal: 20,
    gap: 12,
  },
  editButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editButtonText: {
    fontSize: 14,
    color: Colors.info,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
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
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
