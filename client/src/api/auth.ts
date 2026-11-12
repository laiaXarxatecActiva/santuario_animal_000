import type {
  ForgotPasswordInput,
  LoginInput,
  MessageResponse,
  RegisterInput,
  ResetPasswordInput,
  SessionResponse,
  SessionUser,
  VerifyEmailResponse,
} from '@sanctuary/shared';
import { apiGet, apiPost } from './client';

// Autenticación (TECH_SPEC §10.2).
export const authApi = {
  me: () => apiGet<SessionResponse>('/api/auth/me').then((r) => r.user),
  register: (datos: RegisterInput) => apiPost<{ user: SessionUser }>('/api/auth/register', datos).then((r) => r.user),
  login: (datos: LoginInput) => apiPost<{ user: SessionUser }>('/api/auth/login', datos).then((r) => r.user),
  logout: () => apiPost('/api/auth/logout'),
  verifyEmail: (token: string) => apiPost<VerifyEmailResponse>('/api/auth/verify-email', { token }),
  resendVerification: () => apiPost('/api/auth/resend-verification'),
  forgotPassword: (datos: ForgotPasswordInput) => apiPost<MessageResponse>('/api/auth/forgot-password', datos),
  resetPassword: (datos: ResetPasswordInput) => apiPost('/api/auth/reset-password', datos),
};
