import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ClaimCheckbox } from './ClaimCheckbox';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../services/currency';
import type { LineItemWithClaims, GroupMemberWithProfile } from '../../types/database';

interface LineItemRowProps {
  item: LineItemWithClaims;
  currency: string;
  myMemberId: string | null;
  members: GroupMemberWithProfile[];
  onToggleClaim: (lineItemId: string, currentlyClaimed: boolean) => void;
}

/** Generate a stable color from a string (member ID). */
function memberColor(id: string): string {
  const palette = [
    '#448AFF', '#FF5252', '#FFB74D', '#AB47BC',
    '#26A69A', '#EF5350', '#7E57C2', '#42A5F5',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

/** Get the initials (1-2 chars) of a display name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function LineItemRow({
  item,
  currency,
  myMemberId,
  members,
  onToggleClaim,
}: LineItemRowProps) {
  const myClaim = myMemberId
    ? item.claims.find((c) => c.group_member_id === myMemberId)
    : null;
  const isClaimed = !!myClaim;
  const claimCount = item.claims.length;

  // Build member name lookup
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Claimant names for subtitle
  const claimantNames = item.claims
    .map((c) => {
      const member = memberMap.get(c.group_member_id);
      if (!member) return null;
      if (c.group_member_id === myMemberId) return 'You';
      return member.display_name.split(' ')[0];
    })
    .filter(Boolean);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
      onPress={() => onToggleClaim(item.id, isClaimed)}
    >
      <ClaimCheckbox
        checked={isClaimed}
        onToggle={() => onToggleClaim(item.id, isClaimed)}
      />

      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={styles.description} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.price}>
            {formatCurrency(item.total_price, currency)}
          </Text>
        </View>

        <View style={styles.bottomLine}>
          {claimCount > 0 ? (
            <View style={styles.claimants}>
              {/* Avatar circles */}
              <View style={styles.avatarRow}>
                {item.claims.slice(0, 4).map((claim, index) => {
                  const member = memberMap.get(claim.group_member_id);
                  const isMe = claim.group_member_id === myMemberId;
                  const name = member?.display_name ?? '?';
                  return (
                    <View
                      key={claim.id}
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: isMe
                            ? Colors.accent
                            : memberColor(claim.group_member_id),
                          marginLeft: index > 0 ? -6 : 0,
                          zIndex: item.claims.length - index,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          isMe && styles.avatarTextMe,
                        ]}
                      >
                        {getInitials(name)}
                      </Text>
                    </View>
                  );
                })}
                {claimCount > 4 && (
                  <View style={[styles.avatar, styles.avatarOverflow, { marginLeft: -6 }]}>
                    <Text style={styles.avatarOverflowText}>
                      +{claimCount - 4}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.claimantNames} numberOfLines={1}>
                {claimantNames.join(', ')}
              </Text>
            </View>
          ) : (
            <Text style={styles.unclaimed}>Unclaimed</Text>
          )}

          {/* Quantity badge when item.quantity > 1 */}
          {item.quantity > 1 && (
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityText}>x{item.quantity}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  rowPressed: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 10,
  },
  content: {
    flex: 1,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  price: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  claimants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.white,
  },
  avatarTextMe: {
    color: Colors.textInverse,
  },
  avatarOverflow: {
    backgroundColor: Colors.surfaceTertiary,
  },
  avatarOverflowText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  claimantNames: {
    fontSize: 13,
    color: Colors.textTertiary,
    flex: 1,
  },
  unclaimed: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  quantityBadge: {
    backgroundColor: Colors.surfaceTertiary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  quantityText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
