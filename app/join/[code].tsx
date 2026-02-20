import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
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
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.joinCard}>
            <View style={[styles.iconContainer, styles.iconContainerError]}>
              <Ionicons name="help" size={28} color={Colors.negative} />
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
          <Ionicons name="close" size={20} color={Colors.textSecondary} />
        </Pressable>

        <View style={styles.joinCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={28} color={Colors.accent} />
          </View>

          <Text style={styles.heading}>{group?.name}</Text>
          <Text style={styles.subheading}>
            {"You've been invited to join this group on BillSplit."}
          </Text>

          {/* Group preview */}
          <View style={styles.groupPreview}>
            <View style={styles.groupPreviewRow}>
              <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.groupPreviewMembers}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <View style={styles.groupPreviewRow}>
              <Ionicons name="key-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.codeValue}>{code ?? '--------'}</Text>
            </View>
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
    backgroundColor: Colors.surfacePrimary,
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
  joinCard: {
    backgroundColor: Colors.background,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
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
  iconContainerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  groupPreview: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  groupPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  groupPreviewMembers: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
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
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
