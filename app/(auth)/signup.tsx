import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/contexts/AuthContext';

const CURRENCIES = [
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'THB', label: 'THB — Thai Baht' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { code: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { code: 'KRW', label: 'KRW — South Korean Won' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'HKD', label: 'HKD — Hong Kong Dollar' },
];

export default function OnboardingScreen() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
  );
  const [selectedCurrency, setSelectedCurrency] = useState('AUD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        home_currency: selectedCurrency,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCurrencyLabel = CURRENCIES.find(c => c.code === selectedCurrency)?.label ?? selectedCurrency;
  const initials = displayName.trim()
    ? displayName.trim().charAt(0).toUpperCase()
    : '?';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.welcomeTitle}>Welcome!</Text>
            <Text style={styles.welcomeSubtitle}>
              Let's get you set up. What should we call you?
            </Text>
          </View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepDot} />
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.negative} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Display name */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />
          </View>

          {/* Currency selector */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Home Currency</Text>
            <Pressable
              style={({ pressed }) => [
                styles.currencySelector,
                pressed && styles.currencySelectorPressed,
              ]}
              onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
            >
              <Text style={styles.currencySelectorText}>{selectedCurrencyLabel}</Text>
              <Ionicons
                name={showCurrencyPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textSecondary}
              />
            </Pressable>

            {showCurrencyPicker ? (
              <View style={styles.currencyList}>
                <ScrollView nestedScrollEnabled style={styles.currencyScroll}>
                  {CURRENCIES.map(currency => (
                    <Pressable
                      key={currency.code}
                      style={({ pressed }) => [
                        styles.currencyOption,
                        currency.code === selectedCurrency && styles.currencyOptionSelected,
                        pressed && styles.currencyOptionPressed,
                      ]}
                      onPress={() => {
                        setSelectedCurrency(currency.code);
                        setShowCurrencyPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.currencyOptionText,
                          currency.code === selectedCurrency && styles.currencyOptionTextSelected,
                        ]}
                      >
                        {currency.label}
                      </Text>
                      {currency.code === selectedCurrency ? (
                        <Ionicons name="checkmark" size={20} color={Colors.accent} />
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* Complete button */}
          <Pressable
            style={({ pressed }) => [
              styles.completeButton,
              pressed && styles.completeButtonPressed,
              isSaving && styles.completeButtonDisabled,
            ]}
            onPress={handleComplete}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={styles.completeButtonText}>Get Started</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.accent,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.accent,
    width: 24,
    borderRadius: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.negative,
    lineHeight: 20,
  },
  field: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 4,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencySelectorPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  currencySelectorText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  currencyList: {
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  currencyScroll: {
    maxHeight: 240,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  currencyOptionSelected: {
    backgroundColor: Colors.accentSurface,
  },
  currencyOptionPressed: {
    backgroundColor: Colors.surfacePrimary,
  },
  currencyOptionText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  currencyOptionTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  completeButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
