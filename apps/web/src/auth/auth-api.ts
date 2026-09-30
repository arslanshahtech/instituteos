import { apiRequest } from '../api/client.js';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  status: 'pending_verification' | 'active' | 'disabled';
  emailVerifiedAt: string | null;
  createdAt: string;
}

interface UserResponse {
  user: AuthUser;
}

export interface RegistrationResponse {
  verificationRequired: boolean;
  message: string;
}

export function getCurrentUser(): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/me');
}

export function loginRequest(input: {
  email: string;
  password: string;
}): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function registerRequest(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<RegistrationResponse> {
  return apiRequest<RegistrationResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logoutRequest(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}

export function forgotPasswordRequest(
  email: string,
): Promise<{ message: string }> {
  return apiRequest('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordRequest(input: {
  token: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return apiRequest('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function verifyEmailRequest(token: string): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function resendVerificationRequest(
  email: string,
): Promise<{ message: string }> {
  return apiRequest('/auth/email/verification/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}
