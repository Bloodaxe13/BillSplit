import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../src/constants/colors';

export default function JoinGroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Close button */}
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>&times;</Text>
        </Pressable>

        {/* Join card */}
        <View style={styles.joinCard}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>&#128101;</Text>
          </View>

          <Text style={styles.heading}>Join Group</Text>
          <Text style={styles.subheading}>
            {"You've been invited to join a group on BillSplit."}
          </Text>

          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Invite code</Text>
            <Text style={styles.codeValue}>{code ?? '--------'}</Text>
          </View>

          {/* Group preview (placeholder) */}
          <View style={styles.groupPreview}>
            <Text style={styles.groupPreviewName}>Bali 2026</Text>
            <Text style={styles.groupPreviewMembers}>8 members</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.joinButton,
                pressed && styles.joinButtonPressed,
              ]}
            >
              <Text style={styles.joinButtonText}>Join Group</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.joinAnonymousButton,
                pressed && styles.joinAnonymousButtonPressed,
              ]}
            >
              <Text style={styles.joinAnonymousText}>
                Join without an account
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          You can claim items and split bills with just a name.
          {'\n'}Create an account later to track your history.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  joinCard: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 32,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  groupPreview: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  groupPreviewName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  groupPreviewMembers: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  joinButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  joinAnonymousButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinAnonymousButtonPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  joinAnonymousText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  disclaimer: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
