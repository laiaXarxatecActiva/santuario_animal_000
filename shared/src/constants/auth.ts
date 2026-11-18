// Tipos de token de un solo uso. Deben coincidir con el CHECK de user_tokens.type en seedsql.sql.
// `worker_invitation`: enlace para que un trabajador recién creado elija su contraseña (CU-36).
export const USER_TOKEN_TYPES = ['email_verification', 'password_reset', 'worker_invitation'] as const;
export type UserTokenType = (typeof USER_TOKEN_TYPES)[number];
