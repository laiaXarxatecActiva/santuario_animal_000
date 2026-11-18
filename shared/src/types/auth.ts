import type { Language } from '../constants/languages.js';
import type { Role } from '../constants/roles.js';

// Usuario de la sesión actual (`GET /api/auth/me`, login y registro).
export interface SessionUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  /**
   * Fase 3: idioma de la interfaz, los emails y los PDF. La API siempre lo
   * envía; es opcional en el tipo para que los datos de prueba anteriores
   * sigan valiendo (sin él, castellano).
   */
  preferredLanguage?: Language;
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
