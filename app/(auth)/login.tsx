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
            <Ionicons name="receipt-outline" size={44} color={Colors.accent} />
          </View>
          <Text style={styles.appName}>BillSplit</Text>
          <Text style={styles.tagline}>Split bills. Not friendships.</Text>
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
              pressed && styles.googleButtonPressed,
              isLoading && styles.authButtonDisabled,
            ]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {Platform.OS === 'ios' ? (
            <Pressable
              style={({ pressed }) => [
                styles.authButton,
                styles.appleButton,
                pressed && styles.appleButtonPressed,
                isLoading && styles.authButtonDisabled,
              ]}
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              {isAppleLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
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
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  brandingSection: {
    alignItems: 'center',
    marginBottom: 64,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 17,
    color: Colors.textSecondary,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
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
    height: 56,
    gap: 12,
  },
  googleButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonPressed: {
    backgroundColor: Colors.surfacePrimary,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonPressed: {
    backgroundColor: '#1A1A1A',
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  authButtonDisabled: {
    opacity: 0.5,
  },
  terms: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 36,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
