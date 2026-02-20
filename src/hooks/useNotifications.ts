/**
 * Hook to manage push notification lifecycle in BillSplit.
 *
 * - Registers for push notifications on mount (when authenticated)
 * - Saves the Expo push token to the user's profile
 * - Handles incoming notifications (foreground + tap-to-open)
 * - Navigates to the relevant screen based on notification data
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import type { EventSubscription } from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import {
  registerForPushNotifications,
  savePushToken,
} from '../services/notifications';

// ---------------------------------------------------------------------------
// Foreground notification behaviour
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationData {
  type?: string;
  receipt_id?: string;
  group_id?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications(): void {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);

  // Navigate to the appropriate screen based on notification data
  const handleNotificationNavigation = useCallback(
    (data: NotificationData) => {
      switch (data.type) {
        case 'receipt_added':
        case 'unclaimed_items':
          if (data.receipt_id && data.group_id) {
            router.push(`/group/${data.group_id}/receipt/${data.receipt_id}` as never);
          }
          break;
        case 'debt_settled':
          if (data.group_id) {
            router.push(`/group/${data.group_id}/debts` as never);
          }
          break;
        default:
          break;
      }
    },
    [router],
  );

  // Register for push notifications when user authenticates
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let cancelled = false;

    async function register() {
      const token = await registerForPushNotifications();
      if (token && !cancelled) {
        await savePushToken(token);
      }
    }

    register();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  // Set up notification listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fired when a notification is received while the app is in the foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received (foreground):', notification.request.content.title);
      },
    );

    // Fired when the user taps on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationData;
        handleNotificationNavigation(data);
      },
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
    };
  }, [isAuthenticated, handleNotificationNavigation]);

  // Check if the app was opened from a killed state via a notification
  useEffect(() => {
    if (!isAuthenticated) return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as NotificationData;
        handleNotificationNavigation(data);
      }
    });
  }, [isAuthenticated, handleNotificationNavigation]);
}
