# Autenticación, sesiones y seguridad (AUTH_SPEC)

Política de seguridad del proyecto: **qué** se exige, **dónde** está implementado y **qué tests** lo comprueban. Sustituye al antiguo `AUTHENTICATION_SESSIONS_AND_SECURITY.md`. Las decisiones con su motivo también aparecen en `TECH_SPEC.md` (§9 Autenticación y autorización, §10 API y §13 Requisitos no funcionales) y en los casos de uso CU-07 a CU-11, CU-24, CU-25, CU-35, CU-36, CU-48 y CU-51 de `USE_CASES.md`. Si este documento y la especificación no coinciden, hay un error: se corrigen los dos en el mismo commit.

Términos que se usan en todo el documento:

- **Sesión:** el servidor recuerda que alguien ha iniciado sesión. Se guarda en la base de datos, y el navegador solo conserva un identificador aleatorio en una cookie.
- **Cookie:** un pequeño dato que el navegador guarda y envía solo en cada petición a la web.
- **Hash:** una huella de un texto que no permite recuperar el original. Se usa para no guardar nunca contraseñas ni tokens.
- **Token:** un código aleatorio de un solo uso que viaja en un enlace de email (verificar el email, recuperar la contraseña o aceptar una invitación).
- **401 / 403 / 404 / 429:** códigos de respuesta. Significan «no has iniciado sesión», «no tienes permiso», «no existe» y «demasiados intentos».

## 1. Mejoras aplicadas y decisiones

Este documento nació como una lista de mejoras. Algunas propuestas se aplicaron. Otras se descartaron porque lo que ya había era igual de seguro o más, o porque obligaban a rehacer el servidor sin ganar seguridad.

| Propuesta | Decisión | Motivo |
| --- | --- | --- |
| Enlace de recuperación de contraseña de 30 minutos (antes, 1 hora) | **Aplicada** (CU-10) | Un enlace robado sirve durante menos tiempo, y 30 minutos bastan para usarlo |
| Cerrar todas las sesiones de un usuario (`logout-all`) | **Aplicada** como CU-48, **solo para administradores** y con motivo obligatorio | No es una opción de uso habitual: sirve para casos de seguridad concretos (un móvil robado o una sesión abierta en un ordenador ajeno) y queda registrada |
| Hono 4, Node 22, un ORM, `@node-rs/argon2`, `hono-rate-limiter` | Descartada: se mantienen Express 5, Node 24.7+, `pg` sin ORM, `crypto.argon2` y `express-rate-limit` | Cambiarlos obligaría a rehacer el servidor. `crypto.argon2` viene con Node y evita una dependencia más |
| Contraseñas de 12 a 256 caracteres | Descartada: se mantienen **10 a 128** | Decisión de la propietaria del proyecto. Un máximo mayor solo serviría para cargar el servidor con textos enormes |
| Sesión de 30 días, renovada si quedan menos de 15 | Descartada: se mantienen **7 días**, renovados con cada petición | Una sesión robada sirve durante menos tiempo |
| `register` responde 201 con el usuario | Descartada: responde **202 con un mensaje**, siempre el mismo | Si respondiera distinto cuando el email ya existe, cualquiera podría averiguar quién tiene cuenta |
| Login: 10 intentos cada 15 minutos por IP | Descartada: **5 fallos por IP y email** y **50 por IP** cada 15 minutos | Es más estricto, y además no permite bloquear la cuenta de otra persona |
| Mensajes de error genéricos («Sin permiso», «Datos no válidos») | Descartada: se mantienen los mensajes actuales (§9) | Explican mejor qué pasa sin revelar nada sensible |
| Recibo en PDF de una donación sin cuenta (CU-05) | **Aplicada** como ruta pública `GET /api/donations/:id/receipt.pdf?token=`, autorizada por la propietaria del proyecto | El token es una firma HMAC-SHA256 de `donation-receipt:<id>` con `SESSION_SECRET`: no se puede adivinar, no sirve para otra donación y no hay que guardar nada nuevo en la base de datos. Se compara en tiempo constante |
| El administrador cambia la contraseña de un trabajador (CU-51) | **Aplicada** como envío de un enlace: el administrador **nunca escribe ni ve** la contraseña | Se reutiliza el enlace de recuperación (`password_reset`, 30 minutos, un solo uso, anula los anteriores). Al usarlo se cierran las sesiones del trabajador. Solo para trabajadores activos distintos del propio administrador; queda en el registro de actividad sin el enlace. Se descartó que el administrador escribiera la contraseña porque llegaría a conocer la de otra persona |
| La cookie caduca con `expires` en lugar de `maxAge` | Descartada: se usa `maxAge` | `express-session` calcula con `maxAge` la misma fecha de caducidad (`Expires`) que recibe el navegador. Las dos formas son equivalentes |

## 2. Reglas para quien trabaje en el código (personas o agentes)

- La seguridad tiene prioridad sobre la rapidez. Si una implementación contradice una norma de este documento, prevalece la norma.
- No se toman decisiones de seguridad por iniciativa propia. Ante cualquier duda que afecte a la autenticación, las sesiones, los permisos o los datos personales, se para y se pregunta.
- No se cambia sin autorización explícita el mecanismo de autenticación (sesiones en el servidor con cookie), el algoritmo de contraseñas ni la librería de sesiones. No se añaden dependencias de seguridad sin autorización.
- No se desactiva ni se relaja ninguna comprobación (middleware, límite de intentos, `CHECK` de la base de datos) para que pase un test o para resolver un error. Si un test de seguridad falla, se arregla el código, no el test.
- No se modifican ni se borran tests que funcionan sin autorización (regla de `CLAUDE.md`). Los tests de seguridad se escriben antes que el código.
- Autenticación (¿quién eres?), sesión (¿sigues siendo tú?) y autorización (¿puedes hacer esto?) son piezas separadas y se tratan por separado.
- Toda ruta nueva declara explícitamente su acceso (§8) y tiene un test que compruebe sus 401, 403 y 404.
- **No se añade ninguna ruta pública nueva sin autorización.**

## 3. Stack

