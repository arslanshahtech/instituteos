import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client.js';
import {
  forgotPasswordRequest,
  getCurrentUser,
  loginRequest,
  logoutRequest,
  registerRequest,
  resendVerificationRequest,
  resetPasswordRequest,
  updateProfileRequest,
  verifyEmailRequest,
} from './auth-api.js';
import type { AuthUser, RegistrationResponse } from './auth-api.js';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: Error | null;
  login(input: { email: string; password: string }): Promise<void>;
  register(input: {
    email: string;
    displayName: string;
    password: string;
  }): Promise<RegistrationResponse>;
  logout(): Promise<void>;
  updateProfile(input: { displayName: string }): Promise<void>;
  forgotPassword(email: string): Promise<{ message: string }>;
  resetPassword(input: {
    token: string;
    newPassword: string;
  }): Promise<{ message: string }>;
  verifyEmail(token: string): Promise<void>;
  resendVerification(email: string): Promise<{ message: string }>;
  retryBootstrap(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const CURRENT_USER_KEY = ['auth', 'current-user'] as const;

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const currentUser = useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: async () => {
      try {
        return (await getCurrentUser()).user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    // Keep session bootstrap bounded so a stopped database cannot leave
    // users on an endless loading screen. Retry transient failures twice.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status < 500) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const value = useMemo<AuthContextValue>(() => {
    const user = currentUser.data ?? null;
    const status: AuthStatus = currentUser.isPending
      ? 'loading'
      : currentUser.isError
        ? 'error'
        : user
          ? 'authenticated'
          : 'anonymous';
    return {
      status,
      user,
      error: currentUser.error,
      async login(input) {
        await queryClient.cancelQueries();
        const result = await loginRequest(input);
        // A successful sign-in may switch accounts. Remove cached organization
        // and role-scoped data before exposing the newly authenticated user.
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== 'auth',
        });
        queryClient.setQueryData(CURRENT_USER_KEY, result.user);
      },
      async register(input) {
        return registerRequest(input);
      },
      async updateProfile(input) {
        const result = await updateProfileRequest(input);
        queryClient.setQueryData(CURRENT_USER_KEY, result.user);
        return;
      },
      async logout() {
        // Cancel in-flight requests and clear all user-scoped cache entries so
        // a later account cannot see another member's previously loaded data.
        await queryClient.cancelQueries();
        await logoutRequest();
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== 'auth',
        });
        queryClient.setQueryData(CURRENT_USER_KEY, null);
      },
      forgotPassword: forgotPasswordRequest,
      resendVerification: resendVerificationRequest,
      resetPassword: resetPasswordRequest,
      async verifyEmail(token) {
        await queryClient.cancelQueries();
        const result = await verifyEmailRequest(token);
        // Email verification establishes a session and can change the active
        // identity, so no previously cached workspace data may survive it.
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== 'auth',
        });
        queryClient.setQueryData(CURRENT_USER_KEY, result.user);
      },
      async retryBootstrap() {
        await currentUser.refetch();
      },
    };
  }, [
    currentUser.data,
    currentUser.error,
    currentUser.isError,
    currentUser.isPending,
    queryClient,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
