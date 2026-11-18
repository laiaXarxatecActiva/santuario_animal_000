// Usuarios de database/TEST_DATA.sql (sus contraseñas están en la cabecera de ese archivo).

export const NURIA = { email: 'nuria.peris@santuario.test', password: 'NuriaPeris26#!' } as const; // cuidadora
export const LUCIA = { email: 'lucia.martinez@correo.test', password: 'Lucia.buitres1' } as const; // adopta a Rufo

// Adoptan a Greta: Pablo quiere un email por actualización; Elena, solo el resumen mensual.
export const PABLO = { email: 'pablo.garcia@correo.test' } as const;
export const ELENA = { email: 'elena.rubio@correo.test' } as const;

/** Rufo (animal 1): publicado y adoptado por Lucía. */
export const RUFO = 'Rufo';
/** Greta (animal 2): publicada y adoptable; la adoptan Pablo y Elena, pero no Lucía. */
export const GRETA = 'Greta';