| Pieza | Elección |
| --- | --- |
| Entorno | Node 24.7 o más (por `crypto.argon2`), TypeScript estricto |
| Servidor | Express 5 |
| Validación | Zod, con los esquemas compartidos entre cliente y servidor (`shared/src/schemas/`) |
| Base de datos | PostgreSQL 14+ con `pg`, **sin ORM**. Todo el SQL va parametrizado y escrito a mano |
| Sesiones | `express-session` con un store propio en PostgreSQL (`PgSessionStore`) |
| Hash de contraseñas | `crypto.argon2` de Node, Argon2id con m=19456, t=2, p=1 |
| Límites de intentos | `express-rate-limit`, con los contadores en memoria |
| Cabeceras HTTP | `helmet` |
| Tests | Vitest + Supertest |

## 4. Endpoints

En la columna «Acceso», «autenticado» significa que hace falta haber iniciado sesión con cualquier rol.

| Método | Ruta | Acceso | Respuesta correcta | CU |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | Pública (con límite) | `202 { message }`, siempre el mismo y sin abrir sesión | CU-07 |
| POST | `/api/auth/verify-email` | Pública | `200 { status: "verified" \| "already_verified" }` | CU-08 |
| POST | `/api/auth/resend-verification` | Autenticado (con límite) | `204` | CU-08 |
| POST | `/api/auth/login` | Pública (con límite) | `200 { user }` + cookie de sesión | CU-09 |
| POST | `/api/auth/logout` | Autenticado | `204` y borra la cookie | CU-11 |
| GET | `/api/auth/me` | Pública | `200 { user }`, o `{ user: null }` sin sesión | — |
| POST | `/api/auth/forgot-password` | Pública | `200 { message }`, siempre el mismo | CU-10 |
| POST | `/api/auth/reset-password` | Pública | `204` (también para la invitación de CU-36) | CU-10 |
| PUT | `/api/me/password` | Autenticado (con límite) | `204`; cierra las demás sesiones | CU-24 |
| DELETE | `/api/me` | Adoptante (con límite y contraseña) | `204`; anonimiza y cierra todas las sesiones | CU-25 |
| POST | `/api/admin/users/:id/logout-all` | **Solo administrador** | `200 { closedSessions }` | CU-48 |
| POST | `/api/admin/users/:id/password-reset` | **Solo administrador** | `204`; envía al trabajador el enlace para elegir otra contraseña. Adoptante, cuenta desactivada o propia: 422 `PASSWORD_RESET_NOT_ALLOWED` | CU-51 |
| DELETE | `/api/admin/users/:id` | **Solo administrador** (nunca la propia) | `204`; borra la cuenta del todo y sus sesiones. Con datos enlazados exige `force` (si no, 409 `ACCOUNT_HAS_DATA`) | CU-75 |
| POST | `/api/admin/users/:id/anonymize` | **Solo administrador** (nunca la propia) | `200`; anonimiza como CU-25 y cierra todas sus sesiones | CU-76 |

No existe un «cerrar sesión en todos mis dispositivos» al alcance de cualquier usuario. Quien sospeche que alguien usa su cuenta cambia la contraseña (CU-24), que cierra sus demás sesiones, o pide ayuda al santuario (CU-48).

## 5. Mapa de la implementación

| Pieza | Dónde |
| --- | --- |
| Hash de contraseñas (Argon2id) | `server/src/utils/passwords.ts` |
| Tokens de un solo uso (generación, SHA-256 y caducidad) | `server/src/utils/tokens.ts`, `server/src/dominio/token.ts`, `server/src/models/user-token.model.ts` |
| Sesiones: store, cookie, regenerar y destruir | `server/src/middlewares/session.ts` |
| Sesiones: SQL (solo con el hash del identificador) | `server/src/models/session.model.ts`, tabla `user_sessions` en `database/seedsql.sql` |
| Cargar el usuario y comprobar permisos (`loadUser`, `requireAuth`, `requireRole`, `requireVerifiedEmail`) | `server/src/middlewares/auth.ts` |
| CSRF: origen | `server/src/middlewares/require-same-origin.ts` |
| CSRF: solo JSON | `server/src/middlewares/require-json.ts` |
| Límites de intentos | `server/src/middlewares/rate-limit.ts` |
| Casos de uso de la cuenta (registro, login, verificación y recuperación) | `server/src/servicios/auth.service.ts`, `server/src/controllers/auth.controller.ts`, `server/src/routes/auth.routes.ts` |
| Cambio de contraseña (CU-24) y baja de la cuenta (CU-25) | `server/src/servicios/profile.service.ts` |
| Usuarios del panel: desactivar, invitar, cerrar sesiones, eliminar y anonimizar (CU-35, CU-36, CU-48, CU-75, CU-76) | `server/src/servicios/user-admin.service.ts`, `server/src/models/account-deletion.model.ts`, `server/src/controllers/user-admin.controller.ts`, `server/src/routes/admin.routes.ts` |
| Cabeceras HTTP (`helmet`) y orden de los middlewares | `server/src/app.ts` |
| Validación de entradas (Zod, compartida con el cliente) | `shared/src/schemas/` (contraseñas en `fields.ts`), `server/src/middlewares/validate.ts` |
| Errores (sin trazas ni SQL para el cliente) | `server/src/errors/app-error.ts`, `server/src/middlewares/error-handler.ts` |
| Logs con los datos sensibles ocultos | `server/src/utils/logger.ts` |
| Variables secretas | `server/src/config/env.ts` (`SESSION_SECRET` de 32+ caracteres; el servidor no arranca sin él) |
| Cliente: sesión y redirecciones seguras | `client/src/hooks/useSession.ts`, `client/src/api/client.ts`, `client/src/utils/redirect.ts` (`safeNext`) |

## 6. Reglas de negocio

### 6.1 Contraseñas

- Hash con **Argon2id** usando `crypto.argon2`, que viene con Node 24.7+ (sin dependencias). Los parámetros son los mínimos que recomienda OWASP: 19 MiB de memoria, 2 pasadas y paralelismo 1, con una sal aleatoria de 16 bytes por contraseña y un hash de 32 bytes.
- Se guarda en formato PHC (`$argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash>`). Así, los parámetros se pueden subir más adelante sin invalidar los hashes existentes.
- Al comprobar un hash se rechazan los parámetros desorbitados, para que un hash manipulado no agote la memoria. La comparación se hace en tiempo constante (`timingSafeEqual`).
- Los parámetros están centralizados en `passwords.ts`. Si se cambian, se actualiza TECH_SPEC §9.2.
- Prohibido:
  - guardar contraseñas en claro o cifradas (cifrar es reversible);
  - usar MD5, SHA-1 o SHA-256 para contraseñas;
  - escribirlas en los logs o devolverlas en las respuestas.
