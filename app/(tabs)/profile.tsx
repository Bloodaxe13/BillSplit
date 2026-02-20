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
  Switch,
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
  rightElement?: React.ReactNode;
}

function SettingsRow({ label, value, onPress, icon, rightElement }: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && onPress ? styles.settingsRowPressed : undefined,
      ]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.settingsRowLeft}>
        {icon ? (
          <View style={styles.settingsIconContainer}>
            <Ionicons name={icon} size={18} color={Colors.textSecondary} />
          </View>
        ) : null}
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {rightElement ?? (
          <>
            {value ? <Text style={styles.settingsValue}>{value}</Text> : null}
            {onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} /> : null}
          </>
        )}
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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
          } catch (err) {
            console.error('ProfileScreen: Sign out failed:', err);
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
    } catch (err) {
      console.error('ProfileScreen: Failed to update display name:', err);
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
    } catch (err) {
      console.error('ProfileScreen: Failed to update currency:', err);
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
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
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{displayName}</Text>
            {profile?.is_pro ? (
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>Pro</Text>
              </View>
            ) : null}
          </View>
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

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsGroup}>
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
              icon="cash-outline"
              label="Home Currency"
              value={profile?.home_currency ?? 'AUD'}
              onPress={() => {
                setEditingCurrency(true);
                setEditingName(false);
              }}
            />
          </View>
        </View>

        {/* Preferences section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon="notifications-outline"
              label="Notifications"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: Colors.surfaceTertiary, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              }
            />
          </View>
        </View>

        {/* Subscription section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.proCard}>
            <View style={styles.proCardHeader}>
              <Text style={styles.proTitle}>BillSplit Pro</Text>
              {profile?.is_pro ? (
                <View style={styles.proActiveBadge}>
                  <Text style={styles.proActiveBadgeText}>Active</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.proDescription}>
              Unlimited scans, debt simplification, analytics, and more.
            </Text>
            {!profile?.is_pro ? (
              <>
                <Text style={styles.proScans}>
                  {profile?.scans_this_month ?? 0}/20 scans used this month
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.proButton,
                    pressed && styles.proButtonPressed,
                  ]}
                >
                  <Text style={styles.proButtonText}>Upgrade</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.signOutSection}>
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
    backgroundColor: Colors.surfacePrimary,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: Colors.white,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.accent,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  proPill: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textInverse,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileEmail: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  editSection: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: Colors.surfacePrimary,
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
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editCancelButtonPressed: {
    backgroundColor: Colors.surfaceSecondary,
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
    backgroundColor: Colors.surfacePrimary,
    gap: 10,
  },
  currencyChipSelected: {
    backgroundColor: Colors.accentSurface,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  currencyChipPressed: {
    backgroundColor: Colors.surfaceSecondary,
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
    marginBottom: 10,
  },
  settingsGroup: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: Colors.surfacePrimary,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfacePrimary,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 15,
    color: Colors.textTertiary,
  },
  proCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  proCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  proTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  proActiveBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proActiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textInverse,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginBottom: 16,
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
  signOutSection: {
    paddingHorizontal: 20,
    marginTop: 36,
  },
  signOutButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutButtonPressed: {
    opacity: 0.6,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.negative,
  },
});
