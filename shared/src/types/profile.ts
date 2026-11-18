import type { Language } from '../constants/languages.js';
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
  /**
   * Fase 3: idioma de la interfaz, los emails y los PDF. La API siempre lo
   * envía; es opcional en el tipo para que los datos de prueba anteriores
   * sigan valiendo (sin él, castellano).
   */
  preferredLanguage?: Language;
}
