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
  refreshToken: string | null;
  isLoading: boolean;
  /** Persist both JWT tokens after OAuth redirect */
  setTokens: (at: string, rt: string) => void;
  /** Store the authenticated user returned by /auth/me */
  setUser: (u: AuthUser) => void;
  /** Clear all auth state (logout) */
  logout: () => void;
  /** Toggle the global loading indicator */
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,

  setTokens: (at: string, rt: string) =>
    set({ accessToken: at, refreshToken: rt }),

  setUser: (u: AuthUser) => set({ user: u }),

  logout: () =>
    set({ user: null, accessToken: null, refreshToken: null }),

  setLoading: (v: boolean) => set({ isLoading: v }),
}));
