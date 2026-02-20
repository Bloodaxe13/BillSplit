/**
 * ReceiptValidation -- validation step after OCR processing.
 *
 * Shows the receipt image on top with extracted totals below in a clean card
 * so the payer can confirm amounts before claiming opens for the group.
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../services/currency';
import { getReceiptImageUrl, confirmReceiptTotal } from '../../services/receipts';
import type { Receipt } from '../../types/database';

// -- Component ---------------------------------------------------------------

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
      {/* Receipt image — top area */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.receiptImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="receipt-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.imagePlaceholderText}>Loading image...</Text>
          </View>
        )}
      </View>

      {/* Extracted data card */}
      <View style={styles.dataCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="scan-outline" size={18} color={Colors.accent} />
          <Text style={styles.cardTitle}>Extracted totals</Text>
        </View>
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

        {/* Green divider before total */}
        <View style={styles.greenDivider} />

        <View style={styles.totalRow}>
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
        {/* Edit toggle */}
        <Pressable
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.editButtonPressed,
          ]}
          onPress={() => {
            if (isEditing) {
              setIsEditing(false);
              setEditedTotal('');
            } else {
              setIsEditing(true);
              setEditedTotal('');
            }
          }}
        >
          <Ionicons
            name={isEditing ? 'close-outline' : 'create-outline'}
            size={18}
            color={Colors.accent}
          />
          <Text style={styles.editButtonText}>
            {isEditing ? 'Use extracted total' : 'Edit total'}
          </Text>
        </Pressable>

        {/* Confirm — solid green */}
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
            <>
              <Ionicons name="checkmark-circle" size={20} color={Colors.textInverse} />
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </>
          )}
        </Pressable>

        {/* Cancel */}
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// -- Styles ------------------------------------------------------------------

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
    height: 280,
  },
  imagePlaceholder: {
    height: 180,
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
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    color: Colors.textTertiary,
  },
  dataValue: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: Colors.background,
  },
  editButtonPressed: {
    backgroundColor: Colors.accentSurface,
  },
  editButtonText: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
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
