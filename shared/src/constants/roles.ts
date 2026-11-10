// Roles de usuario. Deben coincidir con el CHECK de users.role en seedsql.sql.
export const ROLES = ['adopter', 'caretaker', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// Trabajadores del santuario: cuidadores y administradores.
export const WORKER_ROLES = ['caretaker', 'admin'] as const satisfies readonly Role[];

export function isWorkerRole(role: Role): boolean {
  return (WORKER_ROLES as readonly Role[]).includes(role);
}
