import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

// Ensure the web browser auth session is completed when returning to the app
WebBrowser.maybeCompleteAuthSession();

/**
 * Sign in with Google using Supabase OAuth + WebBrowser.
 * Supabase handles the Google redirect (HTTPS), then redirects back to our app.
 * This works in Expo Go because Google only sees the Supabase callback URL.
 */
export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success' && result.url) {
    try {
      const url = new URL(result.url);
      const hash = url.hash;
      if (hash && hash.length > 1) {
        // Supabase puts tokens in the URL fragment
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    } catch (err) {
      console.error('Auth: Failed to process auth callback URL:', err);
    }
  }
}

/**
 * Sign in with Apple using the native iOS flow.
 * Uses expo-apple-authentication for the native credential request,
 * then exchanges the ID token with Supabase.
 */
export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS');
  }

  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('No identity token returned from Apple');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce,
  });

  if (error) throw error;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
