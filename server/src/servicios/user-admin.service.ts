import type {
  AdminUserAdoptionDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserPatchBody,
  AdminUsersQuery,
  Paginated,
  WorkerCreateInput,
} from '@sanctuary/shared';
import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { bajaAdopcion } from '../dominio/adopcion.js';
import { paginar } from '../dominio/paginacion.js';
import type { Reloj } from '../dominio/reloj.js';
import { caducidadToken } from '../dominio/token.js';
import {
  comprobarCambioEstado,
  comprobarCambioRol,
  puedeEnviarCambioPassword,
  puedeReenviarInvitacion,
  type ProblemaCuenta,
} from '../dominio/usuarios-admin.js';
import {
  AnonymizedCannotReactivateError,
  CannotDeactivateSelfError,
  InvitationNotPendingError,
  LastActiveAdminError,
  NotFoundError,
  PasswordResetNotAllowedError,
  RoleChangeNotAllowedError,
} from '../errors/app-error.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as contributionModel from '../models/contribution.model.js';
import * as sessionModel from '../models/session.model.js';
import * as shiftAssignmentModel from '../models/shift-assignment.model.js';
import * as tokenModel from '../models/user-token.model.js';
import * as userModel from '../models/user.model.js';
import type { EmailService } from '../services/email/email.service.js';
import { adminPasswordResetEmail } from '../services/email/templates/admin-password-reset.js';
import { workerInvitationEmail } from '../services/email/templates/worker-invitation.js';
import { hashPassword } from '../utils/passwords.js';
import { generarToken } from '../utils/tokens.js';

export interface UserAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
  email: EmailService;
  /** URL del cliente, para el enlace de la invitación. */
  clientUrl: string;
  /** Registra los fallos de envío de email (nunca deshacen la operación). */
  logEmailError?: (error: unknown) => void;
}

export type UserAdminService = ReturnType<typeof createUserAdminService>;

function lanzar(problema: ProblemaCuenta): never {
  switch (problema) {
    case 'CANNOT_DEACTIVATE_SELF':
      throw new CannotDeactivateSelfError();
    case 'ANONYMIZED_CANNOT_REACTIVATE':
      throw new AnonymizedCannotReactivateError();
    case 'ROLE_CHANGE_NOT_ALLOWED':
      throw new RoleChangeNotAllowedError();
    case 'LAST_ACTIVE_ADMIN':
      throw new LastActiveAdminError();
  }
}

const NO_EXISTE = 'Este usuario no existe.';

