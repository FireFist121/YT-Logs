import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
        };
        id: {
          initialize: (config: { client_id: string; callback: (res: CredentialResponse) => void }) => void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
  prompt?: string;
}

interface TokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
}

interface CredentialResponse {
  credential: string;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'openid',
  'email',
  'profile',
].join(' ');

// Singleton token client
let tokenClient: TokenClient | null = null;

export function getTokenClient(): TokenClient | null {
  return tokenClient;
}

export function useTokenRefresh() {
  const { tokenExpiry, isTokenValid, setToken } = useAuthStore();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tokenExpiry) return;

    // Schedule silent re-auth 5 minutes before expiry
    const msUntilRefresh = tokenExpiry - Date.now() - 5 * 60 * 1000;

    if (msUntilRefresh <= 0) {
      // Already near or past expiry — refresh immediately
      silentRefresh();
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, msUntilRefresh);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [tokenExpiry]); // eslint-disable-line react-hooks/exhaustive-deps

  function silentRefresh() {
    if (!tokenClient) {
      initTokenClient((token, expiresIn) => {
        setToken(token, expiresIn);
      });
    }
    // Request silently (no prompt if session cookie is valid)
    tokenClient?.requestAccessToken({ prompt: '' });
  }

  return { isTokenValid };
}

export function initTokenClient(
  onToken: (token: string, expiresIn: number) => void,
  onError?: (msg: string) => void
): void {
  if (!window.google?.accounts?.oauth2) {
    onError?.('Google Identity Services not loaded. Check your internet connection.');
    return;
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response: TokenResponse) => {
      if (response.error) {
        onError?.(response.error);
        return;
      }
      onToken(response.access_token, response.expires_in);
    },
    error_callback: (error) => {
      onError?.(error.type ?? 'Unknown auth error');
    },
  });
}

export function requestLogin(
  onToken: (token: string, expiresIn: number) => void,
  onError?: (msg: string) => void
): void {
  initTokenClient(onToken, onError);
  tokenClient?.requestAccessToken({ prompt: 'consent' });
}