- Longitud de **10 a 128 caracteres**, sin reglas de composición. Se permiten espacios, símbolos, pegar la contraseña y los gestores de contraseñas. No se obliga a cambiarla cada cierto tiempo. El máximo existe para que no se pueda cargar el servidor con un texto enorme.
- El esquema Zod es el mismo en el cliente y en el servidor (`nuevaPassword` en `shared/src/schemas/fields.ts`). El servidor siempre vuelve a validar.
- La contraseña nueva de CU-24 tiene que ser distinta de la actual.
- Las contraseñas de prueba de `database/TEST_DATA.sql` llevan su hash Argon2id ya calculado, porque PostgreSQL no sabe calcularlo. Las contraseñas en claro están en la cabecera de ese archivo, que es lo que lee `npm run users:file`.

### 6.2 Sesiones y cookie

Decisión: **sesiones guardadas en el servidor** (PostgreSQL), no JWT (TECH_SPEC §9.1). No se introduce JWT ni ningún otro mecanismo.

- `express-session` con un **store propio** (`PgSessionStore`). En `user_sessions` se guarda **solo el SHA-256 del identificador** (`sid_hash`), nunca el identificador. Así, una copia o una fuga de la tabla no permite suplantar a nadie. Además, la cookie va firmada con `SESSION_SECRET`.
- El identificador lo genera `express-session` (`uid-safe`, 24 bytes de `crypto.randomBytes`). Nunca se usan `Math.random()`, fechas, `uuid` ni datos del usuario como secreto.
- La sesión guarda solo `userId`. El usuario y su rol se **releen de la base de datos en cada petición** (`loadUser`). Si la cuenta se desactiva o se anonimiza, la sesión deja de valer al momento.
- La caducidad se comprueba **en el servidor** (`expire > NOW()`), no solo en la cookie.
- La sesión **dura 7 días** y se renueva con cada petición (`rolling`).
- Las sesiones caducadas se borran cada 15 minutos.
- **Fijación de sesión:** al iniciar sesión se crea siempre un identificador nuevo (`regenerateSession`) y el anterior deja de valer.
- **Logout** (CU-11): primero se destruye la sesión en la base de datos y después se borra la cookie. El identificador anterior deja de funcionar inmediatamente.
- **Cerrar sesiones de un usuario** (la columna `user_id`, con `ON DELETE CASCADE`, permite cerrarlas todas de una vez):

  | Situación | Sesiones que se cierran |
  | --- | --- |
  | Recuperar la contraseña o aceptar una invitación (CU-10, CU-36) | Todas |
  | Cambiar la contraseña (CU-24) | Todas menos la actual |
  | Darse de baja (CU-25) | Todas |
  | Un administrador desactiva la cuenta (CU-35) | Todas |
  | Un administrador cierra sus sesiones (CU-48) | Todas; si lo hace sobre su propia cuenta, todas menos la actual |
  | Un administrador elimina o anonimiza la cuenta (CU-75, CU-76) | Todas (nunca sobre la propia cuenta) |

- El registro **no** abre sesión (§6.4).

| Atributo de la cookie | Valor |
| --- | --- |
| Nombre | `sid` en local; `__Host-sid` en producción |
| `HttpOnly` | Siempre |
| `Secure` | En producción (HTTPS) |
| `SameSite` | `Lax` |
| `Path` | `/` |
| `Domain` | Nunca se establece |
| Caducidad | 7 días, igual que la sesión en el servidor (se configura con `maxAge`; el navegador recibe la fecha en `Expires`) |

- La cookie se configura solo en `middlewares/session.ts` (`sessionCookieName`, `cookieOptions`), también para borrarla.
- El token de sesión nunca está al alcance de JavaScript. No se guarda en `localStorage`, `sessionStorage` ni variables, y no aparece en respuestas JSON, URLs, logs ni mensajes de error. `localStorage` solo guarda preferencias que no son secretas: el tema, el idioma, el aviso de cookies y, en el panel, los apartados abiertos del menú, las explicaciones ocultas y los accesos rápidos elegidos para el escritorio (rutas del panel, por persona); `scripts/check-auth.sh` rechaza cualquier otro uso.

### 6.3 Tokens de un solo uso

Sirven para verificar el email, recuperar la contraseña e invitar a un trabajador.

- Son 32 bytes de `crypto.randomBytes`. En `user_tokens` se guarda solo su SHA-256.
- Caducidad (en `server/src/dominio/token.ts`):

  | Token | Caduca en |
  | --- | --- |
  | Verificación del email (`email_verification`) | 24 horas |
  | Invitación de un trabajador (`worker_invitation`) | 24 horas |
  | **Recuperación de contraseña** (`password_reset`) | **30 minutos** |

- Se marcan como usados de forma atómica, es decir, en una sola operación, para que no se puedan usar dos veces. Pedir uno nuevo invalida los anteriores del mismo tipo.
- Viajan en el enlace del email (`?token=`). El cliente los envía a la API en el **cuerpo** de un POST, nunca en la URL de la API.
- Las respuestas de la API llevan `Referrer-Policy: no-referrer` (helmet), para que el navegador no pase la dirección con el token a otras webs.

### 6.4 Cuenta: registro, login, verificación y recuperación

**Registro** (CU-07):

- Se valida con Zod.
- El email se normaliza: sin espacios y en minúsculas. La unicidad no distingue mayúsculas (índice `users_email_lower_key`).
- El campo `role` se ignora: el registro siempre crea adoptantes.
- **No revela si el email ya tiene cuenta.** La respuesta es siempre `202` con el mensaje «Te hemos enviado un email. Revisa tu bandeja de entrada para continuar.», y nunca abre sesión. Según el caso:
  - **Email nuevo:** se crea la cuenta y se envía el email de verificación.
  - **Email existente con la cuenta activa:** no se crea nada y se envía a ese email el aviso «Ya tienes una cuenta en el santuario», con enlaces a iniciar sesión y a recuperar la contraseña.
  - **Cuenta desactivada:** no se envía nada.
