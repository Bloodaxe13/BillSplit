import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { CURRENCIES } from '../../services/currency';
import { createGroup, buildInviteLink } from '../../services/groups';
import type { Group } from '../../types/database';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (group: Group) => void;
}

type Step = 'form' | 'success';

export function CreateGroupModal({
  visible,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);

  function reset() {
    setStep('form');
    setName('');
    setCurrency('USD');
    setShowCurrencyPicker(false);
    setIsCreating(false);
    setCreatedGroup(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    try {
      const group = await createGroup(trimmedName, currency);
      setCreatedGroup(group);
      setStep('success');
      onGroupCreated(group);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to create group'
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleShareInvite() {
    if (!createdGroup) return;
    const link = buildInviteLink(createdGroup.invite_code);
    try {
      await Share.share({
        message: `Join my BillSplit group "${createdGroup.name}"!\n\n${link}`,
      });
    } catch {
      // User cancelled share
    }
  }

  const selectedCurrencyInfo = CURRENCIES.find((c) => c.code === currency);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {step === 'form' ? 'New Group' : 'Group Created'}
          </Text>
          <View style={styles.closeButton} />
        </View>

        {step === 'form' ? (
          <View style={styles.form}>
            {/* Group name */}
            <View style={styles.field}>
              <Text style={styles.label}>Group name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Bali 2026, Flat Expenses"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
                maxLength={50}
                returnKeyType="done"
              />
            </View>

            {/* Currency picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Default currency</Text>
              <Pressable
                style={styles.currencySelector}
                onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
              >
                <Text style={styles.currencySelectorText}>
                  {selectedCurrencyInfo
                    ? `${selectedCurrencyInfo.symbol} ${selectedCurrencyInfo.code} - ${selectedCurrencyInfo.name}`
                    : currency}
                </Text>
                <Text style={styles.currencyChevron}>
                  {showCurrencyPicker ? '\u25B2' : '\u25BC'}
                </Text>
              </Pressable>

              {showCurrencyPicker && (
                <ScrollView
                  style={styles.currencyList}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {CURRENCIES.map((c) => (
                    <Pressable
                      key={c.code}
                      style={[
                        styles.currencyOption,
                        c.code === currency && styles.currencyOptionSelected,
                      ]}
                      onPress={() => {
                        setCurrency(c.code);
                        setShowCurrencyPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.currencyOptionText,
                          c.code === currency &&
                            styles.currencyOptionTextSelected,
                        ]}
                      >
                        {c.symbol} {c.code} - {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Create button */}
            <Pressable
              style={({ pressed }) => [
                styles.createButton,
                (!name.trim() || isCreating) && styles.createButtonDisabled,
                pressed && name.trim() && !isCreating && styles.createButtonPressed,
              ]}
              onPress={handleCreate}
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.createButtonText}>Create Group</Text>
              )}
            </Pressable>
          </View>
        ) : (
          /* Success step */
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>{'\u2713'}</Text>
            </View>

            <Text style={styles.successTitle}>{createdGroup?.name}</Text>
            <Text style={styles.successSubtitle}>
              Your group is ready. Share the invite link with friends.
            </Text>

            {/* Invite code */}
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeLabel}>Invite code</Text>
              <Text style={styles.inviteCodeValue}>
                {createdGroup?.invite_code}
              </Text>
            </View>

            {/* Share button */}
            <Pressable
              style={({ pressed }) => [
                styles.shareButton,
                pressed && styles.shareButtonPressed,
              ]}
              onPress={handleShareInvite}
            >
              <Text style={styles.shareButtonText}>Share Invite Link</Text>
            </Pressable>

            {/* Done button */}
            <Pressable
              style={({ pressed }) => [
                styles.doneButton,
                pressed && styles.doneButtonPressed,
              ]}
              onPress={handleClose}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  closeButton: {
    minWidth: 60,
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '500',
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencySelector: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencySelectorText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  currencyChevron: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  currencyList: {
    maxHeight: 240,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  currencyOptionSelected: {
    backgroundColor: Colors.accentSurface,
  },
  currencyOptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  currencyOptionTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 36,
    color: Colors.accent,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  inviteCodeBox: {
    alignItems: 'center',
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inviteCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inviteCodeValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 4,
  },
  shareButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  shareButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  doneButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  doneButtonPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
