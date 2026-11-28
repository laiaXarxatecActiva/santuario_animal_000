import type { ProfileDto, ProfileFormInput, ProfileFormOutput } from '@sanctuary/shared';
import { formatPhone } from './phone';

// CU-23: qué ha cambiado en el formulario del perfil respecto a lo guardado.
// Es solo de la interfaz (barra de guardar, «Modificado» y resumen); el servidor valida.

export type CampoPerfil = keyof ProfileFormInput;

/** Orden de la página: Tus datos, Notificaciones y Privacidad. */
export const CAMPOS_PERFIL = [
  'firstName',
  'lastName',
  'phone',
  'emailNotifications',
  'emailFrequency',
  'showPublicName',
] as const satisfies readonly CampoPerfil[];

/** Valores del formulario a partir de lo guardado (el teléfono, con guiones). */
export function borradorDe(perfil: ProfileDto): ProfileFormInput {
  return {
    firstName: perfil.firstName,
    lastName: perfil.lastName,
    phone: formatPhone(perfil.phone ?? ''),
    emailNotifications: perfil.emailNotifications,
    emailFrequency: perfil.emailFrequency,
    showPublicName: perfil.showPublicName,
  };
}

const soloDigitos = (telefono: string | null | undefined) => (telefono ?? '').replace(/\D/g, '');

/** Campos cambiados, sin contar los espacios de los extremos ni los guiones del teléfono. */
export function cambiosDelPerfil(perfil: ProfileDto, borrador: ProfileFormInput): CampoPerfil[] {
  return CAMPOS_PERFIL.filter((campo) => {
    if (campo === 'phone') return soloDigitos(perfil.phone) !== soloDigitos(borrador.phone);
    if (campo === 'firstName' || campo === 'lastName') return perfil[campo] !== borrador[campo].trim();
    return perfil[campo] !== borrador[campo];
  });
}

/** Lo que se envía al guardar: solo los campos cambiados, ya validados. */
export function soloCambios(datos: ProfileFormOutput, cambios: readonly CampoPerfil[]): Partial<ProfileFormOutput> {
  const envio: Partial<ProfileFormOutput> = {};
  for (const campo of cambios) Object.assign(envio, { [campo]: datos[campo] });
  return envio;
}
