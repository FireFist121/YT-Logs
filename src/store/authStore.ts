import { create } from 'zustand';

export interface UserProfile {
  email: string;
  name: string;
  picture: string;
  channelId?: string;
  channelName?: string;
  channelPicture?: string;
}

interface AuthState {
  accessToken: string | null;
  tokenExpiry: number | null; // Unix timestamp (ms)
  user: UserProfile | null;
  isAuthenticated: boolean;

  setToken: (token: string, expiresIn: number) => void;
  setUser: (user: UserProfile) => void;
  logout: () => void;
  isTokenValid: () => boolean;
}

const USER_KEY = 'yt_mod_user';
const TOKEN_KEY = 'yt_mod_token';
const EXPIRY_KEY = 'yt_mod_expiry';

function loadPersistedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  const initialToken = localStorage.getItem(TOKEN_KEY);
  const initialExpiry = localStorage.getItem(EXPIRY_KEY) ? Number(localStorage.getItem(EXPIRY_KEY)) : null;
  const initialUser = loadPersistedUser();
  const initialAuth = !!initialToken && !!initialExpiry && Date.now() < initialExpiry - 60_000;

  return {
    accessToken: initialAuth ? initialToken : null,
    tokenExpiry: initialAuth ? initialExpiry : null,
    user: initialAuth ? initialUser : null,
    isAuthenticated: initialAuth,

    setToken: (token, expiresIn) => {
      const expiry = Date.now() + expiresIn * 1000;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(EXPIRY_KEY, expiry.toString());
      set({ accessToken: token, tokenExpiry: expiry, isAuthenticated: true });
    },

    setUser: (user) => {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user });
    },

    logout: () => {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EXPIRY_KEY);
      set({ accessToken: null, tokenExpiry: null, user: null, isAuthenticated: false });
    },

    isTokenValid: () => {
      const { accessToken, tokenExpiry } = get();
      return !!accessToken && !!tokenExpiry && Date.now() < tokenExpiry - 60_000;
    },
  };
});
