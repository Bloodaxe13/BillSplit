import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { Colors } from '../src/constants/colors';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && needsOnboarding) {
      // First-time user needs to set display name and currency
      if (segments[0] !== '(auth)' || segments[1] !== 'signup') {
        router.replace('/(auth)/signup');
      }
    } else if (isAuthenticated && !needsOnboarding && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, needsOnboarding, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="(auth)"
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="group/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="receipt/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="join/[code]"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
