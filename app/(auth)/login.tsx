import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/contexts/AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = isGoogleLoading || isAppleLoading;

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e.message ?? 'Failed to sign in with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setError(null);
    setIsAppleLoading(true);
    try {
      await signInWithApple();
    } catch (e: any) {
      setError(e.message ?? 'Failed to sign in with Apple');
    } finally {
      setIsAppleLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Branding */}
        <View style={styles.brandingSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="receipt-outline" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.appName}>BillSplit</Text>
          <Text style={styles.tagline}>Split receipts, not friendships.</Text>
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.negative} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Social sign-in buttons */}
        <View style={styles.authButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.authButton,
              styles.googleButton,
              pressed && styles.authButtonPressed,
              isLoading && styles.authButtonDisabled,
            ]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={22} color={Colors.textPrimary} />
                <Text style={styles.authButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {Platform.OS === 'ios' ? (
            <Pressable
              style={({ pressed }) => [
                styles.authButton,
                styles.appleButton,
                pressed && styles.authButtonPressed,
                isLoading && styles.authButtonDisabled,
              ]}
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              {isAppleLoading ? (
                <ActivityIndicator size="small" color={Colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={22} color={Colors.textPrimary} />
                  <Text style={styles.authButtonText}>Continue with Apple</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  brandingSection: {
    alignItems: 'center',
    marginBottom: 56,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.10)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.negative,
    lineHeight: 20,
  },
  authButtons: {
    gap: 14,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 12,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: Colors.surfacePrimary,
    borderColor: Colors.border,
  },
  appleButton: {
    backgroundColor: Colors.surfacePrimary,
    borderColor: Colors.border,
  },
  authButtonPressed: {
    backgroundColor: Colors.surfaceSecondary,
  },
  authButtonDisabled: {
    opacity: 0.5,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  terms: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
