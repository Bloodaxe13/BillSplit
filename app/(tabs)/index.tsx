import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { GroupCard } from '../../src/components/groups/GroupCard';
import { CreateGroupModal } from '../../src/components/groups/CreateGroupModal';
import { fetchMyGroups } from '../../src/services/groups';
import { useAuth } from '../../src/contexts/AuthContext';
import type { GroupPreview, Group } from '../../src/types/database';

export default function HomeScreen() {
  const { isAuthenticated } = useAuth();
  const [groups, setGroups] = useState<GroupPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!isAuthenticated) {
      setGroups([]);
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchMyGroups();
      setGroups(data);
    } catch {
      // Silently fail — groups will show as empty
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadGroups();
    setIsRefreshing(false);
  }

  function handleGroupCreated(_group: Group) {
    // Reload the list to include the new group
    loadGroups();
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Groups</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <Pressable
          style={({ pressed }) => [
            styles.newGroupButton,
            pressed && styles.newGroupButtonPressed,
          ]}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.newGroupButtonText}>+ New</Text>
        </Pressable>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GroupCard group={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a group to start splitting bills with friends.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.emptyButtonPressed,
              ]}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.emptyButtonText}>Create Group</Text>
            </Pressable>
          </View>
        }
      />

      <CreateGroupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGroupCreated={handleGroupCreated}
      />
    </SafeAreaView>
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
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  newGroupButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newGroupButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  newGroupButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonPressed: {
    backgroundColor: Colors.accentMuted,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
