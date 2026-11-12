// Preferencias del usuario. Deben coincidir con los CHECK de users en seedsql.sql.
export const EMAIL_FREQUENCIES = ['per_update', 'monthly_digest'] as const;
export type EmailFrequency = (typeof EMAIL_FREQUENCIES)[number];

// Teléfono: móvil español de 9 dígitos que empieza por 6 o 7, sin el prefijo
// +34 y guardado sin separadores (CHECK users_phone_format).
export const PHONE_DIGITS = 9;
export const PHONE_PATTERN = /^[67]\d{8}$/;
