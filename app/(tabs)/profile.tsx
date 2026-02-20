import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
}

function SettingsRow({ label, value, onPress }: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && onPress ? styles.settingsRowPressed : undefined,
      ]}
      onPress={onPress}
    >
      <Text style={styles.settingsLabel}>{label}</Text>
      {value ? <Text style={styles.settingsValue}>{value}</Text> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
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
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>BS</Text>
            </View>
          </View>
          <Text style={styles.profileName}>BillSplit User</Text>
          <Text style={styles.profileEmail}>user@example.com</Text>
        </View>

        {/* Settings section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow label="Home Currency" value="AUD" />
            <SettingsRow label="Display Name" value="BillSplit User" />
            <SettingsRow label="Notifications" value="On" />
          </View>
        </View>

        {/* Subscription section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.proCard}>
            <View style={styles.proCardContent}>
              <Text style={styles.proTitle}>BillSplit Pro</Text>
              <Text style={styles.proDescription}>
                Unlimited scans, debt simplification, analytics, and more.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.proButton,
                pressed && styles.proButtonPressed,
              ]}
            >
              <Text style={styles.proButtonText}>Upgrade</Text>
            </Pressable>
          </View>
        </View>

        {/* Danger zone */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
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
  settingsLabel: {
    fontSize: 16,
    color: Colors.textPrimary,
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
  proTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 4,
  },
  proDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
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