- En todos los casos se calcula el hash de la contraseña, para que la respuesta tarde lo mismo.
- Después del registro, el cliente lleva a «Iniciar sesión».

**Login** (CU-09):

- Da el mismo error (`INVALID_CREDENTIALS`, 401) si el email no existe, si la contraseña es incorrecta y si la cuenta está desactivada o anonimizada, para no revelar si la cuenta existe ni si la contraseña es buena.
- Cuando el email no existe, compara con un hash ficticio para que tarde lo mismo. Ese hash se calcula al crear el servicio, para que tampoco tarde más el primer intento.
- Una contraseña de más de 128 caracteres recibe el mismo `INVALID_CREDENTIALS` (ninguna contraseña válida es tan larga), sin buscar el usuario ni calcular el hash. En el registro, en la recuperación y en el cambio de contraseña, en cambio, es un error de validación (400) con su mensaje.
- Se puede entrar con el email sin verificar. Lo que exige verificarlo es adoptar (`requireVerifiedEmail`).
- Se crea **siempre una sesión nueva** y solo se devuelven los datos públicos del usuario (§10).
- En el cliente, al entrar se vacía la caché de React Query, para que no queden datos de otra cuenta abierta antes en el mismo navegador.

**Verificación** (CU-08):

- El reenvío exige sesión. Se puede pedir como máximo 3 veces por hora.

**Recuperación** (CU-10):

- La respuesta es siempre la misma, exista o no el email: «Si existe una cuenta con ese email, recibirás un enlace.».
- El enlace caduca en **30 minutos**. El email lo dice en el idioma de la persona.
- Al usar el token:
  - se marca como usado y se invalidan los demás;
  - se guarda el nuevo hash;
  - se cierran todas las sesiones.

**Invitación de un trabajador** (CU-36):

- Solo la crea un administrador. La cuenta nace con `email_verified = TRUE` y con el hash de una contraseña aleatoria de 32 bytes que nadie conoce.
- El token es de tipo `worker_invitation`. Se usa en `POST /api/auth/reset-password` igual que la recuperación: se marca como usado, se anulan los demás enlaces de recuperación e invitación y se cierran las sesiones.
- El enlace lleva `&invite=1` solo para que la página diga «Elige tu contraseña». Ese parámetro no da ningún permiso.
- Reenviarla anula la anterior. Solo se puede si el trabajador está activo y nunca ha entrado.

**Enlace para que un trabajador cambie su contraseña** (CU-51):

- Solo lo envía un administrador, a un trabajador (cuidador u otro administrador) activo y que no sea él mismo. Su propia contraseña se cambia en «Mi perfil» (CU-24); los adoptantes usan «¿Has olvidado tu contraseña?» (CU-10).
- Es un token `password_reset` como el de CU-10: 30 minutos, un solo uso, y anula los enlaces de recuperación anteriores. Se usa en `POST /api/auth/reset-password`, que cierra todas las sesiones del trabajador.
- La contraseña actual sigue sirviendo hasta que el trabajador elige la nueva. El administrador nunca la ve.
- Queda en el registro de actividad como `{ resetLinkSent: true }`: `limpiarDetalles` descarta cualquier clave que contenga «password» o «token».

**Desactivar una cuenta** (CU-35):

- Solo lo hace un administrador, y nunca sobre su propia cuenta.
- Se cierran todas las sesiones de esa cuenta en la misma transacción (un grupo de cambios que se guardan todos o ninguno). Además, `loadUser` ya rechaza una cuenta inactiva en la siguiente petición.
- El cambio de rol no cierra sesiones, porque el rol se relee de la base de datos en cada petición.
- Siempre queda al menos un administrador activo.

### 6.5 Cerrar todas las sesiones de un usuario (CU-48)

- `POST /api/admin/users/:id/logout-all`, **solo administradores** (`requireRole('admin')`). Ningún adoptante ni cuidador puede usarlo, ni siquiera sobre su propia cuenta.
- Exige un **motivo** (`reason`, de 1 a 500 caracteres; esquema `adminUserLogoutAllSchema`). Sin motivo responde 400 y no cierra nada.
- Borra todas las sesiones del usuario en una transacción y responde con cuántas ha cerrado. Si el administrador lo hace sobre su propia cuenta, mantiene la sesión actual.
- No toca nada más: la cuenta sigue activa y la contraseña, el rol y las adopciones no cambian.
- Queda en el registro de actividad (CU-42) con quién lo hizo, sobre qué usuario, cuántas sesiones se cerraron y el motivo.
- En el cliente es un botón de la ficha del usuario (`/admin/users/:id`), solo para las cuentas activas. Lleva una ventana de confirmación que explica que debe usarse solo por un motivo de seguridad.
- Si se sospecha que alguien conoce la contraseña, cerrar las sesiones no basta: la persona debe cambiarla (CU-24) o recuperarla (CU-10).

## 7. Límites de intentos

Están hechos con `express-rate-limit`, con los contadores en memoria. Si algún día hay varias instancias del servidor, los contadores tendrán que estar en un almacén compartido. En producción se confía en `X-Forwarded-For` solo a través de `trust proxy = 1` (un único proxy controlado). El 429 indica en `Retry-After` cuántos segundos hay que esperar.

| Acción | Límite |
| --- | --- |
| Login | 5 intentos fallidos por IP y email, y 50 por IP sea cual sea el email, cada 15 minutos. No hay límite solo por email, porque permitiría bloquear la cuenta de otra persona |
| Registro | 20 por hora por IP y 3 por hora por email |
| Reenvío de la verificación | 3 por hora por usuario |
| Cambio de contraseña (CU-24) y baja de la cuenta (CU-25) | 5 intentos fallidos por usuario cada 15 minutos (comparten el límite, para que una sesión robada no sirva para adivinar la contraseña) |
| Donaciones (CU-05) | 10 por hora por IP |
| Contacto (CU-06) | 5 por hora por IP |

Los formularios públicos de donación y contacto envían emails a direcciones que escribe quien los usa. Por eso están limitados: así no sirven para inundar el buzón de otra persona ni el del santuario.

