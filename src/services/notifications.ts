/**
 * Push notification service for BillSplit.
 *
 * Handles Expo push token registration, storing tokens in the profiles table,
 * and invoking the send-notification edge function.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Push token registration
// ---------------------------------------------------------------------------

/**
 * Request notification permissions and obtain the Expo push token.
 * Returns null if permissions are denied or the device is a simulator.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied.');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'BillSplit',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C5CE7',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;

  if (!projectId) {
    console.error('Missing EAS project ID — cannot register for push notifications.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (err) {
    // Fails on simulators and devices without Google Play Services
    console.error('Failed to get push token:', err);
    return null;
  }
}

/**
 * Store the push token in the current user's profile row.
 */
export async function savePushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to save push token:', error.message);
  }
}

/**
 * Clear the push token from the current user's profile (e.g. on sign-out).
 */
export async function clearPushToken(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('profiles')
    .update({ push_token: null })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to clear push token:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Send notifications via edge function
// ---------------------------------------------------------------------------

/**
 * Send a push notification to one or more users by invoking the
 * send-notification Supabase edge function.
 *
 * @param recipientUserIds - Auth user IDs (not group_member IDs) to notify
 * @param payload - Notification title, body, and optional data
 */
export async function sendNotification(
  recipientUserIds: string[],
  payload: NotificationPayload,
): Promise<void> {
  if (recipientUserIds.length === 0) return;

  const { error } = await supabase.functions.invoke('send-notification', {
    body: {
      recipient_user_ids: recipientUserIds,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    },
  });

  if (error) {
    console.error('Failed to send notification:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Notification trigger helpers
// ---------------------------------------------------------------------------

/**
 * Notify group members that a new receipt was added.
 * Called after receipt processing completes.
 *
 * @param groupId - The group the receipt belongs to
 * @param payerUserId - Auth user ID of the payer (excluded from recipients)
 * @param vendorName - Vendor name from the processed receipt
 * @param receiptId - Receipt ID for deep linking
 * @param payerDisplayName - Display name of the payer
 */
export async function notifyReceiptAdded(
  groupId: string,
  payerUserId: string,
  vendorName: string,
  receiptId: string,
  payerDisplayName: string,
): Promise<void> {
  // Get all group members with linked user accounts, excluding the payer
  const { data: members, error } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .not('user_id', 'is', null)
    .neq('user_id', payerUserId);

  if (error || !members) {
    console.error('Failed to fetch group members for notification:', error?.message);
    return;
  }

  const recipientIds = members
    .map((m) => m.user_id)
    .filter((id): id is string => id !== null);

  await sendNotification(recipientIds, {
    title: 'New Receipt',
    body: `${payerDisplayName} added a receipt from ${vendorName}`,
    data: { type: 'receipt_added', receipt_id: receiptId, group_id: groupId },
  });
}

/**
 * Remind group members who haven't claimed items on a receipt.
 *
 * @param receiptId - Receipt to check for unclaimed items
 * @param vendorName - Vendor name for the notification body
 * @param groupId - Group the receipt belongs to
 */
export async function notifyUnclaimedItems(
  receiptId: string,
  vendorName: string,
  groupId: string,
): Promise<void> {
  // Get all group members with accounts
  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('id, user_id')
    .eq('group_id', groupId)
    .not('user_id', 'is', null);

  if (membersError || !members) {
    console.error('Failed to fetch group members:', membersError?.message);
    return;
  }

  // Get members who have already claimed at least one item
  const { data: claims, error: claimsError } = await supabase
    .from('line_item_claims')
    .select('group_member_id, line_items!inner(receipt_id)')
    .eq('line_items.receipt_id', receiptId);

  if (claimsError) {
    console.error('Failed to fetch claims:', claimsError.message);
    return;
  }

  const claimedMemberIds = new Set(
    (claims ?? []).map((c) => c.group_member_id),
  );

  // Members who haven't claimed anything
  const unclaimedMembers = members.filter(
    (m) => !claimedMemberIds.has(m.id) && m.user_id !== null,
  );

  const recipientIds = unclaimedMembers
    .map((m) => m.user_id)
    .filter((id): id is string => id !== null);

  await sendNotification(recipientIds, {
    title: 'Unclaimed Items',
    body: `You have unclaimed items on the ${vendorName} receipt`,
    data: { type: 'unclaimed_items', receipt_id: receiptId, group_id: groupId },
  });
}

/**
 * Notify a creditor that a debt has been settled.
 *
 * @param creditorUserId - Auth user ID of the person who was owed
 * @param settlerDisplayName - Display name of the person who settled
 * @param groupId - Group the debt belongs to
 */
export async function notifyDebtSettled(
  creditorUserId: string,
  settlerDisplayName: string,
  groupId: string,
): Promise<void> {
  await sendNotification([creditorUserId], {
    title: 'Debt Settled',
    body: `${settlerDisplayName} settled a debt with you`,
    data: { type: 'debt_settled', group_id: groupId },
  });
}
