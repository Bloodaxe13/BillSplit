import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../services/currency';
import type { GroupPreview } from '../../types/database';

interface GroupCardProps {
  group: GroupPreview;
}

export function GroupCard({ group }: GroupCardProps) {
  const hasBalance = group.my_balance !== 0;
  const isPositive = group.my_balance > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={() => router.push(`/group/${group.id}`)}
    >
      {/* Green accent icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="people" size={18} color={Colors.accent} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.currency}>{group.default_currency}</Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.memberInfo}>
            <Ionicons name="person-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.memberCount}>
              {group.member_count}
            </Text>
          </View>

          {hasBalance ? (
            <Text
              style={[
                styles.balance,
                { color: isPositive ? Colors.positive : Colors.negative },
              ]}
            >
              {isPositive ? '+' : ''}
              {formatCurrency(group.my_balance, group.default_currency)}
            </Text>
          ) : (
            <Text style={styles.balanceSettled}>Settled</Text>
          )}
        </View>
      </View>

      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardPressed: {
    backgroundColor: Colors.surfacePrimary,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    paddingVertical: 16,
    paddingLeft: 12,
    paddingRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  currency: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCount: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  balance: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceSettled: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  chevron: {
    paddingRight: 14,
  },
});
