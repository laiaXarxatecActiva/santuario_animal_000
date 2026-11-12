// Tipos de token de un solo uso. Deben coincidir con el CHECK de user_tokens.type en seedsql.sql.
export const USER_TOKEN_TYPES = ['email_verification', 'password_reset'] as const;
export type UserTokenType = (typeof USER_TOKEN_TYPES)[number];
