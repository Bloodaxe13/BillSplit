import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  fetchGroupByInviteCode,
  fetchGroupMembers,
  joinGroup,
  joinGroupAnonymous,
} from '../../src/services/groups';
import type { Group, GroupMemberWithProfile } from '../../src/types/database';

export default function JoinGroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isAuthenticated, user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    async function loadGroup() {
      if (!code) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      const groupData = await fetchGroupByInviteCode(code);
      if (!groupData) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setGroup(groupData);

      const membersData = await fetchGroupMembers(groupData.id);
      setMembers(membersData);

      // Check if current user is already a member
      if (user) {
        const isMember = membersData.some((m) => m.user_id === user.id);
        setAlreadyMember(isMember);
      }

      setIsLoading(false);
    }

    loadGroup();
  }, [code, user]);

  async function handleJoinAuthenticated() {
    if (!group) return;
    setIsJoining(true);
    try {
      await joinGroup(group.id);
      router.replace(`/group/${group.id}`);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to join group'
      );
      setIsJoining(false);
    }
  }

  async function handleJoinAnonymous() {
    if (!group) return;

    if (!showNameInput) {
      setShowNameInput(true);
      return;
    }

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a display name to join.');
      return;
    }

    setIsJoining(true);
    try {
      await joinGroupAnonymous(group.id, trimmedName);
      router.replace(`/group/${group.id}`);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to join group'
      );
      setIsJoining(false);
    }
  }

  function handleGoToGroup() {
    if (group) {
      router.replace(`/group/${group.id}`);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Looking up invite...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Pressable
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Text style={styles.closeButtonText}>{'\u00D7'}</Text>
          </Pressable>

          <View style={styles.joinCard}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>?</Text>
            </View>
            <Text style={styles.heading}>Invalid Invite</Text>
            <Text style={styles.subheading}>
              This invite link is invalid or has expired. Ask the group admin
              for a new link.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.joinButton,
                pressed && styles.joinButtonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.joinButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Text style={styles.closeButtonText}>{'\u00D7'}</Text>
        </Pressable>

        <View style={styles.joinCard}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{'\uD83D\uDC65'}</Text>
          </View>

          <Text style={styles.heading}>Join Group</Text>
          <Text style={styles.subheading}>
            {"You've been invited to join a group on BillSplit."}
          </Text>

          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Invite code</Text>
            <Text style={styles.codeValue}>{code ?? '--------'}</Text>
          </View>

          {/* Group preview */}
          <View style={styles.groupPreview}>
            <Text style={styles.groupPreviewName}>{group?.name}</Text>
            <Text style={styles.groupPreviewMembers}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>

          {alreadyMember ? (
            <View style={styles.actions}>
              <Text style={styles.alreadyMemberText}>
                You are already a member of this group.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.joinButton,
                  pressed && styles.joinButtonPressed,
                ]}
                onPress={handleGoToGroup}
              >
                <Text style={styles.joinButtonText}>Open Group</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.actions}>
              {/* Name input for anonymous join */}
              {showNameInput && (
                <View style={styles.nameInputContainer}>
                  <Text style={styles.nameInputLabel}>Your display name</Text>
                  <TextInput
                    style={styles.nameInput}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Enter your name"
                    placeholderTextColor={Colors.textTertiary}
                    autoFocus
                    maxLength={30}
                    returnKeyType="done"
                    onSubmitEditing={handleJoinAnonymous}
                  />
                </View>
              )}

              {isAuthenticated && !showNameInput && (
                <Pressable
                  style={({ pressed }) => [
                    styles.joinButton,
                    pressed && !isJoining && styles.joinButtonPressed,
                    isJoining && styles.buttonDisabled,
                  ]}
                  onPress={handleJoinAuthenticated}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <ActivityIndicator color={Colors.textInverse} />
                  ) : (
                    <Text style={styles.joinButtonText}>Join Group</Text>
                  )}
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  showNameInput ? styles.joinButton : styles.joinAnonymousButton,
                  pressed &&
                    !isJoining &&
                    (showNameInput
                      ? styles.joinButtonPressed
                      : styles.joinAnonymousButtonPressed),
                  isJoining && styles.buttonDisabled,
                ]}
                onPress={handleJoinAnonymous}
                disabled={isJoining}
              >
                {isJoining && showNameInput ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <Text
                    style={
                      showNameInput
                        ? styles.joinButtonText
                        : styles.joinAnonymousText
                    }
                  >
                    {showNameInput ? 'Join Group' : 'Join without an account'}
                  </Text>
                )}
              </Pressable>

              {showNameInput && (
                <Pressable
                  style={styles.cancelNameButton}
                  onPress={() => {
                    setShowNameInput(false);
                    setDisplayName('');
                  }}
                >
                  <Text style={styles.cancelNameText}>Cancel</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {!alreadyMember && !showNameInput && (
          <Text style={styles.disclaimer}>
            You can claim items and split bills with just a name.
            {'\n'}Create an account later to track your history.
          </Text>
        )}
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
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
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
    zIndex: 10,
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
  buttonDisabled: {
    opacity: 0.5,
  },
  alreadyMemberText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  nameInputContainer: {
    width: '100%',
    marginBottom: 4,
  },
  nameInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelNameButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelNameText: {
    fontSize: 14,
    color: Colors.textTertiary,
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
