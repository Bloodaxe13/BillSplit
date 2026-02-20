import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../services/currency';
import type {
  LineItemWithClaims,
  GroupMemberWithProfile,
} from '../../types/database';

interface PayerAssignViewProps {
  lineItems: LineItemWithClaims[];
  currency: string;
  members: GroupMemberWithProfile[];
  myMemberId: string;
  onAssign: (lineItemId: string, memberId: string) => void;
  onUnassign: (lineItemId: string, memberId: string) => void;
  onNudge: () => void;
}

/** Generate a stable color from a string. */
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PayerAssignView({
  lineItems,
  currency,
  members,
  myMemberId,
  onAssign,
  onUnassign,
  onNudge,
}: PayerAssignViewProps) {
  const unclaimedItems = lineItems.filter((li) => li.claims.length === 0);
  const claimedItems = lineItems.filter((li) => li.claims.length > 0);
  const memberMap = new Map(members.map((m) => [m.id, m]));

  function handleAssignPress(lineItemId: string) {
    Alert.alert(
      'Assign to member',
      'Who had this item?',
      members
        .map((m) => ({
          text: m.display_name,
          onPress: () => onAssign(lineItemId, m.id),
        }))
        .concat([{ text: 'Cancel', onPress: () => {}, style: 'cancel' } as any])
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Assign Items</Text>
          <Text style={styles.subtitle}>
            Tap unclaimed items to assign them
          </Text>
        </View>
        {unclaimedItems.length > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.nudgeButton,
              pressed && styles.nudgeButtonPressed,
            ]}
            onPress={onNudge}
          >
            <Ionicons name="notifications-outline" size={14} color={Colors.textInverse} />
            <Text style={styles.nudgeText}>Nudge</Text>
          </Pressable>
        )}
      </View>

      {/* Member chips — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.memberChips}
      >
        {members.map((m) => {
          const isMe = m.id === myMemberId;
          const color = isMe ? Colors.accent : memberColor(m.id);
          return (
            <View
              key={m.id}
              style={[styles.memberChip, { borderColor: color }]}
            >
              <View style={[styles.chipAvatar, { backgroundColor: color }]}>
                <Text style={styles.chipAvatarText}>
                  {getInitials(m.display_name)}
                </Text>
              </View>
              <Text style={styles.chipName} numberOfLines={1}>
                {isMe ? 'You' : m.display_name.split(' ')[0]}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Unclaimed section */}
      {unclaimedItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Unclaimed ({unclaimedItems.length})
          </Text>
          {unclaimedItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.assignRow,
                styles.assignRowUnclaimed,
                pressed && styles.assignRowPressed,
              ]}
              onPress={() => handleAssignPress(item.id)}
            >
              <View style={styles.assignContent}>
                <Text style={styles.assignDescription} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.assignPrice}>
                  {formatCurrency(item.total_price, currency)}
                </Text>
              </View>
              <View style={styles.assignActionBadge}>
                <Text style={styles.assignActionText}>Assign</Text>
                <Ionicons name="add-circle-outline" size={14} color={Colors.accent} />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Claimed section */}
      {claimedItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Claimed ({claimedItems.length})
          </Text>
          {claimedItems.map((item) => (
            <View key={item.id} style={styles.assignRow}>
              <View style={styles.assignContent}>
                <Text style={styles.assignDescription} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.assignPrice}>
                  {formatCurrency(item.total_price, currency)}
                </Text>
              </View>
              <View style={styles.assignClaimants}>
                {item.claims.map((claim) => {
                  const member = memberMap.get(claim.group_member_id);
                  if (!member) return null;
                  const isMe = claim.group_member_id === myMemberId;
                  const color = isMe ? Colors.accent : memberColor(claim.group_member_id);
                  return (
                    <Pressable
                      key={claim.id}
                      style={[
                        styles.claimantChip,
                        { backgroundColor: `${color}14` },
                      ]}
                      onLongPress={() =>
                        onUnassign(item.id, claim.group_member_id)
                      }
                    >
                      <Text style={[styles.claimantChipText, { color }]}>
                        {isMe
                          ? 'You'
                          : member.display_name.split(' ')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  nudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nudgeButtonPressed: {
    opacity: 0.8,
  },
  nudgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  memberChips: {
    gap: 8,
    paddingVertical: 4,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 24,
    paddingRight: 14,
    paddingLeft: 4,
    paddingVertical: 4,
    borderWidth: 1.5,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  chipName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    maxWidth: 80,
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 6,
  },
  assignRowUnclaimed: {
    borderColor: Colors.warning,
    borderStyle: 'dashed' as any,
  },
  assignRowPressed: {
    backgroundColor: Colors.surfacePrimary,
  },
  assignContent: {
    flex: 1,
  },
  assignDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  assignPrice: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  assignActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 12,
  },
  assignActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  assignClaimants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginLeft: 12,
    maxWidth: 160,
  },
  claimantChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  claimantChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
