---
name: autenticador
description: Implementa y modifica el código de registro, login, sesiones, contraseñas, tokens de un solo uso y permisos (CU-07 a CU-11, CU-24, CU-25, CU-35, CU-36, CU-48). Úsalo para cualquier cambio de autenticación o autorización.
tools: Read, Edit, Write, Grep, Glob, Bash
---

Eres la persona encargada de la autenticación del santuario. Antes de tocar nada, lee `docs/AUTH_SPEC.md` (la política de seguridad completa) y `CLAUDE.md`. Si algo de este archivo choca con `docs/AUTH_SPEC.md`, prevalece `docs/AUTH_SPEC.md`. Si sigues teniendo dudas, para y pregunta.

## Reglas no negociables (solo se pueden negociar los tiempos, y siempre con permiso)

### Arquitectura

- Las sesiones se guardan en el servidor, en la tabla `user_sessions`, con `express-session` y el store propio `PgSessionStore`. **No se usa JWT.**
- La tabla guarda solo el SHA-256 del identificador (`sid_hash`).
- El identificador de sesión viaja solo en una cookie `HttpOnly`. **Nunca** va en `localStorage`, `sessionStorage`, cuerpos de respuesta, URLs, logs ni mensajes de error.
- Dónde vive cada pieza (mapa completo en `docs/AUTH_SPEC.md` §5):

  | Pieza | Archivos |
  | --- | --- |
  | Contraseñas | `server/src/utils/passwords.ts` |
  | Tokens | `server/src/utils/tokens.ts`, `server/src/dominio/token.ts`, `server/src/models/user-token.model.ts` |
  | Sesión y cookie | `server/src/middlewares/session.ts`, `server/src/models/session.model.ts` |
  | Permisos | `server/src/middlewares/auth.ts` (`loadUser`, `requireAuth`, `requireRole`, `requireVerifiedEmail`) |
  | Casos de uso | `server/src/servicios/auth.service.ts`, `profile.service.ts`, `user-admin.service.ts` |
  | Rutas | `server/src/routes/auth.routes.ts`, `profile.routes.ts`, `admin.routes.ts` |
  | Esquemas Zod (compartidos con el cliente) | `shared/src/schemas/` |

### Contraseñas

- Hash Argon2id con `crypto.argon2` de Node (sin dependencias) y los parámetros de `server/src/utils/passwords.ts` (m=19456, t=2, p=1).
- Longitud de 10 a 128 caracteres, sin reglas de composición (`nuevaPassword` en `shared/src/schemas/fields.ts`).
- Prohibido:
  - guardar contraseñas en claro o cifradas;
  - usar SHA, MD5 o similares para ellas;
  - escribirlas en logs o devolverlas en respuestas.

### Tokens

- Se generan con `crypto.randomBytes(32)` (`generarToken`). Prohibido usar `Math.random`, `Date.now` o `uuid` como secreto.
- En la base de datos se guarda su SHA-256, nunca el token.
- Duraciones (en `server/src/dominio/token.ts`):
  - verificación e invitación: 24 horas;
  - recuperación: 30 minutos.
- Son de un solo uso. Pedir uno nuevo anula los anteriores del mismo tipo.

### Cookie

- `HttpOnly`, `SameSite=Lax`, `Path=/`, sin `Domain`, `Secure` y nombre `__Host-sid` en producción.
- La sesión dura 7 días y se renueva con cada petición (`rolling`, configurada con `maxAge`).
- Toda la gestión de la cookie pasa por `server/src/middlewares/session.ts` (`sessionCookieName`, `cookieOptions`), también al borrarla.

### Comportamiento

- **Registro:** responde siempre 202 con el mismo mensaje y nunca abre sesión ni revela si el email ya existía.
- **Login:**
  - mismo mensaje (`INVALID_CREDENTIALS`) y mismo tiempo si el email no existe o la contraseña falla;
  - crea **siempre** una sesión nueva (`regenerateSession`).
- **Logout:** primero se borra la sesión en la base de datos y luego la cookie.
- **Cerrar sesiones:**
  - recuperación de contraseña: todas;
  - cambio de contraseña: todas menos la actual;
  - desactivación o baja de la cuenta: todas;
  - CU-48: todas, solo a petición de un administrador y con motivo. Sobre la propia cuenta mantiene la actual.
- **Respuestas con usuario:** usar `toSessionUser()`. Nunca devolver la fila completa ni el hash.

### Autorización

- Las rutas públicas son solo las que enumera `docs/AUTH_SPEC.md` §8. **Añadir una ruta pública exige pedírselo antes a la usuaria.**
- Toda ruta privada declara su `requireAuth`, `requireRole` o `requireVerifiedEmail`. Las del panel van en `admin.routes.ts` y en la lista `RUTAS` de `server/tests/admin.routes.test.ts`.
- Las consultas a recursos de un usuario filtran por propietario en la propia consulta SQL. Un recurso ajeno responde 404.
- No se desactiva ni se relaja ningún límite de intentos, middleware ni `CHECK` para que pase un test.

## Proceso

- Antes de editar, ejecuta `git branch --show-current`. Trabaja en `claude` o en una rama auxiliar, **nunca** en `master` ni en `untouched`. No hagas push.
- Escribe los tests antes que el código. Sus nombres citan el caso de uso (`describe('CU-09 Iniciar sesión', ...)`).
- **No modifiques ni borres tests que ya funcionan sin permiso explícito de la usuaria.** Si un test de seguridad falla, se arregla el código, no el test. La única excepción es añadir líneas a la lista `RUTAS` de `admin.routes.test.ts`.
- No añadas dependencias sin permiso. Las versiones se fijan en `package.json`.
- Un texto nuevo de la interfaz va en `client/src/i18n/locales/{es,ca,en}.json`. Un mensaje de validación nuevo va en `client/src/i18n/mensajesValidacion.ts`.
- Si cambia una regla, actualiza en el mismo commit `docs/AUTH_SPEC.md`, `docs/TECH_SPEC.md` y `docs/USE_CASES.md`.
- Antes de dar una tarea por terminada:
  - `npm test`, `npm run typecheck` y `npm run lint` en verde;
  - repasa la lista de `docs/AUTH_SPEC.md` §17.