## 8. Autorización

- La cadena de middlewares tiene un orden fijo, y cada pieza hace una sola cosa:
  1. `loadUser` carga el usuario de la sesión.
  2. `requireAuth` responde 401 si no hay sesión.
  3. `requireRole(...)` responde 403 si el rol no es el adecuado.
  4. `requireVerifiedEmail` responde 403 si el email no está verificado.
- Una sesión válida no da permiso para todo.
- Cómo se declara el acceso:
  - **Rutas públicas:** solo las de `public.routes.ts`, `GET /api/auth/me` y `POST /api/auth/{register,login,verify-email,forgot-password,reset-password}`, además de los formularios de donación y contacto (`donation.routes.ts`, CU-05 y CU-06) y del recibo en PDF de una donación con la firma de su enlace (`GET /api/donations/:id/receipt.pdf?token=`, en `document.routes.ts`, CU-05).
  - **Panel** (`/api/admin/*`): se aplica `requireRole('caretaker', 'admin')` a todo el router, y `requireRole('admin')` a las rutas solo de administrador (también CU-48).
  - **Resto de routers** (`/api/me/*`, adopciones, perfil): cada ruta declara su `requireAuth`, `requireRole` o `requireVerifiedEmail` según la matriz de TECH_SPEC §9.5. Una ruta nueva sin esa declaración es pública, así que se revisa en cada cambio y se cubre con un test de 401/403.
  - **No se añade ninguna ruta pública nueva sin autorización.**
- `server/tests/admin.routes.test.ts` comprueba el 401/403 de **todas** las rutas del panel. Toda ruta privada nueva se añade a un test de ese tipo.
- **Propiedad de los recursos (IDOR, es decir, acceder a datos ajenos cambiando un número de la dirección):**
  - El filtro por propietario va en la propia consulta SQL (`WHERE user_id = $1 AND id = $2`); no se comprueba después de leer el recurso.
  - Un recurso ajeno responde **404** (no 403), para no revelar que existe.
  - Vale igual para leer, modificar y borrar.
- **Trabajo diario del personal (CU-52 a CU-59):** las rutas del panel siguen la misma regla. Las de consulta y «Mi día» (`GET /zones`, `GET /qualifications`, `GET /my-day`, `POST /tasks/:id/{complete,not-done,reopen}`) son de todo el personal; las de configuración (zonas, cualificaciones, plantillas, tareas puntuales, reasignar, borrar, ajustes) llevan `requireRole('admin')`. Además, completar o marcar como no realizada una tarea que exige una cualificación pide tenerla: el servicio responde 403 `MISSING_QUALIFICATION` y el trigger `check_task_people` lo impide también en la base de datos. Una tarea asignada solo la resuelve su persona (403 `TASK_NOT_YOURS`, también para el administrador) y «Mi día» no envía las tareas asignadas a otra persona (RN-40, `asignadaAOtraPersona` en `dominio/tareas.ts`; tests en `server/tests/my-day.routes.test.ts`). «Deshacer» solo lo puede quien la resolvió, el mismo día, o un administrador (403 si no). Completar una tarea solo admite JSON (las tareas no llevan fotos; `multipart` responde 415).
- **Animales archivados (CU-28 A5, RN-22):** cambiar el estado de un animal fallecido o trasladado (`PATCH /animals/:id/status`) es solo del administrador: el servicio responde **403** `ARCHIVED_STATUS_ADMIN_ONLY` a un cuidador. El resto de la información de esos animales no la puede cambiar nadie (422 `ANIMAL_ARCHIVED_READ_ONLY`, regla de negocio, no de permisos), salvo «En memoria» (`PATCH /animals/:id/memorial`, todo el personal). Lo comprueban `admin-animals.routes.test.ts` y `animal-archived.routes.test.ts`.
- **Turnos y ausencias (CU-60 a CU-64):** consultar las plantillas de turno y el calendario (`GET /shift-templates`, `GET /shifts`) es de todo el personal; crear, editar o borrar plantillas, asignar, quitar, copiar la semana y todo lo de las ausencias lleva `requireRole('admin')`. En el calendario, el servidor quita el motivo y las notas de las ausencias ajenas cuando consulta un cuidador (dato personal). «Mis fichajes» (`GET /my-shifts`) es de todo el personal y solo devuelve los turnos de quien consulta. Fichar (`POST /shift-assignments/:id/check-in` y `/check-out`) solo se puede sobre un turno propio: uno ajeno responde **404**, como cualquier recurso de otra persona. Desactivar a un trabajador quita también sus turnos futuros sin fichar.
- **Cuidados (CU-65 a CU-69):** la pestaña «Cuidados» (`GET /animals/:id/care`) y todo lo de dietas, pautas de medicación y visitas veterinarias (`/animals/:id/diet-items`, `/diet-items/:id`, `/animals/:id/medication-plans`, `/medication-plans/:id` y `/end`, `/animals/:id/vet-visits`, `/vet-visits/:id`, `/cancel` y `/complete`) es de todo el personal (`requireRole('caretaker', 'admin')` del panel), sin más restricciones: son datos del animal, no de una persona. Al completar una comida, los animales anotados deben ser de esa tarea (error en el campo si no). Las dosis respetan la cualificación como cualquier tarea (RN-25).
- **Planes (CU-40):** todas las rutas de `/plans` llevan `requireRole('admin')`, también la de borrar un plan sin uso (`DELETE /plans/:id`, que además solo borra si nunca se ha usado y no es el plan por defecto). Tests en `server/tests/admin-plans.routes.test.ts` y `server/tests/admin.routes.test.ts`.
- **Incidencias, relevo y avisos (CU-70 a CU-74):** comunicar, consultar y cambiar el estado de las incidencias (`GET`/`POST /incidents`, `GET /incidents/summary`, `GET /incidents/:id`, `PATCH /incidents/:id/status`) y las notas de relevo (`/handover-notes`, `/handover-notes/:id/read`) es de todo el personal; crear la tarea de una incidencia, el panel «Hoy» y los avisos por email (`POST /incidents/:id/task`, `GET /today`, `/alert-settings`) llevan `requireRole('admin')`. Una nota de relevo solo se escribe en una zona del turno de hoy (el administrador, en cualquiera) y solo se lee (y se marca) si es de una zona que se puede ver: si no, **404**. La foto de una incidencia exige `X-Requested-With`. Los emails de aviso solo se envían a personas que siguen en activo.
- El cliente nunca decide permisos: solo oculta la interfaz (`RequireRole` en las rutas de React). El servidor decide siempre.

