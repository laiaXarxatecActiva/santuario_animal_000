import type { Role } from '../constants/roles.js';
import type { EmailFrequency } from '../constants/users.js';

// Perfil del usuario (CU-23, TECH_SPEC §10.4). El teléfono, solo con los dígitos.
export interface ProfileDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  emailNotifications: boolean;
  emailFrequency: EmailFrequency;
  showPublicName: boolean;
}