// CU-35 Gestionar usuarios y CU-36 Crear una cuenta de trabajador (solo administradores).
export function createUserAdminService({
  db,
  reloj,
  email,
  clientUrl,
  logEmailError = () => {},
}: UserAdminServiceDeps) {
  async function buscar(q: Queryable, id: number, forUpdate = false): Promise<userModel.AdminUser> {
    const user = await userModel.findForAdmin(q, id, forUpdate);
    if (!user) throw new NotFoundError(NO_EXISTE);
    return user;
  }

  /** Invalida la invitación anterior, crea otra de 24 horas y devuelve el token en claro (solo va en el email). */
  async function nuevaInvitacion(q: Queryable, userId: number): Promise<string> {
    await tokenModel.invalidateUnused(q, userId, 'worker_invitation', reloj.ahora());
    const { token, hash } = generarToken();
    await tokenModel.create(q, {
      userId,
      type: 'worker_invitation',
      tokenHash: hash,
      expiresAt: caducidadToken('worker_invitation', reloj.ahora()),
    });
    return token;
  }

  /** Paso 4: un fallo del envío no deshace la cuenta; el administrador puede reenviarla (4a). */
  async function enviarInvitacion(user: userModel.AdminUser, token: string): Promise<void> {
    const url = new URL('/reset-password', clientUrl);
    url.searchParams.set('token', token);
    url.searchParams.set('invite', '1');
    try {
      await email.send({
        to: user.email,
        ...workerInvitationEmail({
          firstName: user.firstName,
          url: url.toString(),
          language: await userModel.findLanguage(db, user.id),
        }),
      });
    } catch (error) {
      logEmailError(error);
    }
  }

  /** 4a: las adopciones abiertas se dan de baja como en CU-21, sin más cobros. */
  async function darDeBajaAdopciones(q: Queryable, userId: number): Promise<void> {
    for (const id of await adoptionModel.listOpenIdsForUpdate(q, userId)) {
      const adopcion = await adoptionModel.findByIdForUpdate(q, id);
      if (!adopcion) continue;
      const baja = bajaAdopcion(
        { ...adopcion, cancelRequested: adopcion.cancelRequestedAt !== null },
        reloj.hoy(),
        'admin_cancelled',
      );
      if (baja) await adoptionModel.applyCancellation(q, id, { ...baja, requestedAt: reloj.ahora() });
    }
  }

  async function detalle(id: number): Promise<AdminUserDetailDto> {
    const user = await buscar(db, id);
    const esAdoptante = user.role === 'adopter';
    const [adopciones, pagos, donaciones] = esAdoptante
      ? await Promise.all([
          adoptionModel.listByUser(db, id),
          contributionModel.listPayments(db, id),
          contributionModel.listDonations(db, id),
        ])
      : [[], [], []];
    const adoptions: AdminUserAdoptionDto[] = adopciones.map((a) => ({
      id: a.id,
      animal: { id: a.animal.id, name: a.animal.name },
      plan: a.plan,
      status: a.status,
      startDate: a.startDate,
      endDate: a.endDate,
      nextBillingDate: a.nextBillingDate,
      cancelRequested: a.cancelRequestedAt !== null,
    }));
    return {
      ...userModel.toListItem(user),
      phone: user.phone,
      emailVerified: user.emailVerified,
      invitationPending: puedeReenviarInvitacion({ ...user, lastLoginAt: user.lastLoginDate }),
      adoptions,
      payments: pagos,
      donations: donaciones,
    };
  }

  return {
    /** Paso 2: búsqueda, filtros por rol y estado, y páginas. */
    async list(query: AdminUsersQuery): Promise<Paginated<AdminUserListItemDto>> {
      const filtros = { q: query.q, role: query.role, status: query.status };
      const total = await userModel.countForAdmin(db, filtros);
      const pagina = paginar(query, total);
      const usuarios =
        total === 0
          ? []
          : await userModel.listForAdmin(db, filtros, {
              sort: query.sort,
              limit: pagina.pageSize,
              offset: pagina.offset,
            });
      return {
        data: usuarios.map(userModel.toListItem),
        meta: { page: pagina.page, pageSize: pagina.pageSize, total: pagina.total, totalPages: pagina.totalPages },
      };
    },

    /** Paso 3: datos y, si es adoptante, sus adopciones, pagos y donaciones. */
    get: detalle,

    /**
     * Pasos 4-5 y A1. Al desactivar se cierran todas las sesiones y, si es un
     * adoptante, se dan de baja sus adopciones. El rol se relee en cada
     * petición (loadUser), así que cambiarlo no exige cerrar sesiones.
     */
    async update(actorId: number, id: number, cambios: AdminUserPatchBody): Promise<AdminUserDetailDto> {
      await withTransaction(db, async (client) => {
        if (cambios.role !== undefined) {
          // Primero los administradores y después la cuenta, siempre en el mismo orden.
          const adminsActivos = await userModel.countActiveAdminsForUpdate(client);
          const user = await buscar(client, id, true);
          const problema = comprobarCambioRol(user, { nuevoRol: cambios.role, adminsActivos });
          if (problema) lanzar(problema);
          await userModel.setRole(client, id, cambios.role);
          return;
        }
        const activar = cambios.isActive === true;
        const user = await buscar(client, id, true);
        const problema = comprobarCambioEstado(user, { actorId, activar });
        if (problema) lanzar(problema);
        await userModel.setActive(client, id, activar);
        if (!activar) {
          await sessionModel.deleteByUserId(client, id);
          if (user.role === 'adopter') await darDeBajaAdopciones(client, id);
          // CU-61: un trabajador desactivado deja sus turnos futuros sin fichar.
          else await shiftAssignmentModel.removeFutureOfUser(client, id, reloj.hoy());
        }
      });
      return detalle(id);
    },

    /**
     * CU-48: cierra todas las sesiones de un usuario (por ejemplo, si avisa de
     * que le han robado el móvil). Sobre la propia cuenta mantiene la sesión
     * actual (3a), como el cambio de contraseña (CU-24). No cambia nada más:
     * la cuenta sigue activa y puede volver a entrar con su contraseña.
     */
    async logoutAll(actor: { id: number; sid: string }, id: number): Promise<number> {
      return withTransaction(db, async (client) => {
        await buscar(client, id, true);
        return id === actor.id
          ? sessionModel.deleteOthersByUserId(client, id, actor.sid)
          : sessionModel.deleteByUserId(client, id);
      });
    },

    /** CU-36 pasos 3-4: cuenta verificada, contraseña aleatoria e invitación de 24 horas. */
    async createWorker(datos: WorkerCreateInput): Promise<AdminUserDetailDto> {
      const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
      const { id, token } = await withTransaction(db, async (client) => {
        const nuevoId = await userModel.createWorker(client, { ...datos, passwordHash });
        return { id: nuevoId, token: await nuevaInvitacion(client, nuevoId) };
      });
      await enviarInvitacion(await buscar(db, id), token);
      return detalle(id);
    },

    /** CU-36 4a: reenviar la invitación (anula la anterior). */
    async resendInvitation(id: number): Promise<void> {
      const user = await buscar(db, id);
      if (!puedeReenviarInvitacion({ ...user, lastLoginAt: user.lastLoginDate })) throw new InvitationNotPendingError();
      const token = await withTransaction(db, (client) => nuevaInvitacion(client, id));
      await enviarInvitacion(user, token);
    },

    /**
     * CU-51: envía al trabajador un enlace de recuperación (`password_reset`, 30
     * minutos) que anula los anteriores. El administrador nunca ve la contraseña;
     * al usar el enlace (CU-10) se cierran las sesiones del trabajador.
     */
    async sendPasswordReset(actorId: number, id: number): Promise<void> {
      const user = await buscar(db, id);
      if (!puedeEnviarCambioPassword(user, actorId)) throw new PasswordResetNotAllowedError();
      const token = await withTransaction(db, async (client) => {
        await tokenModel.invalidateUnused(client, id, 'password_reset', reloj.ahora());
        const nuevo = generarToken();
        await tokenModel.create(client, {
          userId: id,
          type: 'password_reset',
          tokenHash: nuevo.hash,
          expiresAt: caducidadToken('password_reset', reloj.ahora()),
        });
        return nuevo.token;
      });
      const url = new URL('/reset-password', clientUrl);
      url.searchParams.set('token', token);
      // Un fallo del envío no deshace nada: el administrador puede volver a enviarlo.
      try {
        await email.send({
          to: user.email,
          ...adminPasswordResetEmail({
            firstName: user.firstName,
            url: url.toString(),
            language: await userModel.findLanguage(db, id),
          }),
        });
      } catch (error) {
        logEmailError(error);
      }
    },
  };
}