## 9. Respuestas y mensajes de error

- Toda entrada se valida con Zod (`validate`). Un error de validación responde 400 con los campos que fallan.
- No se devuelven filas de la base de datos tal cual: cada modelo tiene su `mapRow`, y los servicios exponen solo los datos públicos (`toSessionUser`). Nunca salen hashes, tokens, secretos ni datos internos.
- Los errores pasan por el `errorHandler` central con la forma `{ error: { code, message, details } }`. Un error inesperado responde 500 con un mensaje genérico y se registra en el log, pero sin trazas ni SQL para el cliente.

| Código | `code` | Mensaje (texto exacto) |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | «Los datos enviados no son válidos.» (cada campo lleva el suyo en `details`) |
| 401 (login) | `INVALID_CREDENTIALS` | «Email o contraseña incorrectos.» |
| 401 (resto) | `UNAUTHORIZED` | «Tienes que iniciar sesión.» |
| 403 | `FORBIDDEN` | «No tienes permiso para esta acción.» |
| 403 | `ACCOUNT_INACTIVE` | «Esta cuenta no está activa. Contacta con el santuario.» (definido, pero ninguna ruta lo devuelve: el login responde `INVALID_CREDENTIALS`, §6.4) |
| 403 | `EMAIL_NOT_VERIFIED` | «Verifica tu email para poder adoptar.» |
| 403 | `ORIGIN_NOT_ALLOWED` | «La petición no procede de la web del santuario.» |
| 404 | `NOT_FOUND` | «No encontrado.» (o uno más concreto, como «Este usuario no existe.») |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | «La petición debe enviarse en formato JSON.» |
| 422 | `INVALID_TOKEN` | «El enlace no es válido o ha caducado.» |
| 422 | `INVALID_CURRENT_PASSWORD` | «La contraseña actual no es correcta.» |
| 422 | `PASSWORD_UNCHANGED` | «La nueva contraseña debe ser distinta de la actual.» |
| 429 | `TOO_MANY_REQUESTS` | «Demasiados intentos; espera unos minutos.» |

Los mensajes de esta tabla son los del servidor, en castellano. El cliente los muestra traducidos al idioma de la persona (i18next).

## 10. Forma del usuario público (`SessionUser`)

```ts
{
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'adopter' | 'caretaker' | 'admin';
  emailVerified: boolean;
  preferredLanguage: 'es' | 'ca' | 'en';
}
```

Es lo único que devuelven `login` y `me` (`toSessionUser` en `auth.service.ts`). Nunca incluye el hash de la contraseña, tokens, teléfono, fechas internas ni el estado de la cuenta.

## 11. Protección frente a ataques

