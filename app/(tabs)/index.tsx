import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';

/** Placeholder data for the groups list */
const PLACEHOLDER_GROUPS = [
  { id: '1', name: 'Bali 2026', memberCount: 8, currency: 'IDR' },
  { id: '2', name: 'Tokyo Weekend', memberCount: 4, currency: 'JPY' },
  { id: '3', name: 'Flat Expenses', memberCount: 3, currency: 'AUD' },
];

interface GroupCardProps {
  id: string;
  name: string;
  memberCount: number;
  currency: string;
}

function GroupCard({ id, name, memberCount, currency }: GroupCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.groupCard,
        pressed && styles.groupCardPressed,
      ]}
      onPress={() => router.push(`/group/${id}`)}
    >
      <View style={styles.groupCardContent}>
        <Text style={styles.groupName}>{name}</Text>
        <Text style={styles.groupMeta}>
          {memberCount} members  {currency}
        </Text>
      </View>
      <View style={styles.groupCardArrow}>
        <Text style={styles.arrowText}>&rsaquo;</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <Pressable
          style={({ pressed }) => [
            styles.newGroupButton,
            pressed && styles.newGroupButtonPressed,
          ]}
        >
          <Text style={styles.newGroupButtonText}>+ New</Text>
        </Pressable>
      </View>

      <FlatList
        data={PLACEHOLDER_GROUPS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupCard
            id={item.id}
            name={item.name}
            memberCount={item.memberCount}
            currency={item.currency}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a group to start splitting bills with friends.
            </Text>
          </View>
        }
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  groupCard: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupCardPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  groupCardContent: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  groupCardArrow: {
    marginLeft: 12,
  },
  arrowText: {
    fontSize: 24,
    color: Colors.textTertiary,
    fontWeight: '300',
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
  },
});
