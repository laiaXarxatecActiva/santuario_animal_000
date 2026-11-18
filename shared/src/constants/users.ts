// Preferencias del usuario. Deben coincidir con los CHECK de users en seedsql.sql.
export const EMAIL_FREQUENCIES = ['per_update', 'monthly_digest'] as const;
export type EmailFrequency = (typeof EMAIL_FREQUENCIES)[number];

// Teléfono: móvil español de 9 dígitos que empieza por 6 o 7, sin el prefijo
// +34 y guardado sin separadores (CHECK users_phone_format).
export const PHONE_DIGITS = 9;
export const PHONE_PATTERN = /^[67]\d{8}$/;

// CU-35: estado de una cuenta en el panel (se deriva de is_active y anonymized_at).
export const USER_ACCOUNT_STATUSES = ['active', 'inactive', 'anonymized'] as const;
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];