| Riesgo | Protección en este proyecto |
| --- | --- |
| Fuerza bruta en el login | Límites por IP y email y solo por IP (§7) |
| Abuso del registro (inundar un buzón) | Límites por IP y por email (§7) |
| Enumeración de usuarios | Registro, login y recuperación responden igual y tardan lo mismo (§6.4) |
| Fijación de sesión | Identificador nuevo al iniciar sesión |
| Sesión robada | Caduca a los 7 días sin uso; el cambio de contraseña cierra las demás sesiones (CU-24); un administrador puede cerrarlas todas (CU-48) |
| Enlace de recuperación robado | Caduca en 30 minutos y es de un solo uso |
| Robo de la base de datos | Argon2id para las contraseñas; SHA-256 para los identificadores de sesión y los tokens |
| Tokens predecibles | `crypto.randomBytes` |
| CSRF (que otra web haga peticiones en tu nombre) | `SameSite=Lax`. Además, `requireSameOrigin` rechaza las peticiones que modifican datos con un `Origin` distinto de `CLIENT_URL` o con `Sec-Fetch-Site: cross-site` (403 `ORIGIN_NOT_ALLOWED`), y `requireJson` solo acepta `application/json` (las subidas `multipart` exigen `X-Requested-With`). Ningún `GET` modifica datos |
| CORS permisivo | No hay CORS: cliente y API comparten origen (proxy de Vite en desarrollo y Express sirviendo el cliente en producción). No se envía ninguna cabecera `Access-Control-Allow-*`. Si algún día hiciera falta, sería con una lista blanca explícita, nunca con `*` ni reflejando el origen recibido |
| XSS (código ajeno que se ejecuta en la página) | React escapa por defecto; prohibido `dangerouslySetInnerHTML` con contenido del usuario; cookie `HttpOnly`; CSP de helmet; las plantillas de email escapan los datos (`escapeHtml`) |
| Cabeceras HTTP | `helmet` (CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, HSTS) y sin `X-Powered-By` |
| Redirecciones abiertas | `safeNext` solo acepta rutas internas (`/…`, nunca `//` ni `/\`) |
| Inyección SQL | Solo consultas parametrizadas; ordenación con lista blanca |
| Cuerpos enormes | JSON de 100 kB como máximo; contraseñas de 128 caracteres como máximo (en el login, una más larga son credenciales incorrectas, sin calcular el hash) |
| Fugas en los logs | pino oculta `cookie`, `authorization`, `set-cookie`, `password`, `newPassword`, `currentPassword` y `token` |

## 12. Datos personales y secretos

- Se guardan solo los datos necesarios para cada finalidad (RGPD en TECH_SPEC §13). Hay supresión por anonimización (CU-25).
- Los secretos (`SESSION_SECRET`, credenciales de la base de datos y del SMTP) van en `.env`, que no se sube al repositorio. `.env.example` solo lleva valores de ejemplo.
- Las sesiones caducadas se borran cada 15 minutos. Los tokens caducados, en la tarea `expire-pending`.
- **Registro de actividad (CU-42):**
  - Los controladores del panel anotan cada escritura con `ActivityLogService` (`server/src/services/activity-log.service.ts`).
  - Antes de guardar, `limpiarDetalles` (`server/src/dominio/actividad.ts`) quita cualquier clave que pueda contener una contraseña, un token o un hash.
  - El registro solo lo lee el administrador (`GET /api/admin/activity-logs`). No hay ninguna ruta para modificarlo ni borrarlo.
  - CU-48 guarda ahí el motivo y el número de sesiones cerradas.
- **Certificado y recibos en PDF (CU-22, CU-19):**
  - Están en `server/src/routes/document.routes.ts`, solo para adoptantes (`requireRole('adopter')`) y siempre sobre recursos propios (el filtro por usuario va en la consulta; uno ajeno es 404).
  - El PDF se genera al momento, no se guarda y se envía con `Cache-Control: no-store`.
  - El nombre del archivo se limpia (`nombreArchivo`: solo letras, números y guiones) antes de ponerlo en `Content-Disposition`.
  - La foto del certificado se lee con `StorageService.read`, que no admite rutas fuera de `uploads/`.
  - Excepción (CU-05): el recibo de una donación se puede pedir sin sesión con `?token=`, la firma HMAC-SHA256 de `donation-receipt:<id>` con `SESSION_SECRET` (`firmar` y `firmaValida` en `server/src/utils/tokens.ts`; comparación en tiempo constante). Sin token, con uno que no es el suyo o si la donación falló, responde 404. El enlace solo lo reciben quien dona (en la respuesta y en su email).
- **Pago simulado:** la ventana pide una tarjeta, pero solo comprueba su formato en el navegador. Los datos de la tarjeta nunca se envían al servidor, no aparecen en ninguna petición y no se guardan (TECH_SPEC §11.1).
- **Datos del donante (CU-05):** apellidos, teléfono y, solo si pide el certificado, NIF y dirección. Al anonimizar una cuenta (CU-25) se vacían todos.
- **Idioma:**
  - No añade rutas.
  - `PATCH /api/me/profile` y `POST /api/auth/register` aceptan `preferredLanguage`, y `POST /api/donations` acepta `language`. Siempre se validan con `z.enum(LANGUAGES)` (solo `es`, `ca` o `en`).
  - En el SQL de los avisos, el idioma elige entre textos que van como parámetros; nunca se concatena.

## 13. Cliente

- El cliente nunca ve ni guarda el token de sesión: lo gestiona el navegador con la cookie `HttpOnly`.
- El usuario actual se obtiene de `GET /api/auth/me` (`useSession`).
- Todas las llamadas pasan por un único cliente HTTP (`client/src/api/client.ts`). Convierte cualquier error en `ApiError` y envía las cookies solo al mismo origen (`credentials: 'same-origin'`).
- Las rutas protegidas de React usan `RequireRole`. Ocultar un botón no sustituye a la autorización del servidor.
- **Sesión caducada o cerrada:** si cualquier llamada fuera de `/api/auth/` responde 401 mientras había sesión, el cliente HTTP lo avisa (`onUnauthorized`). Entonces `useSessionExpiry`, presente en las dos plantillas, vacía la caché y lleva a `/login?next=…` con el aviso «Tu sesión ha caducado». También ocurre cuando un administrador cierra las sesiones (CU-48).

## 14. Tests que lo comprueban

| Comprobación | Test |
| --- | --- |
| Argon2id con los parámetros previstos; sal distinta; sin truncar; hashes ajenos rechazados | `server/tests/utils/passwords.test.ts` |
| La contraseña no se guarda en claro (el hash es Argon2id) | `server/tests/auth.routes.test.ts` (CU-07) |
| Atributos de la cookie (`HttpOnly`, `SameSite=Lax`, `Path=/`, sin `Domain`; `__Host-` y `Secure` en producción) | `server/tests/session.test.ts` |
| En la base de datos solo está el hash del identificador de sesión y del token | `server/tests/session.test.ts`, `server/tests/models/session.model.test.ts`, `server/tests/auth.routes.test.ts` |
| Las sesiones caducadas o borradas no valen | `server/tests/session.test.ts` |
| Login sin enumeración, sesión nueva al entrar y límite de intentos | `server/tests/auth.routes.test.ts` (CU-09) |
| Límites del login por IP y email y solo por IP; el 429 indica la espera en `Retry-After` | `server/tests/rate-limit.test.ts` |
| Con demasiados intentos, el login muestra la espera y bloquea el formulario hasta que acaba | `client/tests/LoginPage.test.tsx` |
| Contraseña de más de 128 caracteres en el login: sin calcular el hash | `server/tests/auth.service.test.ts` |
| Al entrar, el cliente descarta los datos de otra cuenta | `client/tests/LoginPage.test.tsx` |
| Registro sin enumeración, sin sesión y con límite por email | `server/tests/auth.routes.test.ts` (CU-07) |
| Límites de los formularios públicos (donación y contacto) | `server/tests/donations.routes.test.ts` (CU-05), `server/tests/contact.routes.test.ts` (CU-06) |
| El asunto del contacto no admite saltos de línea (inyección de cabeceras) | `shared/tests/contact.schema.test.ts` |
| El logout invalida la sesión | `server/tests/auth.routes.test.ts` (CU-11) |
| Tokens de un solo uso; la recuperación caduca en 30 minutos y cierra todas las sesiones | `server/tests/token.test.ts`, `server/tests/auth.routes.test.ts` (CU-08, CU-10), `server/tests/services/email/templates.test.ts` |
| La invitación sirve para elegir la contraseña, caduca en 24 horas y no la anula pedir la recuperación | `server/tests/auth.routes.test.ts`, `server/tests/token.test.ts`, `server/tests/admin-users.routes.test.ts` (CU-36) |
| Desactivar una cuenta cierra sus sesiones; no se puede desactivar la propia ni dejar sin administrador activo | `server/tests/admin-users.routes.test.ts`, `server/tests/usuarios-admin.test.ts` (CU-35) |
| Cerrar las sesiones de un usuario: solo el administrador, con motivo, solo las de ese usuario, la propia se mantiene y queda en el registro de actividad | `server/tests/admin-user-sessions.routes.test.ts`, `client/tests/UserAdminPage.test.tsx` (CU-48) |
| Enlace para que un trabajador cambie su contraseña: solo el administrador, solo a trabajadores activos que no sean él, 30 minutos, anula el anterior, cierra las sesiones al usarse y queda en el registro de actividad | `server/tests/admin-users.routes.test.ts`, `server/tests/usuarios-admin.test.ts`, `server/tests/admin.routes.test.ts`, `client/tests/UserAdminPage.test.tsx` (CU-51) |
| El cambio de contraseña cierra las demás sesiones | `server/tests/profile.routes.test.ts` (CU-24) |
| Eliminar la cuenta pide la contraseña, solo la puede usar un adoptante, anonimiza los datos y cierra todas sus sesiones | `server/tests/account-deletion.routes.test.ts` (CU-25) |
| El administrador elimina del todo una cuenta (con datos enlazados, solo con `force`) o la anonimiza, nunca la suya; se cierran sus sesiones y queda en el registro de actividad | `server/tests/admin-user-deletion.routes.test.ts`, `server/tests/admin-user-anonymize.routes.test.ts`, `server/tests/usuarios-admin.test.ts`, `client/tests/UserAdminPage.test.tsx` (CU-75, CU-76) |
| Rutas privadas sin sesión o sin rol | `server/tests/admin.routes.test.ts`, `server/tests/auth.middleware.test.ts` y los tests de cada router |
| Recursos ajenos → 404 | Tests de cada router (`adoptions.routes`, `feed.routes`…) |
| Origen no permitido y solo JSON | `server/tests/require-same-origin.test.ts`, `server/tests/require-json.test.ts`, `server/tests/app.test.ts` |
| Cabeceras de helmet | `server/tests/app.test.ts` |
| Las respuestas no exponen campos privados | `server/tests/auth.routes.test.ts`, `server/tests/profile.routes.test.ts` |
| Los logs ocultan datos sensibles | `server/tests/logger.test.ts` |
| Certificado y recibos en PDF: solo adoptantes, solo los propios (ajeno → 404), sin caché | `server/tests/documents.routes.test.ts` (CU-22, CU-19), `server/tests/documentos.test.ts` |
| Recibo de una donación sin cuenta: solo con la firma de esa donación (otra, ninguna o una fallida → 404) | `server/tests/donations.routes.test.ts`, `server/tests/utils/tokens.test.ts` (CU-05) |
| Los datos de la tarjeta del pago simulado no se pasan a la API | `client/tests/PaymentModal.test.tsx` |
| El idioma solo admite `es`, `ca` o `en`; emails, avisos y PDF en el idioma de cada persona | `server/tests/idioma.routes.test.ts`, `server/tests/profile.routes.test.ts` |
| El registro de actividad no guarda contraseñas ni tokens y solo lo ve el administrador | `server/tests/actividad.test.ts`, `server/tests/admin-activity.routes.test.ts` (CU-42) |
| Trabajo diario: configuración solo del administrador; completar exige la cualificación (servicio y trigger); deshacer, quien la resolvió o un administrador | `server/tests/admin.routes.test.ts`, `server/tests/admin-zones.routes.test.ts`, `server/tests/admin-task-templates.routes.test.ts`, `server/tests/my-day.routes.test.ts` (CU-52 a CU-57) |
| Turnos: cambiar el calendario, las plantillas y las ausencias es solo del administrador; cada persona ficha solo sus turnos (404 en los ajenos); el cuidador no ve el motivo de las ausencias ajenas | `server/tests/admin.routes.test.ts`, `server/tests/shifts.routes.test.ts`, `server/tests/absences.routes.test.ts`, `server/tests/my-day-shifts.routes.test.ts` (CU-60 a CU-63) |
| Cuidados: dietas, pautas y visitas, de cuidadores y administradores (401/403 al resto) | `server/tests/admin.routes.test.ts`, `server/tests/animal-care.routes.test.ts`, `server/tests/feeding.routes.test.ts` (CU-65 a CU-69) |
| Incidencias, relevo y avisos: el estado de una incidencia lo cambia todo el personal; su tarea, «Hoy» y los avisos, solo el administrador; notas solo de las zonas del turno (404 en las demás); emails solo a personas en activo | `server/tests/admin.routes.test.ts`, `server/tests/incidents.routes.test.ts`, `server/tests/handover-notes.routes.test.ts`, `server/tests/today.routes.test.ts`, `server/tests/alert-settings.routes.test.ts`, `server/tests/jobs/staff-emails.job.test.ts` (CU-70 a CU-74) |

## 15. Fuera de alcance

- Inicio de sesión con cuentas de otros servicios (OAuth: Google, Apple…).
- Verificación en dos pasos (MFA) y llaves de acceso (passkeys).
- JWT o cualquier otro mecanismo de sesión distinto de las sesiones en el servidor.
- «Cerrar sesión en todos mis dispositivos» para cualquier usuario (solo existe para el administrador, CU-48).
- Ver la lista de sesiones abiertas (dispositivo, fecha, lugar).
- Comprobar si una contraseña aparece en filtraciones conocidas, porque requeriría un servicio externo. Se puede valorar con una lista local.

## 16. Pendiente

- **Fase 4 (producción):**
  - Servir el cliente desde Express, para que la CSP y la `Referrer-Policy` de helmet también protejan las páginas `/verify-email` y `/reset-password`, que llevan el token en la URL. En desarrollo esas páginas las sirve Vite, sin esas cabeceras. Al hacerlo, revisar la CSP para el cliente compilado.
  - La página `/cookies` muestra el nombre `sid`; en producción la cookie se llama `__Host-sid`.
- **Si hay varias instancias del servidor:** llevar los contadores de los límites de intentos a un almacén compartido.

## 17. Antes de dar por terminada una tarea de seguridad

1. Revisar el diff completo.
2. Comprobar que no hay dependencias nuevas sin autorizar.
3. Ejecutar `npm test`, `npm run typecheck` y `npm run lint`.
4. Comprobar que no hay secretos, contraseñas reales ni tokens en el código ni en los logs.
5. Comprobar que no se han cambiado tests ni reglas de seguridad sin autorización.
6. Actualizar este documento, TECH_SPEC y los casos de uso si ha cambiado algo.
7. Informar de cualquier limitación o test pendiente.

Una tarea no está terminada si algún test de seguridad falla.
