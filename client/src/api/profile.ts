import type {
  ChangePasswordInput,
  DeleteAccountInput,
  MessageResponse,
  ProfileDto,
  UpdateProfileInput,
} from '@sanctuary/shared';
import { apiDelete, apiGet, apiPatch, apiPut } from './client';

// Perfil y contraseña (CU-23, CU-24; TECH_SPEC §10.4).
export const profileApi = {
  get: () => apiGet<ProfileDto>('/api/me/profile'),
  update: (cambios: UpdateProfileInput) => apiPatch<ProfileDto>('/api/me/profile', cambios),
  changePassword: (datos: ChangePasswordInput) => apiPut('/api/me/password', datos),
  // CU-25: elimina (anonimiza) la cuenta y cierra la sesión.
  deleteAccount: (datos: DeleteAccountInput) => apiDelete<MessageResponse>('/api/me', datos),
};
