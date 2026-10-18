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
    retry: false,
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
        await queryClient.cancelQueries({ queryKey: CURRENT_USER_KEY });
        const result = await loginRequest(input);
        queryClient.setQueryData(CURRENT_USER_KEY, result.user);
      },
      async register(input) {
        return registerRequest(input);
      },
      async logout() {
        // Cancel an in-flight session bootstrap so it cannot restore stale
        // authenticated data after the logout request has completed.
        await queryClient.cancelQueries({ queryKey: CURRENT_USER_KEY });
        await logoutRequest();
        queryClient.setQueryData(CURRENT_USER_KEY, null);
      },
      forgotPassword: forgotPasswordRequest,
      resendVerification: resendVerificationRequest,
      resetPassword: resetPasswordRequest,
      async verifyEmail(token) {
        await queryClient.cancelQueries({ queryKey: CURRENT_USER_KEY });
        const result = await verifyEmailRequest(token);
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
