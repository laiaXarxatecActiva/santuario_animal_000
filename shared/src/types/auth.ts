import type { Role } from '../constants/roles.js';

// Usuario de la sesión actual (`GET /api/auth/me`, login y registro).
export interface SessionUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}

export interface SessionResponse {
  user: SessionUser | null;
}

// CU-08: resultado de verificar el email.
export interface VerifyEmailResponse {
  status: 'verified' | 'already_verified';
}

// Respuesta neutra de CU-10 y respuestas que solo informan.
export interface MessageResponse {
  message: string;
}
