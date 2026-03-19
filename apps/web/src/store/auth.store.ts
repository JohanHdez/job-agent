import { create } from 'zustand';

/** Authenticated user shape */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  photo?: string;
  headline?: string;
  providers: {
    linkedin: boolean;
    google: boolean;
  };
}

/** Zustand slice for authentication state */
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  /**
   * True once the initial silent-refresh attempt has completed (success OR failure).
   * Route guards must wait for this before deciding to redirect.
   */
  isInitialized: boolean;
  /** Store only the access token — refresh token lives in httpOnly cookie */
  setAccessToken: (at: string) => void;
  /** Store the authenticated user returned by /auth/me */
  setUser: (u: AuthUser) => void;
  /** Clear all auth state (logout) */
  logout: () => void;
  /** Toggle the global loading indicator */
  setLoading: (v: boolean) => void;
  /** Mark the auth check as complete so route guards can act */
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isInitialized: false,

  setAccessToken: (at: string) => set({ accessToken: at }),

  setUser: (u: AuthUser) => set({ user: u }),

  logout: () => set({ user: null, accessToken: null }),

  setLoading: (v: boolean) => set({ isLoading: v }),

  setInitialized: () => set({ isInitialized: true }),
}));
