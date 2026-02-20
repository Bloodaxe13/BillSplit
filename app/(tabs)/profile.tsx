import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/contexts/AuthContext';

const CURRENCIES = [
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'THB', label: 'Thai Baht' },
  { code: 'MYR', label: 'Malaysian Ringgit' },
  { code: 'IDR', label: 'Indonesian Rupiah' },
  { code: 'KRW', label: 'South Korean Won' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
];

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

function SettingsRow({ label, value, onPress, icon }: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && onPress ? styles.settingsRowPressed : undefined,
      ]}
      onPress={onPress}
    >
      <View style={styles.settingsRowLeft}>
        {icon ? <Ionicons name={icon} size={20} color={Colors.textSecondary} style={styles.settingsIcon} /> : null}
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {value ? <Text style={styles.settingsValue}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} /> : null}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(false);
  const [nameValue, setNameValue] = useState(profile?.display_name ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'User';
  const email = profile?.email || user?.email || '';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          } finally {
            setIsSigningOut(false);
          }
        },
      },
    ]);
  }

  async function handleSaveName() {
    if (!nameValue.trim()) return;
    setIsSaving(true);
    try {
      await updateProfile({ display_name: nameValue.trim() });
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Failed to update display name.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCurrencySelect(code: string) {
    setIsSaving(true);
    try {
      await updateProfile({ home_currency: code });
      setEditingCurrency(false);
    } catch {
      Alert.alert('Error', 'Failed to update currency.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Avatar + name section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>

        {/* Edit display name */}
        {editingName ? (
          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>Edit Display Name</Text>
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={nameValue}
                onChangeText={setNameValue}
                placeholder="Your name"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="words"
                autoFocus
              />
              <Pressable
                style={({ pressed }) => [styles.editSaveButton, pressed && styles.editSaveButtonPressed]}
                onPress={handleSaveName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.editSaveButtonText}>Save</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.editCancelButton, pressed && styles.editCancelButtonPressed]}
                onPress={() => {
                  setEditingName(false);
                  setNameValue(profile?.display_name ?? '');
                }}
              >
                <Text style={styles.editCancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Currency picker */}
        {editingCurrency ? (
          <View style={styles.editSection}>
            <View style={styles.editSectionHeader}>
              <Text style={styles.editSectionTitle}>Select Currency</Text>
              <Pressable onPress={() => setEditingCurrency(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.currencyGrid}>
              {CURRENCIES.map(currency => (
                <Pressable
                  key={currency.code}
                  style={({ pressed }) => [
                    styles.currencyChip,
                    currency.code === profile?.home_currency && styles.currencyChipSelected,
                    pressed && styles.currencyChipPressed,
                  ]}
                  onPress={() => handleCurrencySelect(currency.code)}
                  disabled={isSaving}
                >
                  <Text
                    style={[
                      styles.currencyChipCode,
                      currency.code === profile?.home_currency && styles.currencyChipCodeSelected,
                    ]}
                  >
                    {currency.code}
                  </Text>
                  <Text
                    style={[
                      styles.currencyChipLabel,
                      currency.code === profile?.home_currency && styles.currencyChipLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {currency.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Settings section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon="cash-outline"
              label="Home Currency"
              value={profile?.home_currency ?? 'AUD'}
              onPress={() => {
                setEditingCurrency(true);
                setEditingName(false);
              }}
            />
            <SettingsRow
              icon="person-outline"
              label="Display Name"
              value={displayName}
              onPress={() => {
                setNameValue(profile?.display_name ?? '');
                setEditingName(true);
                setEditingCurrency(false);
              }}
            />
            <SettingsRow
              icon="notifications-outline"
              label="Notifications"
              value="On"
            />
          </View>
        </View>

        {/* Subscription section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.proCard}>
            <View style={styles.proCardContent}>
              <View style={styles.proTitleRow}>
                <Text style={styles.proTitle}>BillSplit Pro</Text>
                {profile?.is_pro ? (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>Active</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.proDescription}>
                Unlimited scans, debt simplification, analytics, and more.
              </Text>
              {!profile?.is_pro ? (
                <Text style={styles.proScans}>
                  {profile?.scans_this_month ?? 0}/20 scans used this month
                </Text>
              ) : null}
            </View>
            {!profile?.is_pro ? (
              <Pressable
                style={({ pressed }) => [
                  styles.proButton,
                  pressed && styles.proButtonPressed,
                ]}
              >
                <Text style={styles.proButtonText}>Upgrade</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
            onPress={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color={Colors.negative} />
            ) : (
              <Text style={styles.signOutText}>Sign Out</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.accent,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  editSection: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editInput: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editSaveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  editSaveButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  editSaveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  editCancelButton: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editCancelButtonPressed: {
    backgroundColor: Colors.surfaceTertiary,
  },
  editCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  currencyGrid: {
    gap: 6,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    gap: 10,
  },
  currencyChipSelected: {
    backgroundColor: Colors.accentSurface,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  currencyChipPressed: {
    backgroundColor: Colors.surfaceTertiary,
  },
  currencyChipCode: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    width: 40,
  },
  currencyChipCodeSelected: {
    color: Colors.accent,
  },
  currencyChipLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  currencyChipLabelSelected: {
    color: Colors.accent,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingsGroup: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  settingsRowPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    marginRight: 12,
  },
  settingsLabel: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsValue: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  proCard: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  proCardContent: {
    marginBottom: 16,
  },
  proTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  proTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.accent,
  },
  proBadge: {
    backgroundColor: Colors.accentSurface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  proDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  proScans: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 8,
  },
  proButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  proButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  proButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  signOutButton: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutButtonPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.negative,
  },
});
