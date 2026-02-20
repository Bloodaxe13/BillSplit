import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
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
      {/* Color accent bar */}
      <View
        style={[
          styles.accentBar,
          hasBalance && {
            backgroundColor: isPositive ? Colors.positive : Colors.negative,
          },
        ]}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.currency}>{group.default_currency}</Text>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.memberCount}>
            {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
          </Text>

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

      <View style={styles.arrow}>
        <Text style={styles.arrowText}>&rsaquo;</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: Colors.surfaceTertiary,
  },
  content: {
    flex: 1,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  currency: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    backgroundColor: Colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  balance: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceSettled: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  arrow: {
    paddingRight: 16,
  },
  arrowText: {
    fontSize: 24,
    color: Colors.textTertiary,
    fontWeight: '300',
  },
});
