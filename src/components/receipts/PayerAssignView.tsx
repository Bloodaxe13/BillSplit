import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
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

  // When payer taps an unclaimed item, show member picker
  function handleAssignPress(lineItemId: string) {
    const options = members.map((m) => m.display_name);
    options.push('Cancel');

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
        <Text style={styles.title}>Assign Items</Text>
        {unclaimedItems.length > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.nudgeButton,
              pressed && styles.nudgeButtonPressed,
            ]}
            onPress={onNudge}
          >
            <Text style={styles.nudgeText}>Nudge All</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.subtitle}>
        Tap unclaimed items to assign them to group members
      </Text>

      {/* Member chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.memberChips}
      >
        {members.map((m) => {
          const isMe = m.id === myMemberId;
          return (
            <View
              key={m.id}
              style={[
                styles.memberChip,
                { borderColor: isMe ? Colors.accent : memberColor(m.id) },
              ]}
            >
              <View
                style={[
                  styles.chipAvatar,
                  {
                    backgroundColor: isMe
                      ? Colors.accent
                      : memberColor(m.id),
                  },
                ]}
              >
                <Text style={[styles.chipAvatarText, isMe && styles.chipAvatarTextMe]}>
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
              <Text style={styles.assignAction}>Assign</Text>
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
                  return (
                    <Pressable
                      key={claim.id}
                      style={[
                        styles.claimantChip,
                        {
                          backgroundColor: isMe
                            ? Colors.accentSurface
                            : `${memberColor(claim.group_member_id)}20`,
                        },
                      ]}
                      onLongPress={() =>
                        onUnassign(item.id, claim.group_member_id)
                      }
                    >
                      <Text
                        style={[
                          styles.claimantChipText,
                          {
                            color: isMe
                              ? Colors.accent
                              : memberColor(claim.group_member_id),
                          },
                        ]}
                      >
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: -4,
  },
  nudgeButton: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
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
    gap: 6,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 20,
    paddingRight: 12,
    paddingLeft: 3,
    paddingVertical: 3,
    borderWidth: 1,
  },
  chipAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  chipAvatarTextMe: {
    color: Colors.textInverse,
  },
  chipName: {
    fontSize: 13,
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
    marginBottom: 6,
    marginTop: 8,
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  assignRowUnclaimed: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    paddingLeft: 12,
  },
  assignRowPressed: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 8,
  },
  assignContent: {
    flex: 1,
  },
  assignDescription: {
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  assignPrice: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  assignAction: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
    marginLeft: 12,
  },
  assignClaimants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginLeft: 12,
    maxWidth: 160,
  },
  claimantChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  claimantChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
