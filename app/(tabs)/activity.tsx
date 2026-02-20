import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';

interface ActivityItem {
  id: string;
  type: 'receipt_added' | 'item_claimed' | 'debt_settled';
  description: string;
  group: string;
  timestamp: string;
}

const PLACEHOLDER_ACTIVITY: ActivityItem[] = [
  {
    id: '1',
    type: 'receipt_added',
    description: 'Dan added a receipt from Warung Babi Guling',
    group: 'Bali 2026',
    timestamp: '2 min ago',
  },
  {
    id: '2',
    type: 'item_claimed',
    description: 'Sarah claimed 3 items on "Sushi Train"',
    group: 'Tokyo Weekend',
    timestamp: '15 min ago',
  },
  {
    id: '3',
    type: 'debt_settled',
    description: 'Mike settled $42.50 with you',
    group: 'Flat Expenses',
    timestamp: '1 hr ago',
  },
];

function getActivityDot(type: ActivityItem['type']): string {
  switch (type) {
    case 'receipt_added':
      return Colors.info;
    case 'item_claimed':
      return Colors.accent;
    case 'debt_settled':
      return Colors.positive;
  }
}

interface ActivityCardProps {
  item: ActivityItem;
}

function ActivityCard({ item }: ActivityCardProps) {
  return (
    <View style={styles.activityCard}>
      <View
        style={[styles.activityDot, { backgroundColor: getActivityDot(item.type) }]}
      />
      <View style={styles.activityContent}>
        <Text style={styles.activityDescription}>{item.description}</Text>
        <View style={styles.activityMeta}>
          <Text style={styles.activityGroup}>{item.group}</Text>
          <Text style={styles.activityDivider}>&middot;</Text>
          <Text style={styles.activityTimestamp}>{item.timestamp}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      <FlatList
        data={PLACEHOLDER_ACTIVITY}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ActivityCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Activity from your groups will show up here.
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 14,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 21,
    marginBottom: 4,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityGroup: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  activityDivider: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  activityTimestamp: {
    fontSize: 13,
    color: Colors.textTertiary,
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
