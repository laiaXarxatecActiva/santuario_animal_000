# Santuario de Animales — Casos de uso

## 1. Cómo leer este documento

Cada caso de uso tiene una ficha con estos apartados:

- **ID y nombre:** `CU-xx`. Los identificadores se citan en el código, las pruebas y los commits.
- **Actor principal** y **fase** de desarrollo en la que se implementa (ver `TECH_SPEC.md` §16).
- **Precondiciones:** lo que debe cumplirse antes de empezar.
- **Flujo principal:** el camino habitual, paso a paso.
- **Flujos alternativos:** desvíos y errores, numerados según el paso en el que ocurren (por ejemplo, *3a* ocurre en el paso 3).
- **Postcondiciones:** cómo queda el sistema al terminar con éxito.
- **Reglas de negocio:** referencias a la tabla de la [sección 3](#3-reglas-de-negocio).

Los nombres de tablas, columnas y valores de estado se escriben en inglés, tal como están en la base de datos.

Errores comunes a todos los casos que no se repiten en cada ficha:

- **Sin sesión** en una acción que la requiere: se redirige a «Iniciar sesión» y, tras entrar, se vuelve a la página de origen.
- **Rol sin permiso:** el servidor responde con 403 y se muestra «No tienes permiso para esta acción».
- **Recurso ajeno o inexistente:** el servidor responde con 404 y se muestra «No encontrado».
- **Datos no válidos:** se muestran los errores junto a cada campo y no se guarda nada.
- **Error del servidor:** mensaje genérico «Algo ha ido mal; inténtalo de nuevo», sin detalles técnicos.

## 2. Actores

| Actor | Descripción |
| --- | --- |
| **Visitante** | Cualquier persona sin sesión iniciada |
| **Adoptante** | Persona externa registrada (`role = 'adopter'`). Puede hacer todo lo que hace el visitante. |
| **Cuidador** | Trabajador del santuario (`role = 'caretaker'`). Gestiona animales, fotos, especies, actualizaciones e historial veterinario. No gestiona dinero ni usuarios. |
| **Administrador** | Trabajador del santuario (`role = 'admin'`). Tiene todos los permisos del cuidador, más la gestión de usuarios, adopciones, pagos, donaciones, planes, estadísticas y registro de actividad. |
| **Sistema** | Procesos automáticos: tareas programadas, pasarela de pago simulada y envío de emails |

«Usuario autenticado» se refiere a cualquiera de los tres roles con sesión iniciada. «Trabajador» se refiere a cuidador o administrador.

## 3. Reglas de negocio

| ID | Regla |
| --- | --- |
| RN-01 | Cada usuario tiene un único rol: `adopter`, `caretaker` o `admin`. El visitante no se guarda en la base de datos. |
| RN-02 | El registro público crea siempre adoptantes. Las cuentas de trabajador solo las crea un administrador. |
| RN-03 | Un trabajador nunca adopta con su cuenta de trabajo. Si dona con la sesión de trabajo iniciada, la donación se registra como hecha sin cuenta. |
| RN-04 | Hay tres planes, todos mensuales: Simbólica (1 €), Usual (5 €, preseleccionado) y Extraordinaria (12 €). Los tres dan acceso a lo mismo. El administrador puede cambiar su nombre, importe y descripción, pero no crear otras periodicidades. |
| RN-05 | Un animal puede tener varios adoptantes a la vez y un adoptante puede adoptar a varios animales, pero no puede tener dos adopciones abiertas (`pending`, `active` o `paused`) del mismo animal. |
| RN-06 | Solo se puede adoptar un animal publicado (`is_published`), disponible (`is_adoptable`) y en estado `in_sanctuary` o `in_treatment`. |
| RN-07 | Una adopción se crea como `pending` y pasa a `active` cuando se confirma el primer pago. Si en 7 días no se completa el pago, pasa a `cancelled` (`payment_not_completed`). |
| RN-08 | Cada mes, en `next_billing_date`, se cobra la cuota de las adopciones activas con pago automático (`payment_mode = 'automatic'`, el valor por defecto). Si el cobro falla, la adopción pasa a `paused` y se avisa al adoptante, que puede regularizarla. Con pago manual (CU-49), el adoptante paga cada cuota: se le avisa 7 días antes y, si pasan 7 días desde la cuota sin pagarla, la adopción pasa a `paused` (CU-50). |
| RN-09 | Un cambio de plan se aplica a partir de la siguiente cuota. |
| RN-10 | Cuando el adoptante se da de baja, la adopción sigue activa hasta el final del mes pagado y después pasa a `finished` (`user_cancelled`). No se hacen devoluciones parciales. |
| RN-11 | Si un animal fallece o se traslada, sus adopciones abiertas pasan a `finished` (`animal_deceased` o `animal_transferred`) y se ofrece al adoptante continuar con otro animal. El aviso de fallecimiento lo redacta el santuario a mano. |
| RN-12 | Una donación es un pago único de importe libre, sin mínimo (mayor que 0), con o sin cuenta, opcionalmente anónima, y no se vincula a ningún animal. |
| RN-13 | Los pagos son simulados. Nunca se piden ni se guardan datos de tarjeta. |
| RN-14 | El santuario se compromete a publicar al menos una actualización cada 14 días por cada animal con adoptantes activos. El panel avisa cuando quedan 2 días (12 días sin actualización) y muestra una alerta en rojo si se superan los 14. |
| RN-15 | El contenido exclusivo (actualizaciones y fotos `adopters`, resumen de salud) solo lo ven los adoptantes con una adopción **activa** del animal y los trabajadores. |
| RN-16 | El nombre de un adoptante aparece en la ficha pública solo si tiene una adopción activa del animal y ha activado `show_public_name`. Por defecto, no aparece. |
| RN-17 | Lo que tiene historial económico o afectivo (animales, adopciones, pagos, donaciones, usuarios) no se borra: se archiva con un estado o se anonimiza. |
| RN-18 | Los permisos se comprueban siempre en el servidor. |
| RN-19 | Los emails de actualizaciones y resúmenes respetan las preferencias del usuario. Los emails de seguridad (verificación, contraseña) y de pagos se envían siempre. |
| RN-20 | La baja de una cuenta anonimiza los datos personales y conserva los pagos y donaciones. |
| RN-21 | Para adoptar hay que tener el email verificado (provisional; ver `TECH_SPEC.md` §18). |
| RN-22 | Los fallecidos y trasladados no aparecen en el catálogo; los fallecidos pueden aparecer en «En memoria» (Fase 3). Ya no están en el santuario, así que su información solo se consulta: ni sus datos, ni sus fotos, ni sus actualizaciones, ni su historial veterinario se pueden crear, cambiar o borrar (422 `ANIMAL_ARCHIVED_READ_ONLY`). Lo único que se cambia es «En memoria» y, si fue un error, su estado (solo el administrador, CU-28 A5). |
| RN-23 | El cuidador no gestiona dinero ni usuarios y no ve datos económicos (ingresos, pagos, donaciones). |
| RN-24 | Trabajo diario: las tareas recurrentes salen de **plantillas** y se generan cada día con 7 días de antelación, en la hora de Madrid, una sola vez por plantilla y hora (la generación es idempotente). Nunca se generan para animales fallecidos o trasladados, y al archivar un animal se retira de sus tareas pendientes. |
| RN-25 | Una tarea que exige una **cualificación** solo la puede completar, marcar como no realizada o tener asignada un trabajador que la tenga (también un administrador). Se comprueba en el servidor y en la base de datos. |
| RN-26 | Una tarea solo se resuelve el mismo día (no antes). Está **atrasada** si sigue pendiente pasada su hora más el margen configurado (30 minutos por defecto); no se guarda, se calcula. Al acabar el día, las pendientes pasan a «no realizada» por el sistema. |
| RN-27 | Las tareas puntuales solo las crea el administrador; el personal comunica los problemas con incidencias (CU-70). Las plantillas, zonas y cualificaciones con historial no se borran: se desactivan. |
| RN-28 | Turnos: una persona no puede estar en dos turnos que se solapen el mismo día ni en un turno un día en que está ausente. Los turnos de días pasados o ya fichados no se quitan. Al desactivar a un trabajador se quitan sus turnos de hoy en adelante sin fichar. |
| RN-29 | Al registrar una ausencia se quitan los turnos de esos días que la persona no ha fichado, y se dice cuáles; borrar la ausencia no los devuelve. El motivo de una ausencia solo lo ven el administrador y la propia persona; el resto del personal solo ve que está ausente. |
| RN-30 | Cada persona ficha solo sus turnos y solo el día del turno: primero la entrada y después la salida, una vez cada una. |
| RN-31 | Una zona de un turno está **sin cubrir** si tiene menos personas de las que pide la plantilla del turno; se calcula al consultar, no se guarda. Cada hueco se avisa a los administradores una sola vez. |
| RN-32 | La **dieta** es la ficha de qué come cada animal y no crea tareas. Al completar una tarea de alimentación se anota lo que ha comido cada animal (sus animales o, si no tiene, los que viven en su zona) en cuatro niveles: «Todo» (por defecto), «Más de la mitad», «Menos de la mitad» y «Nada». |
| RN-33 | Un animal **come poco** si en sus últimas tomas seguidas (2 por defecto, configurable de 1 a 10) ha comido «Menos de la mitad» o «Nada». Cada racha se avisa una sola vez. |
| RN-34 | Los avisos de cuidados (come poco, medicación no dada y visita de hoy) van a los administradores en activo y a quien tiene turno ese día en la zona del animal, una sola vez cada uno. |
| RN-35 | Las **pautas de medicación** generan una dosis (tarea) por día y hora, como las plantillas, con la cualificación que se elija. Una pauta con dosis resueltas no se borra: se termina. Una dosis no dada es una pendiente pasada su hora más el margen, o una marcada como no realizada. |
| RN-36 | Una **visita veterinaria** programada no es de un día pasado y tiene su tarea en «Mi día». Solo se registra desde su día, con el formulario del historial veterinario. Dietas, pautas y visitas las gestionan cuidadores y administradores, y no se crean para animales fallecidos o trasladados; pautas y visitas necesitan que el animal tenga zona. |
| RN-37 | Cualquier trabajador comunica una **incidencia** (tipo, gravedad, zona o animal, un título corto de 3 a 80 caracteres, la descripción y foto opcional) y ve todas. Todo el personal la resuelve (con una nota obligatoria) y la reabre si el problema vuelve; pasa a «en curso» cuando el administrador crea su tarea; queda quién la resolvió, cómo y cuándo, y cada cambio en el registro de actividad. Solo el administrador crea una tarea puntual a partir de ella, que la pasa a «en curso». Solo las de gravedad **alta** se avisan al momento, a los administradores en activo y a quien tiene turno hoy en la zona, sin contar a quien la comunica. |
| RN-38 | Las **notas de relevo** son de una zona: las escribe quien tiene turno hoy en ella (el administrador, en cualquiera) y las ve durante 24 horas quien tiene turno hoy en esa zona y los administradores. Cada persona las marca como leídas; las propias cuentan como leídas. |
| RN-39 | Los avisos del personal (huecos, come poco, medicación no dada, visita de hoy e incidencia grave) siempre van a la campana; el administrador elige cuáles van **también por email**, para todo el personal (todos menos la visita de hoy, por defecto). El email se envía aparte (`staff-emails`), así que un fallo del correo nunca deshace la operación. El **resumen diario** por email a los administradores está desactivado por defecto (a las 20:00 si se activa) y se envía una vez al día. |

## 4. Web pública y cuenta

### CU-01 — Consultar la página de inicio

| Actor principal | Fase |
| --- | --- |
| Visitante (y cualquier usuario) | 1 |

**Precondiciones**

- Ninguna.

**Flujo principal**

1. El visitante entra en la web (`/`).
2. El sistema muestra la presentación del santuario, una selección de animales destacados (tarjetas con foto, nombre y especie) y el número de animales acogidos.
3. El sistema muestra dos llamadas a la acción: «Adopta a distancia» y «Haz una donación».
4. El visitante pulsa una tarjeta o una llamada a la acción y el sistema lo lleva a la ficha del animal (CU-03), al catálogo (CU-02) o a la página de donación (CU-05).

**Flujos alternativos**

- **2a.** No hay animales publicados: se oculta la sección de destacados y se mantienen las llamadas a la acción.

**Postcondiciones**

- Ninguna (solo lectura).

**Reglas de negocio:** RN-22.

**Notas:** son destacados los animales publicados y disponibles con menos adoptantes activos (como máximo 6), para darles visibilidad. El contador incluye los animales en estado `in_sanctuary` o `in_treatment`.

### CU-02 — Consultar el catálogo de animales

| Actor principal | Fase |
| --- | --- |
| Visitante (y cualquier usuario) | 1 |

**Precondiciones**

- Ninguna.

**Flujo principal**

1. El visitante entra en «Animales» (`/animals`).
2. El sistema muestra una página de tarjetas con foto (miniatura de la portada), nombre, especie y número de adoptantes activos. Por defecto, primero los más recientes.
3. El visitante aplica filtros (especie, sexo, rango de edad, «disponible para adoptar»), busca por nombre o cambia el orden (más recientes, por nombre, menos adoptantes). En especie y en rango de edad puede marcar varias opciones a la vez: se muestran los animales que cumplen cualquiera de ellas (p. ej., buitres leonados **o** negros; menores de 5 **o** mayores de 15). El sexo es de una sola opción (cualquiera, macho o hembra).
4. El sistema actualiza el listado y la paginación. Los filtros se reflejan en la URL para poder compartirla.
5. El visitante pulsa una tarjeta y pasa a CU-03.

**Flujos alternativos**

- **4a.** Ningún animal cumple los filtros: se muestra «No hay animales con estos filtros» y un botón para limpiarlos.
- **4b.** Página fuera de rango: se muestra la última página disponible.

**Postcondiciones**

- Ninguna (solo lectura).

**Reglas de negocio:** RN-22.

**Notas:** solo aparecen animales con `is_published = TRUE` y estado `in_sanctuary` o `in_treatment`. Los animales no adoptables (por ejemplo, uno que se prepara para su liberación) aparecen sin el botón de adoptar, salvo si se filtra por «disponible para adoptar». El filtro de sexo ofrece «Macho» y «Hembra»: todos los animales tienen el sexo definido.

### CU-03 — Consultar la ficha pública de un animal

| Actor principal | Fase |
| --- | --- |
| Visitante (y cualquier usuario) | 1 |

**Precondiciones**

- El animal está publicado y su estado es `in_sanctuary` o `in_treatment`.

**Flujo principal**

1. El visitante abre la ficha (`/animals/:id`).
2. El sistema muestra la galería de fotos públicas en su orden, nombre, especie, sexo, edad aproximada, fecha de llegada, historia de rescate, carácter y necesidades especiales.
3. El sistema muestra el número de adoptantes activos y los nombres de quienes han permitido aparecer.
4. El sistema muestra las últimas actualizaciones marcadas como públicas.
5. Si el animal es adoptable, el sistema muestra el botón «Adoptar a este animal», que inicia CU-13.

**Flujos alternativos**

- **1a.** El animal no existe, no está publicado o está fallecido o trasladado: se muestra «Este animal no está disponible» y un enlace al catálogo. Si está fallecido y en «En memoria» (Fase 3), se enlaza a CU-12.
- **3a.** El animal no tiene adoptantes: se muestra «Todavía nadie ha adoptado a [nombre]. ¿Quieres ser el primero?».
- **5a.** El animal no es adoptable: el botón no aparece y se explica el motivo de forma genérica («Ahora mismo no admite adopciones»).
- **5b.** El usuario es adoptante y ya tiene una adopción abierta de este animal: en lugar del botón, se muestra «Ya adoptas a [nombre]» con un enlace a su ficha ampliada (CU-16).
- **5c.** El usuario es un trabajador: el botón no aparece (RN-03) y se muestra un enlace para editar el animal en el panel.

**Postcondiciones**

- Ninguna (solo lectura).

**Reglas de negocio:** RN-05, RN-06, RN-15, RN-16, RN-22.

### CU-04 — Consultar cómo funciona la adopción simbólica

| Actor principal | Fase |
| --- | --- |
| Visitante (y cualquier usuario) | 1 |

**Precondiciones**

- Ninguna.

**Flujo principal**

1. El visitante entra en «Cómo funciona» (`/how-it-works`).
2. El sistema explica que:
   - la adopción es simbólica (también llamada apadrinamiento o adopción a distancia) y el animal sigue viviendo en el santuario;
   - hay tres planes mensuales, con sus importes actuales leídos de la base de datos;
   - se recibe una actualización del animal cada dos semanas;
   - un mismo animal puede tener varios adoptantes a la vez;
   - el plan se puede cambiar (desde la siguiente cuota) y uno puede darse de baja cuando quiera.
3. El visitante pulsa «Ver animales» y pasa a CU-02.

**Postcondiciones**

- Ninguna (solo lectura).

**Reglas de negocio:** RN-04, RN-05, RN-09, RN-10, RN-14.

### CU-05 — Hacer una donación

| Actor principal | Fase |
| --- | --- |
| Visitante o usuario autenticado | 2 |

**Precondiciones**

- Ninguna. No hace falta tener cuenta.

**Flujo principal**

1. El usuario entra en «Donar» (`/donate`).
2. El sistema muestra el formulario: importe (libre, con algunas cantidades sugeridas), nombre, apellidos, email, teléfono opcional, casilla «Donación anónima», mensaje opcional, casilla «Quiero el certificado para desgravar» y la aceptación de la política de privacidad. Si hay sesión de adoptante, el nombre, los apellidos y el email se rellenan con los de su cuenta. El email es obligatorio aunque la donación sea anónima: con él se envía el recibo y se avisa de la operación.
3. El usuario completa el formulario y pulsa «Continuar».
4. El sistema valida los datos y muestra la pantalla de pago simulado con el aviso «Pago simulado: no se realizará ningún cargo real» y los campos de la tarjeta.
5. El usuario escribe una tarjeta con buen formato (solo se comprueba el formato y nunca se envía ni se guarda) y pulsa «Simular pago correcto».
6. El sistema crea la donación (`pending`), la cobra con la pasarela simulada y la marca como `completed` con su `paid_at` y su referencia.
7. El sistema muestra una página de agradecimiento con el recibo, que se puede ver o descargar en PDF, y envía un email de agradecimiento con el recibo y el enlace al PDF.
8. Si el usuario es adoptante, la donación queda vinculada a su cuenta y aparece en «Mis aportaciones» (CU-19), además de recibir una notificación `donation_thanks`.

**Flujos alternativos**

- **3a.** Importe vacío, 0, negativo o con más de dos decimales: error en el campo. No hay importe mínimo.
- **3b.** Falta el nombre, los apellidos, el email o la aceptación de la privacidad, o el email o el teléfono tienen un formato no válido: error en el campo.
- **3c.** Con «Quiero el certificado para desgravar» marcado, faltan el NIF, la dirección, el código postal, la provincia o el país, o el NIF (con su letra) o el código postal no son válidos: error en el campo. Con los datos correctos, el PDF se titula «Certificado de donación» e incluye el NIF y la dirección.
- **5b.** La tarjeta tiene un formato no válido (número, caducidad pasada o CVC): error en el campo y no se cobra.
- **5a.** El usuario pulsa «Simular pago fallido»: la donación se guarda como `failed` con su motivo, y el sistema muestra en una ventana emergente «El pago no se ha completado» con la opción de volver a intentarlo. Un nuevo intento crea una donación nueva.
- **6a.** El usuario tiene sesión de trabajador: la donación se guarda sin `user_id` (RN-03).

**Postcondiciones**

- Existe un registro en `donations` con el estado final del pago.
- Si se marcó como anónima, el nombre del donante no aparece en ningún listado público. El administrador sí ve el registro, marcado como «Anónimo».

**Reglas de negocio:** RN-03, RN-12, RN-13, RN-19.

### CU-06 — Enviar el formulario de contacto

| Actor principal | Fase |
| --- | --- |
| Visitante (y cualquier usuario) | 2 |

**Precondiciones**

- Ninguna.

**Flujo principal**

1. El visitante entra en «Sobre el santuario» (`/about`), que incluye la historia, la ubicación y el formulario de contacto.
2. Rellena nombre, email, asunto y mensaje, y acepta la política de privacidad.
3. El sistema valida los datos y envía un email al buzón del santuario (`SANCTUARY_EMAIL`), con el email del visitante como dirección de respuesta.
4. El sistema muestra «Mensaje enviado. Te responderemos lo antes posible».

**Flujos alternativos**

- **3a.** Faltan campos obligatorios o el email no es válido: errores en los campos.
- **3b.** Demasiados envíos desde la misma IP (más de 5 por hora): se muestra «Has enviado demasiados mensajes; inténtalo más tarde».
- **3c.** Falla el envío del email: se muestra un mensaje de error y se conserva lo escrito en el formulario.

**Postcondiciones**

- El mensaje llega al buzón del santuario. No se guarda en la base de datos.

### CU-07 — Registrarse

| Actor principal | Fase |
| --- | --- |
| Visitante | 1 |

**Precondiciones**

- El visitante no tiene sesión iniciada.

**Flujo principal**

1. El visitante entra en «Registrarse» (`/register`), directamente o al intentar adoptar.
2. Introduce nombre, apellidos, email, contraseña (mínimo 10 caracteres) y su confirmación, y acepta la política de privacidad.
3. El sistema valida los datos y comprueba que el email no esté registrado (sin distinguir mayúsculas).
4. El sistema crea el usuario con `role = 'adopter'`, `email_verified = FALSE`, la contraseña con hash y `privacy_accepted_at`.
5. El sistema crea un token de verificación (24 horas) y envía el email de verificación.
6. El sistema responde «Te hemos enviado un email. Revisa tu bandeja de entrada para continuar.» **sin iniciar la sesión** (abrirla revelaría que el email no tenía cuenta) y lleva a «Iniciar sesión». Si venía de adoptar, tras iniciar sesión vuelve a la ficha del animal.

**Flujos alternativos**

- **3a.** El email ya está registrado: no se crea nada y la respuesta es **idéntica** a la del flujo principal, para no revelar qué cuentas existen. Si la cuenta está activa, se envía a ese email el aviso «Ya tienes una cuenta en el santuario», con enlaces a «Iniciar sesión» y «He olvidado mi contraseña» (si está desactivada, no se envía nada). La contraseña se procesa igualmente para que la respuesta tarde lo mismo.
- **3b.** Las contraseñas no coinciden o no cumplen el mínimo: error en el campo.
- **3c.** No se acepta la política de privacidad: no se puede continuar.
- **5a.** Falla el envío del email: la cuenta se crea igualmente y el usuario puede pedir que se reenvíe (CU-08) tras iniciar sesión.
- **6a.** Demasiados registros: más de 3 por hora con el mismo email o más de 20 por hora desde la misma IP responden 429 (evita usar el formulario para inundar el buzón de otra persona).

**Postcondiciones**

- Existe un usuario adoptante con el email sin verificar. La sesión no se inicia hasta que entra con CU-09.

**Reglas de negocio:** RN-01, RN-02, RN-21.

### CU-08 — Verificar el email

| Actor principal | Fase |
| --- | --- |
| Adoptante | 1 |

**Precondiciones**

- El usuario se ha registrado y tiene un token de verificación.

**Flujo principal**

1. El usuario abre el enlace del email (`/verify-email?token=...`).
2. El sistema busca el token por su hash y comprueba que sea del tipo `email_verification`, que no haya caducado y que no se haya usado.
3. El sistema marca `email_verified = TRUE` y el token como usado.
4. El sistema muestra «Email verificado. Ya puedes adoptar».

**Flujos alternativos**

- **2a.** Token caducado, usado o inexistente: se muestra «El enlace no es válido o ha caducado» y, si hay sesión, un botón «Reenviar email».
- **A1. Reenviar:** el usuario, con sesión iniciada y email sin verificar, pulsa «Reenviar email de verificación». El sistema invalida los tokens anteriores, crea uno nuevo y envía el email (como máximo 3 reenvíos por hora).
- **3a.** El email ya estaba verificado: se muestra «Tu email ya estaba verificado».

**Postcondiciones**

- `users.email_verified = TRUE`.

**Reglas de negocio:** RN-21.

### CU-09 — Iniciar sesión

| Actor principal | Fase |
| --- | --- |
| Visitante (con cuenta) | 1 |

**Precondiciones**

- El usuario tiene una cuenta activa.

**Flujo principal**

1. El usuario entra en «Iniciar sesión» (`/login`).
2. Introduce el email y la contraseña.
3. El sistema busca el usuario por email (sin distinguir mayúsculas) y compara la contraseña con el hash.
4. El sistema regenera la sesión, guarda el `userId` y actualiza `last_login_at`.
5. El sistema redirige según el rol: el adoptante, a la página de origen o a «Mis animales»; el trabajador, al escritorio del panel (`/admin`).

**Flujos alternativos**

- **3a.** Email o contraseña incorrectos: se muestra «Email o contraseña incorrectos», sin indicar cuál de los dos falla.
- **3b.** Cuenta desactivada (`is_active = FALSE`) o anonimizada: se muestra el mismo «Email o contraseña incorrectos» de 3a, para no revelar a un posible atacante que la cuenta existe ni que la contraseña es correcta.
- **3c.** Más de 5 intentos fallidos en 15 minutos: se muestra un aviso informativo (azul) con la cuenta atrás del tiempo que falta («Demasiados intentos. Podrás volver a intentarlo dentro de 14:32»), que el servidor indica en la cabecera `Retry-After` (si falta, se esperan 5 segundos). Mientras dura, el email, la contraseña y el botón «Entrar» están desactivados; al acabar, el aviso desaparece.
- **3d.** Tras cualquier intento fallido, el formulario conserva el email y borra la contraseña.
- **5a.** Email sin verificar: entra igualmente, con un aviso permanente para verificarlo (RN-21).

**Postcondiciones**

- Existe una sesión válida en `user_sessions` y la cookie `sid` en el navegador.

**Reglas de negocio:** RN-01.

### CU-10 — Recuperar la contraseña

| Actor principal | Fase |
| --- | --- |
| Visitante (con cuenta) | 1 |

**Precondiciones**

- Ninguna.

**Flujo principal**

1. El usuario pulsa «He olvidado mi contraseña» e introduce su email.
2. El sistema responde siempre «Si existe una cuenta con ese email, recibirás un enlace».
3. Si la cuenta existe y está activa, el sistema crea un token `password_reset` (30 minutos) y envía el email.
4. El usuario abre el enlace (`/reset-password?token=...`) e introduce la nueva contraseña dos veces.
5. El sistema valida el token y la contraseña, guarda el nuevo hash, marca el token como usado y cierra todas las sesiones del usuario.
6. El sistema muestra «Contraseña cambiada. Ya puedes iniciar sesión».

**Flujos alternativos**

- **3a.** El email no existe o la cuenta no está activa: no se envía nada, pero la respuesta es la misma.
- **5a.** Token caducado, usado o inexistente: «El enlace no es válido o ha caducado», con la opción de pedir otro.
- **5b.** La contraseña no cumple el mínimo o no coincide: error en el campo.

**Postcondiciones**

- La contraseña ha cambiado y no queda ninguna sesión abierta de ese usuario.

**Notas:** este mismo flujo, a partir del paso 4, se usa para que un trabajador recién creado elija su contraseña (CU-36).

### CU-11 — Cerrar sesión

| Actor principal | Fase |
| --- | --- |
| Usuario autenticado | 1 |

**Precondiciones**

- El usuario tiene sesión iniciada.

**Flujo principal**

1. El usuario pulsa «Cerrar sesión».
2. El sistema destruye la sesión en el servidor y borra la cookie.
3. El sistema redirige a la página de inicio.

**Postcondiciones**

- La sesión ya no existe en `user_sessions`.

### CU-12 — Consultar la sección «En memoria»

| Actor principal | Fase |
| --- | --- |
| Visitante (y cualquier usuario) | 3 |

**Precondiciones**

- El santuario ha marcado algún animal fallecido con `show_in_memorial = TRUE`.

**Flujo principal**

1. El visitante entra en «En memoria» (`/memorial`).
2. El sistema muestra los animales fallecidos marcados, con foto de portada, nombre, especie, fecha de llegada, fecha de fallecimiento y su historia.
3. El visitante puede abrir una ficha de solo lectura del animal, sin botón de adoptar y con sus actualizaciones públicas.

**Flujos alternativos**

- **2a.** No hay animales marcados: la sección no aparece en el menú, y si se entra por URL se muestra un mensaje neutro.

**Postcondiciones**

- Ninguna (solo lectura).

**Notas:** en el panel se marca al registrar el fallecimiento (CU-33) o, después, con el interruptor «Mostrar en «En memoria»» de la pestaña «Datos» del fallecido (`PATCH /api/admin/animals/:id/memorial`), lo único de su ficha que se puede cambiar.

**Reglas de negocio:** RN-22.

## 6. Área del adoptante

### CU-13 — Adoptar un animal

| Actor principal | Fase |
| --- | --- |
| Adoptante | 1 |

**Precondiciones**

- El animal cumple RN-06.
- El usuario es adoptante (o se registra o inicia sesión durante el flujo) y tiene el email verificado.

**Flujo principal**

1. Desde la ficha del animal (CU-03), el usuario pulsa «Adoptar a este animal».
2. Si no tiene sesión, el sistema le pide iniciar sesión (CU-09) o registrarse (CU-07) y después vuelve a este paso.
3. El sistema muestra los planes activos, con el plan por defecto (Usual) preseleccionado, y recuerda que la adopción es simbólica, que el animal no sale del santuario y que puede tener otros adoptantes. También muestra la forma de pago (CU-49), con «Automático» marcado.
4. El adoptante elige un plan (y, si quiere, el pago «Manual») y pulsa «Continuar».
5. El sistema comprueba las reglas, crea la adopción en estado `pending` y muestra la pantalla de pago simulado con el importe de la primera cuota.
6. El adoptante pulsa «Simular pago correcto».
7. El sistema, en una sola transacción:
   1. crea el pago `completed` para el primer mes (`period_start` = hoy);
   2. pasa la adopción a `active`, con `start_date` = hoy y `next_billing_date` = hoy + 1 mes.
8. El sistema crea la notificación `adoption_welcome`, envía el email de bienvenida con el recibo y redirige a «Mis animales» (CU-15).

**Flujos alternativos**

- **2a.** El usuario es un trabajador: no puede adoptar; se muestra «Las cuentas de trabajador no pueden adoptar» (RN-03).
- **2b.** Email sin verificar: se muestra «Verifica tu email para adoptar» con un botón para reenviar el email (CU-08).
- **5a.** Ya tiene una adopción abierta de ese animal: se muestra «Ya tienes una adopción en curso de [nombre]» con un enlace a ella. Si está `pending` o `paused`, se ofrece reintentar el pago (CU-14).
- **5b.** El animal ha dejado de ser adoptable mientras tanto: se muestra «Este animal ya no admite adopciones» y no se crea nada.
- **5c.** El plan elegido ya no está activo: se vuelven a cargar los planes y se pide elegir de nuevo.
- **6a.** El adoptante pulsa «Simular pago fallido»: se guarda el pago como `failed` con su motivo; la adopción sigue `pending` y se muestra, en una ventana emergente con el botón «Volver a intentarlo», «El pago no se ha completado. Puedes intentarlo de nuevo ahora o desde "Mis animales" durante 7 días» (CU-14).
- **6b.** El adoptante abandona la pantalla de pago: la adopción queda `pending` sin pago, y podrá completarla durante 7 días (CU-14). Si no, se cancela (CU-44).

**Postcondiciones**

- Éxito: adopción `active` con su primer pago `completed`. El animal suma un adoptante activo.
- Fallo: adopción `pending`, con o sin un pago `failed`.

**Reglas de negocio:** RN-03, RN-04, RN-05, RN-06, RN-07, RN-13, RN-21.

### CU-14 — Reintentar el pago de una adopción

| Actor principal | Fase |
| --- | --- |
| Adoptante | 1 (`pending`), 2 (`paused`) |

**Precondiciones**

- El adoptante tiene una adopción propia en estado `pending` (creada hace 7 días o menos) o `paused`, o una `active` con pago manual cuya cuota vence en 7 días o menos (CU-49).

**Flujo principal**

1. En «Mis animales», la adopción aparece con el aviso «Pendiente de pago» o «Pausada: la última cuota no se pudo cobrar», y el botón «Pagar ahora».
2. El adoptante pulsa el botón; el sistema muestra el importe y la pantalla de pago simulado.
3. El adoptante pulsa «Simular pago correcto».
4. El sistema crea el pago `completed` y:
   - si estaba `pending`: la pasa a `active` como en CU-13, paso 7;
   - si estaba `paused`: cobra el periodo que empieza en `next_billing_date`, la pasa a `active` y avanza `next_billing_date` un mes;
   - si estaba `active` con pago manual: aplica el cambio de plan programado (como CU-43, paso 1), cobra el periodo que empieza en `next_billing_date` y lo avanza un mes.
5. El sistema notifica el cobro (`adoption_welcome` o `payment_completed`) y vuelve a «Mis animales».

**Flujos alternativos**

- **1a.** Adopción `pending` creada hace más de 7 días: no se ofrece pagar, porque CU-44 la cancelará. Se ofrece iniciar una adopción nueva.
- **1b.** Adopción `active` con pago manual: el aviso dice cuándo vence la cuota y hasta qué día se puede pagar sin que se pause, con el botón «Pagar la cuota». Antes de los 7 días previos no se ofrece pagar (422 `ADOPTION_NOT_PAYABLE`).
- **3a.** «Simular pago fallido»: se guarda otro pago `failed` y la adopción no cambia de estado.
- **4a.** El animal ha fallecido o se ha trasladado entre tanto: la adopción ya estará cerrada (RN-11) y se informa al adoptante.

**Postcondiciones**

- La adopción queda `active` y al día, o sin cambios si el pago falla.

**Reglas de negocio:** RN-07, RN-08, RN-13.

### CU-15 — Consultar «Mis animales»

| Actor principal | Fase |
| --- | --- |
| Adoptante | 1 |

**Precondiciones**

- El usuario es adoptante y tiene sesión iniciada.

**Flujo principal**

1. El adoptante entra en «Mis animales» (`/my-animals`).
2. El sistema muestra una tarjeta por adopción con: foto y nombre del animal, plan (y el plan siguiente si hay un cambio programado), estado (activa, pendiente de pago, pausada, finalizada o cancelada), fecha de inicio y fecha de la próxima actualización prevista (última actualización + 14 días).
3. Las adopciones abiertas aparecen primero; las cerradas, en una sección «Historial».
4. Desde cada tarjeta, el adoptante puede abrir la ficha ampliada (CU-16), pagar (CU-14), cambiar de plan (CU-20), darse de baja (CU-21) o descargar el certificado (CU-22, Fase 3).

**Flujos alternativos**

- **2a.** No tiene adopciones: se muestra «Todavía no has adoptado a ningún animal» con un enlace al catálogo.
- **2b.** Una adopción tiene la baja solicitada: se muestra «Activa hasta el [end_date]», sin acciones de cambio de plan.
- **2c.** Una adopción se cerró por fallecimiento o traslado del animal: se muestra el motivo con delicadeza y la sugerencia «¿Quieres continuar con otro animal?», que lleva al catálogo.

**Postcondiciones**

- Ninguna (solo lectura).

**Reglas de negocio:** RN-07, RN-10, RN-11, RN-14.

### CU-16 — Consultar la ficha ampliada de un animal adoptado

| Actor principal | Fase |
| --- | --- |
| Adoptante | 1 |

**Precondiciones**

- El adoptante tiene una adopción `active` del animal.

**Flujo principal**

1. El adoptante abre la ficha desde «Mis animales» (`/my-animals/:animalId`).
2. El sistema muestra todo lo público (CU-03) y, además:
   - todas las actualizaciones, incluidas las exclusivas, con sus fotos y vídeos;
   - las fotos y vídeos `adopters` de la galería;
   - el resumen de salud en lenguaje sencillo (`health_summary`).
3. Las actualizaciones que el adoptante abre se marcan como leídas.

**Flujos alternativos**

- **1a.** La adopción está `pending`, `paused`, `cancelled` o `finished`: se muestra solo la ficha pública, con un aviso que explica por qué no se ve el contenido exclusivo y, si procede, el botón «Pagar ahora» (CU-14).

**Postcondiciones**

- Las actualizaciones vistas quedan registradas en `update_reads`.

**Reglas de negocio:** RN-15.

### CU-17 — Consultar el muro de actualizaciones

| Actor principal | Fase |
| --- | --- |
| Adoptante | 1 |

**Precondiciones**

- El usuario es adoptante.

**Flujo principal**

1. El adoptante entra en «Novedades» (`/feed`).
2. El sistema muestra, de más reciente a más antigua, las actualizaciones de todos los animales de los que tiene una adopción activa, con el animal, el título, el texto, las fotos y la marca «nuevo» en las no leídas.
3. El adoptante puede filtrar por «Solo no leídas» o por animal.
4. Al abrir o desplegar una actualización, se marca como leída. El adoptante puede volver a marcarla como no leída.
5. El contador de no leídas del menú se actualiza.

**Flujos alternativos**

- **2a.** No hay actualizaciones: se muestra «Aún no hay novedades de tus animales».

**Postcondiciones**

- `update_reads` refleja lo leído.

**Reglas de negocio:** RN-15.

**Notas:** en el muro solo aparecen las actualizaciones publicadas desde el inicio de la adopción (`start_date`), para no llenar el muro de un nuevo adoptante con años de historial. En la ficha ampliada (CU-16) sí se ve todo el historial.

### CU-18 — Consultar las notificaciones

| Actor principal | Fase |
| --- | --- |
| Usuario autenticado | 2 |

**Precondiciones**

- El usuario tiene sesión iniciada.

**Flujo principal**

1. El sistema muestra en la cabecera una campana con el número de notificaciones no leídas.
2. El usuario abre la campana y ve las últimas notificaciones (mensaje, fecha, estado de lectura).
3. Al pulsar una notificación, se marca como leída y el sistema navega a su enlace.
4. El usuario puede marcar todas como leídas o borrar una notificación (también desde la campana). En `/notifications` está el listado completo, paginado, y el botón «Limpiar notificaciones», que las borra todas tras confirmarlo.

**Flujos alternativos**

- **2a.** No hay notificaciones: «No tienes notificaciones».

**Postcondiciones**

- Las notificaciones afectadas quedan leídas o borradas.

**Notas:** los tipos de notificación están en el `CHECK` de `notifications.type`. Los trabajadores reciben notificaciones `update_reminder` (CU-47).

### CU-19 — Consultar mis aportaciones y descargar recibos

| Actor principal | Fase |
| --- | --- |
| Adoptante | 2 (recibo PDF en la Fase 3) |

**Precondiciones**

- El usuario es adoptante.

**Flujo principal**

1. El adoptante entra en «Mis aportaciones» (`/my-contributions`).
2. El sistema muestra dos listados, cuotas y donaciones, con: concepto (animal y plan, o «Donación»), importe, fecha, estado (completado, fallido, pendiente, devuelto) y referencia.
3. El sistema muestra el total aportado por año (solo pagos `completed`).
4. El adoptante pulsa «Recibo» en un pago o donación completado.
5. El sistema muestra el recibo: datos del santuario, del adoptante, concepto, importe, fecha, referencia y la indicación «Pago simulado». En la Fase 2 era una página HTML imprimible; desde la Fase 3 es un PDF que se puede abrir en el navegador (para verlo o imprimirlo) o descargar.

**Flujos alternativos**

- **2a.** Sin aportaciones: «Todavía no hay aportaciones».
- **4a.** Pagos fallidos o pendientes: no tienen recibo.
- **4b.** Pagos devueltos: el recibo muestra «Devuelto» con la fecha de la devolución.

**Postcondiciones**

- Ninguna (solo lectura).

**Reglas de negocio:** RN-13, RN-17.

### CU-20 — Cambiar de plan

| Actor principal | Fase |
| --- | --- |
| Adoptante | 2 |

**Precondiciones**

- La adopción es propia, está `active` y no tiene la baja solicitada.

**Flujo principal**

1. En «Mis animales», el adoptante pulsa «Cambiar plan».
2. El sistema muestra los planes activos, marcando el actual, e indica la fecha a partir de la que se aplicará el cambio (`next_billing_date`).
3. El adoptante elige otro plan y confirma.
4. El sistema guarda el plan elegido en `next_plan_id`, crea la notificación `plan_changed` y envía un email de confirmación.
5. La tarjeta muestra «Plan actual: Usual · A partir del [fecha]: Extraordinaria».

**Flujos alternativos**

- **3a.** Elige el plan que ya tiene: si había un cambio programado, se anula (`next_plan_id = NULL`). Si no, no se hace nada.
- **3b.** Ya había un cambio programado y elige un tercer plan: se sustituye el cambio programado.
- **1a.** Adopción `paused` o con baja solicitada: la opción no está disponible.

**Postcondiciones**

- `adoptions.next_plan_id` contiene el nuevo plan. El importe cambia en el siguiente cobro (CU-43).

**Reglas de negocio:** RN-04, RN-09.

### CU-21 — Darse de baja de una adopción

| Actor principal | Fase |
| --- | --- |
| Adoptante | 2 |

**Precondiciones**

- La adopción es propia y está `active` (sin baja ya solicitada), `paused` o `pending`.

**Flujo principal**

1. En «Mis animales», el adoptante pulsa «Darme de baja».
2. El sistema explica que la adopción seguirá activa hasta el [último día pagado] y que después no se cobrará más, y pide confirmación.
3. El adoptante confirma.
4. El sistema guarda `cancel_requested_at`, fija `end_date` en el último día pagado (`next_billing_date` − 1 día), vacía `next_billing_date` y `next_plan_id`.
5. El sistema crea la notificación `adoption_cancelled` y envía el email de confirmación.
6. La tarjeta muestra «Activa hasta el [end_date]».

**Flujos alternativos**

- **1a.** Adopción `pending`: se pasa directamente a `cancelled` (`user_cancelled`), porque no hay nada pagado.
- **1b.** Adopción `paused`: se pasa directamente a `finished` (`user_cancelled`) con `end_date` = último día pagado, ya que la cuota pendiente no se cobró.
- **3a.** El adoptante cancela la confirmación: no cambia nada.

**Postcondiciones**

- La adopción no volverá a cobrarse. CU-45 la pasará a `finished` cuando termine el mes pagado.

**Reglas de negocio:** RN-10.

**Notas:** volver a adoptar al mismo animal más adelante crea una adopción nueva (CU-13), una vez cerrada la anterior. La baja funciona igual con pago automático o manual (CU-49).

### CU-22 — Descargar el certificado de adopción

| Actor principal | Fase |
| --- | --- |
| Adoptante | 3 |

**Precondiciones**

- La adopción es propia y está `active`.

**Flujo principal**

1. En «Mis animales», el adoptante pulsa «Certificado» (lo abre en el navegador, en otra pestaña) o elige «Descargar certificado» en el menú «⋯» de la tarjeta.
2. El sistema genera un PDF con el nombre del adoptante, el nombre y la foto de portada del animal, la especie y la fecha de inicio de la adopción.
3. El navegador lo muestra para verlo o imprimirlo, o descarga el archivo `certificado-<animal>.pdf`.

**Flujos alternativos**

- **1a.** Adopción no activa: la opción no está disponible.
- **2a.** El animal no tiene foto de portada: el PDF se genera sin foto.

**Postcondiciones**

- Ninguna. El PDF se genera al momento y no se guarda.

### CU-23 — Gestionar el perfil y las preferencias

| Actor principal | Fase |
| --- | --- |
| Usuario autenticado | 1 (preferencias de email en la Fase 2) |

**Precondiciones**

- El usuario tiene sesión iniciada.

**Flujo principal**

1. El usuario entra en «Mi perfil» (`/profile`).
2. El sistema muestra sus datos (nombre, apellidos, email, teléfono) y, si es adoptante, sus preferencias:
   - recibir emails: sí o no (`email_notifications`);
   - frecuencia: un email por actualización o un resumen mensual (`email_frequency`);
   - aparecer como adoptante en la ficha pública de sus animales (`show_public_name`);
   - idioma de la web, de los emails y de los PDF: castellano, valenciano o inglés (`preferred_language`, Fase 3; también para los trabajadores).
3. El usuario modifica los datos y guarda.
4. El sistema valida y guarda los cambios y muestra «Cambios guardados».

**Flujos alternativos**

- **3a.** Datos no válidos (teléfono con formato incorrecto, nombre vacío): errores en los campos.
- **3b.** El email no se puede cambiar desde aquí en esta versión. Si hace falta, se pide al santuario.

**Postcondiciones**

- `users` refleja los cambios. Si se activa o desactiva `show_public_name`, su nombre aparece o desaparece al momento de las fichas públicas.

**Reglas de negocio:** RN-16, RN-19.

### CU-24 — Cambiar la contraseña

| Actor principal | Fase |
| --- | --- |
| Usuario autenticado | 1 |

**Precondiciones**

- El usuario tiene sesión iniciada.

**Flujo principal**

1. En «Mi perfil», el usuario introduce la contraseña actual y la nueva dos veces.
2. El sistema comprueba la contraseña actual, valida la nueva y guarda el nuevo hash.
3. El sistema cierra las demás sesiones del usuario (mantiene la actual) y muestra «Contraseña cambiada».

**Flujos alternativos**

- **2a.** La contraseña actual es incorrecta: «La contraseña actual no es correcta».
- **2b.** La nueva no cumple el mínimo o no coincide: error en el campo.

**Postcondiciones**

- Nueva contraseña activa; solo queda abierta la sesión actual.

### CU-25 — Eliminar la cuenta

| Actor principal | Fase |
| --- | --- |
| Adoptante | 2 |

**Precondiciones**

- El usuario es adoptante y tiene sesión iniciada.

**Flujo principal**

1. En «Mi perfil», el adoptante pulsa «Eliminar mi cuenta».
2. El sistema explica las consecuencias: se borran sus datos personales, se cierran sus adopciones sin más cobros y se conservan los registros de pagos y donaciones de forma anónima, por obligaciones contables.
3. El adoptante escribe su contraseña para confirmar.
4. El sistema, en una transacción:
   1. pasa sus adopciones abiertas a `finished` o `cancelled` con `end_reason = 'account_deleted'` (las `active`, con `end_date` = hoy);
   2. anonimiza el usuario (ver `TECH_SPEC.md` §13);
   3. vacía `donor_name` y `donor_email` de sus donaciones;
   4. borra sus notificaciones, lecturas, tokens y sesiones.
5. El sistema cierra la sesión y muestra «Tu cuenta se ha eliminado».

**Flujos alternativos**

- **3a.** Contraseña incorrecta: no se elimina nada.
- **1a.** El usuario es un trabajador: la opción no existe; la cuenta la desactiva un administrador (CU-35).

**Postcondiciones**

- No queda ningún dato personal del usuario. Los importes de sus pagos y donaciones se conservan.

**Reglas de negocio:** RN-17, RN-20.

### CU-26 — Regalar una adopción (descartado)

> **Descartado** (decisión de la responsable del proyecto, noviembre de 2026): la adopción regalo no aporta lo suficiente para el santuario y no se implementa. Se conserva la descripción como referencia. La columna `adoptions.gifted_by_user_id` sigue en el esquema (la Fase 3 no cambia el esquema), siempre a `NULL`.

| Actor principal | Fase |
| --- | --- |
| Adoptante | 3 (descartado) |

**Precondiciones**

- El adoptante que regala tiene el email verificado.
- La persona que recibe el regalo tiene, o se crea, una cuenta de adoptante.

**Flujo principal**

1. Desde la ficha de un animal adoptable, el adoptante pulsa «Regalar esta adopción».
2. Indica el email de la persona que lo recibe, el plan y un mensaje personal.
3. El sistema comprueba que la persona que recibe el regalo no tenga ya una adopción abierta de ese animal.
4. El adoptante paga la primera cuota con la pasarela simulada.
5. El sistema crea la adopción a nombre de la persona que recibe el regalo (`user_id`), con `gifted_by_user_id` = quien regala, y la activa.
6. El sistema envía un email a la persona que recibe el regalo con el mensaje y un enlace para ver su animal (o para registrarse si no tenía cuenta).

**Flujos alternativos**

- **3a.** La persona que recibe el regalo ya adopta a ese animal: «Esta persona ya adopta a [nombre]».
- **3b.** El email es de un trabajador: no se permite (RN-03).
- **4a.** Pago fallido: no se crea la adopción.

**Postcondiciones**

- Existe una adopción activa a nombre de la persona que recibe el regalo, con `gifted_by_user_id` = quien regala.

**Reglas de negocio:** RN-03, RN-05, RN-13.

**Notas:** la decisión pendiente sobre quién paga las cuotas siguientes (`TECH_SPEC.md` §18, cuestión 6) ya no hace falta: el caso se ha descartado.

### CU-49 — Elegir la forma de pago de una adopción

| Actor principal | Fase |
| --- | --- |
| Adoptante | Mejora tras la fase 3 |

**Precondiciones**

- Al adoptar (CU-13), o con una adopción propia `pending`, `paused` o `active` sin baja solicitada.

**Flujo principal**

1. Al adoptar, el adoptante elige la forma de pago: «Automático» (por defecto: el sistema cobra la cuota cada mes, CU-43) o «Manual» (el adoptante paga cada cuota).
2. Más adelante, en «Mis animales», abre el menú «⋯» de la adopción y pulsa «Forma de pago».
3. El sistema muestra las dos opciones con la actual marcada y explica que el cambio vale desde la próxima cuota.
4. El adoptante elige la otra y pulsa «Guardar».
5. El sistema guarda `payment_mode` y la tarjeta muestra «Pago automático cada mes» o «Pago manual: te avisaremos de cada cuota».

**Flujos alternativos**

- **1a.** Adopción con la baja solicitada, `cancelled` o `finished`: la opción no aparece y la API responde 422 `PAYMENT_MODE_CHANGE_NOT_ALLOWED`.
- **4a.** Elige la que ya tenía: se cierra sin cambios.

**Postcondiciones**

- Con pago automático, la tarea `billing` cobra las cuotas (CU-43). Con pago manual, `billing` no las cobra: se avisan y, si no se pagan, se pausan (CU-50), y se pagan desde «Mis animales» (CU-14, 1b).

**Reglas de negocio:** RN-08, RN-10.

**Notas:** las adopciones creadas desde el panel (CU-37) son automáticas; el adoptante puede cambiarlo después. La ficha de la adopción en el panel muestra la forma de pago («Cobro de las cuotas»).

## 7. Panel: cuidador y administrador

### CU-27 — Consultar el escritorio del panel

| Actor principal | Fase |
| --- | --- |
| Cuidador, administrador | 1 (básico), 2 (completo) |

**Precondiciones**

- El usuario es un trabajador.

**Flujo principal**

1. El trabajador entra en el panel (`/admin`).
2. El sistema muestra:
   - número de animales por estado;
   - número de adopciones activas;
   - **alertas de actualización**: animales con adoptantes activos y 12 días o más sin actualización, en amarillo (12 o 13 días) o en rojo (14 o más), con un enlace para publicar una (CU-31);
   - adopciones pendientes de pago.
3. Si es administrador, el sistema muestra también los ingresos del mes en curso, con cuotas y donaciones por separado.

**Flujos alternativos**

- **2a.** No hay alertas: «Todos los animales con adoptantes están al día».

**Postcondiciones**

- Ninguna (solo lectura).

**Reglas de negocio:** RN-14, RN-23.

**Notas:** con `TEST_DATA.sql` recién cargado, Turia aparece en rojo (16 días) y Ébano en amarillo (12 días).

### CU-28 — Gestionar animales

| Actor principal | Fase |
| --- | --- |
| Cuidador, administrador | 1 |

**Precondiciones**

- El usuario es un trabajador.

**Flujo principal (alta)**

1. El trabajador entra en «Animales» (`/admin/animals`) y pulsa «Nuevo animal».
2. Rellena nombre, especie (de la lista de especies), sexo (macho o hembra, obligatorio), fecha de nacimiento aproximada, fecha de llegada, historia de rescate, carácter, necesidades especiales y resumen de salud, y marca si es adoptable y si se publica.
3. El sistema valida y crea el animal (por defecto, `in_sanctuary`) y lleva a la gestión de fotos (CU-29).

**Flujo principal (listado y edición)**

1. El sistema muestra todos los animales, incluidos los ocultos y archivados, con búsqueda por nombre y filtros por especie, estado, publicado y adoptable.
2. El trabajador abre un animal, modifica sus datos y guarda.
3. El sistema valida y guarda los cambios.

**Flujos alternativos**

- **A1. Publicar u ocultar:** el trabajador cambia `is_published`. Un animal oculto desaparece del catálogo, pero sus adopciones activas continúan.
- **A2. Cambiar el estado entre `in_sanctuary` e `in_treatment`:** cambio directo.
- **A3. Cambiar el estado a `deceased` o `transferred`:** se sigue CU-33.
- **A4. Borrado físico (solo administrador):** permitido solo si el animal nunca ha tenido adopciones. El sistema pide confirmación y borra el animal con sus fotos (y los archivos), actualizaciones e historial. Si tiene adopciones, se muestra «Este animal tiene historial de adopciones; archívalo cambiando su estado» (RN-17).
- **2a.** Fecha de nacimiento posterior a la de llegada: error en el campo.
- **A5. Corregir el estado de un animal fallecido o trasladado (solo administrador):** si se archivó por error, el administrador elige otro estado en «Cambiar estado». A otro estado archivado se sigue CU-33. Para devolverlo a `in_sanctuary` o `in_treatment` se pide confirmación: sus adopciones cerradas no se reabren, no admite adopciones hasta que se active en «Datos», se borra la fecha del suceso y sale de «En memoria». Un cuidador no ve la opción y el servidor responde con 403 `ARCHIVED_STATUS_ADMIN_ONLY`.
- **2b.** Los datos de un animal fallecido o trasladado no se modifican (RN-22): la pestaña «Datos» los muestra sin formulario y el servidor responde con 422 `ANIMAL_ARCHIVED_READ_ONLY`.

**Postcondiciones**

- El animal queda creado, actualizado o borrado.

**Reglas de negocio:** RN-06, RN-17, RN-22.

### CU-29 — Gestionar fotos y vídeos de un animal

| Actor principal | Fase |
| --- | --- |
| Cuidador, administrador | 1 |

**Precondiciones**

- El animal existe.

**Flujo principal**

1. En la ficha del animal en el panel, el trabajador abre la pestaña «Fotos».
2. Sube una o varias fotos (JPEG, PNG o WebP de hasta 5 MB) o vídeos (MP4 de hasta 50 MB), como máximo 10 por subida.
3. Para cada archivo indica el texto alternativo (obligatorio) y la visibilidad (pública o solo adoptantes).
4. El sistema guarda los archivos (las imágenes, redimensionadas y con miniatura) y crea los registros en `photos`.
5. El trabajador ordena las fotos arrastrándolas y elige la portada.
6. El sistema guarda el orden y la portada.

**Flujos alternativos**

- **2a.** Formato o tamaño no permitido: se rechaza ese archivo con un mensaje claro y se suben los demás.
- **3a.** Falta el texto alternativo: no se puede guardar.
- **5a.** Se elige como portada un vídeo o una foto «solo adoptantes»: no se permite.
- **A1. Editar:** se cambia el texto alternativo o la visibilidad. Si la foto es la portada, no puede pasar a «solo adoptantes».
- **A2. Borrar:** se pide confirmación y se borran el registro y los archivos. Si era la portada, el animal queda sin portada y se avisa.
- **1a.** El animal ha fallecido o fue trasladado (RN-22): la galería se ve sin «Subir fotos y vídeos» ni acciones en cada foto, y el servidor responde con 422 `ANIMAL_ARCHIVED_READ_ONLY`.

**Postcondiciones**

- Las fotos del animal, su orden y su portada quedan actualizados.

### CU-30 — Gestionar especies

| Actor principal | Fase |
| --- | --- |
| Cuidador, administrador | 1 |

**Precondiciones**

- El usuario es un trabajador.

**Flujo principal**

1. El trabajador entra en «Especies» (`/admin/species`).
2. El sistema muestra las especies con su nombre científico y el número de animales.
3. El trabajador crea una especie (nombre, nombre científico, descripción) o edita una existente.
4. El sistema valida y guarda.

**Flujos alternativos**

- **4a.** Ya existe una especie con ese nombre (sin distinguir mayúsculas): «Esta especie ya existe».
- **A1. Borrar (solo administrador):** solo si ningún animal la usa. Si no, se muestra «Hay [n] animales de esta especie».

**Postcondiciones**

- El catálogo de especies queda actualizado y disponible en los filtros y formularios.

**Notas:** por ahora las especies son de buitre (leonado, negro, alimoche, quebrantahuesos). Para añadir otro animal, como el lince ibérico, basta con crear la especie.

### CU-31 — Publicar una actualización

| Actor principal | Fase |
| --- | --- |
| Cuidador, administrador | 1 (notificaciones en la Fase 2) |

**Precondiciones**

- El animal existe y no está fallecido ni trasladado. Un último aviso de fallecimiento se publica dentro de CU-33.

**Flujo principal**

1. El trabajador pulsa «Nueva actualización», desde el escritorio, la ficha del animal en el panel o «Actualizaciones» (`/admin/updates`).
2. Elige el animal (si no venía elegido), escribe el título y el texto, adjunta fotos o vídeos (con texto alternativo) y elige la visibilidad: pública o solo adoptantes (por defecto).
3. El sistema valida y, en una transacción, crea la actualización (autor = el trabajador, `published_at` = ahora) y sus fotos vinculadas (`update_id`).
4. **(Fase 2)** El sistema notifica a cada adoptante con adopción activa del animal:
   1. crea una notificación `new_update` en la web;
   2. le envía un email si tiene `email_notifications = TRUE` y `email_frequency = 'per_update'`.
5. El sistema muestra «Actualización publicada y [n] adoptantes avisados». La alerta de 14 días del animal se reinicia.

**Flujos alternativos**

- **3a.** Título o texto vacíos: error en el campo.
- **4a.** El animal no tiene adoptantes activos: se publica sin notificar.
- **4b.** Falla el envío de algún email: la actualización y las notificaciones de la web se mantienen, y el fallo queda en el log.

**Postcondiciones**

- La actualización es visible en la ficha pública (si es pública), en la ficha ampliada y en el muro de los adoptantes.

**Reglas de negocio:** RN-14, RN-15, RN-19.

### CU-32 — Editar o borrar una actualización

| Actor principal | Fase |
| --- | --- |
| Autor de la actualización, administrador | 1 |

**Precondiciones**

- La actualización existe. Un cuidador solo puede modificar las suyas; el administrador, cualquiera.

**Flujo principal (edición)**

1. El trabajador abre la actualización desde «Actualizaciones».
2. Modifica el título, el texto, la visibilidad o las fotos, y guarda.
3. El sistema guarda los cambios **sin volver a notificar** a los adoptantes.

**Flujo principal (borrado)**

1. El trabajador pulsa «Borrar» y confirma.
2. El sistema borra la actualización, sus fotos (y los archivos) y sus marcas de lectura.

**Flujos alternativos**

- **1a.** Un cuidador intenta modificar una actualización de otro trabajador: no se muestran las acciones, y el servidor responde con 403.
- **2a.** Al borrar la última actualización de un animal con adoptantes, el escritorio puede pasar a mostrar una alerta de 14 días.
- **1b.** El animal ha fallecido o fue trasladado (RN-22): nadie, ni el administrador, puede editarla o borrarla (`canEdit: false`; 422 `ANIMAL_ARCHIVED_READ_ONLY`).

**Postcondiciones**

- La actualización queda modificada o eliminada.

### CU-33 — Registrar el fallecimiento o traslado de un animal

| Actor principal | Fase |
| --- | --- |
| Cuidador, administrador | 2 (el cierre de adopciones ya funciona en la Fase 1) |

**Precondiciones**

- El animal está en estado `in_sanctuary` o `in_treatment`, o en el otro estado archivado si lo corrige el administrador (CU-28 A5).

**Flujo principal**

1. En la ficha del animal en el panel, el trabajador pulsa «Cambiar estado» y elige «Fallecido» o «Trasladado».
2. El sistema indica cuántas adopciones abiertas se cerrarán y pide la fecha del suceso.
3. Si es un **fallecimiento**, el sistema pide **redactar a mano** el mensaje para los adoptantes (no hay plantilla) y si se mostrará en «En memoria» (Fase 3).
4. El trabajador confirma.
5. El sistema, en una transacción:
   1. cambia el estado, guarda `status_changed_at` y pone `is_adoptable = FALSE`;
   2. pasa las adopciones `active` y `paused` del animal a `finished` (`animal_deceased` o `animal_transferred`), con `end_date` = la fecha del suceso, y las `pending` a `cancelled` con el mismo motivo;
   3. si es un fallecimiento, publica el mensaje redactado como actualización «solo adoptantes».
6. El sistema envía a cada adoptante afectado una notificación `adoption_closed` y un email con el mensaje redactado (fallecimiento) o un aviso de traslado, y les ofrece continuar con otro animal (enlace al catálogo).
7. El animal desaparece del catálogo.

**Flujos alternativos**

- **2a.** El animal no tiene adopciones abiertas: se cambia el estado sin mensaje ni avisos.
- **3a.** Mensaje de fallecimiento vacío con adoptantes afectados: no se permite continuar.
- **4a.** El trabajador cancela: no cambia nada.
- **A1. Corrección:** si el animal ya estaba archivado (solo el administrador), las adopciones ya están cerradas y no hay avisos. Al pasar de fallecido a trasladado sale de «En memoria».

**Postcondiciones**

- El animal queda archivado. Sus adopciones quedan cerradas y no se vuelven a cobrar.

**Reglas de negocio:** RN-11, RN-17, RN-22.

**Notas:** en la Fase 1, el cambio de estado desde CU-28 ya cierra las adopciones (paso 5.1 y 5.2), sin mensajes ni avisos.

### CU-34 — Gestionar el historial veterinario

| Actor principal | Fase |
| --- | --- |
| Cuidador, administrador | 3 |

**Precondiciones**

- El animal existe.

**Flujo principal**

1. En la ficha del animal en el panel, el trabajador abre la pestaña «Veterinario».
2. El sistema muestra los registros del animal, del más reciente al más antiguo, y un gráfico sencillo de la evolución del peso.
3. El trabajador añade un registro: fecha, tipo (revisión, vacuna, tratamiento o cirugía), descripción, peso en kg (opcional) y veterinario.
4. El sistema valida y guarda.
5. Si procede, el trabajador actualiza el resumen de salud del animal (CU-28) para los adoptantes.

**Flujos alternativos**

- **4a.** Peso menor o igual a 0, o fecha futura: error en el campo.
- **A1. Editar:** cuidador o administrador.
- **A2. Borrar:** solo el administrador, con confirmación.
- **1a.** El animal ha fallecido o fue trasladado (RN-22): el historial se ve sin «Nuevo registro» ni acciones, y el servidor responde con 422 `ANIMAL_ARCHIVED_READ_ONLY`.

**Postcondiciones**

- El historial queda actualizado. Es interno: los adoptantes nunca lo ven, solo el resumen de salud.

## 8. Panel: solo administrador

### CU-35 — Gestionar usuarios

| Actor principal | Fase |
| --- | --- |
| Administrador | 2 |

**Precondiciones**

- El usuario es administrador.

**Flujo principal**

1. El administrador entra en «Usuarios» (`/admin/users`).
2. El sistema muestra los usuarios con búsqueda por nombre o email y filtros por rol y estado (activo, inactivo, anonimizado).
3. El administrador abre una ficha: datos, adopciones, pagos y donaciones (adoptantes) o actividad (trabajadores, Fase 3).
4. El administrador **desactiva** o **reactiva** la cuenta.
5. El sistema guarda `is_active` y, al desactivarla, cierra todas las sesiones del usuario.

**Flujos alternativos**

- **4a.** Desactivar a un adoptante con adopciones abiertas: se dan de baja siempre, como en CU-21, y no se le vuelve a cobrar. La activa sigue activa hasta el último día pagado; la pendiente se cancela y la pausada termina el último día pagado (estas dos, con `end_reason = 'admin_cancelled'`). La ventana de confirmación lo avisa. Reactivar la cuenta no reabre las adopciones.
- **4b.** El administrador intenta desactivar su propia cuenta: no se permite.
- **4c.** Usuario anonimizado: no se puede reactivar.
- **A1. Cambiar el rol:** solo entre `caretaker` y `admin`. No se puede convertir a un adoptante en trabajador ni al revés (RN-01, RN-03). No se permite que el último administrador activo deje de serlo.

**Postcondiciones**

- La cuenta queda activa o inactiva, o con el nuevo rol de trabajador.

**Reglas de negocio:** RN-01, RN-02, RN-03, RN-17.

### CU-36 — Crear una cuenta de trabajador

| Actor principal | Fase |
| --- | --- |
| Administrador | 2 |

**Precondiciones**

- El usuario es administrador.

**Flujo principal**

1. En «Usuarios», el administrador pulsa «Nuevo trabajador».
2. Introduce nombre, apellidos, email, teléfono y rol (cuidador o administrador).
3. El sistema crea la cuenta con `email_verified = TRUE`, sin contraseña utilizable, y un token `worker_invitation` de 24 horas (un tipo propio: pedir «¿Has olvidado tu contraseña?» no lo anula).
4. El sistema envía al trabajador un email de invitación con un enlace para elegir su contraseña (CU-10, desde el paso 4).
5. El sistema muestra «Cuenta creada. Hemos enviado una invitación a [email]».

**Flujos alternativos**

- **3a.** El email ya está registrado: «Ya existe una cuenta con este email». Si es de un adoptante, no se convierte (RN-03).
- **4a.** La invitación caduca sin usarse: el administrador puede reenviarla desde la ficha del usuario (solo a un trabajador activo que nunca ha entrado). La nueva anula la anterior.

**Postcondiciones**

- Existe la cuenta de trabajador, pendiente de que su titular elija la contraseña.

**Reglas de negocio:** RN-02, RN-03.

**Notas:** las cuentas de `TEST_DATA.sql` ya tienen contraseña, siguiendo el convenio `NombreApellido26#!`. En la aplicación real, la contraseña la elige el trabajador.

### CU-51 — Enviar a un trabajador el enlace para cambiar su contraseña

| Actor principal | Fase |
| --- | --- |
| Administrador | Mejora tras la fase 3 |

**Precondiciones**

- El usuario es administrador.
- La cuenta es de un trabajador (cuidador u otro administrador), está activa y no es la suya.

**Flujo principal**

1. En la ficha del trabajador (`/admin/users/:id`), el administrador pulsa «Enviar enlace de contraseña».
2. El sistema explica qué pasará: el trabajador recibirá un email con un enlace de 30 minutos, nadie más verá la contraseña y, hasta que la cambie, la actual sigue funcionando.
3. El administrador confirma.
4. El sistema anula los enlaces de recuperación anteriores, crea uno nuevo (`password_reset`), envía el email en el idioma del trabajador, lo anota en el registro de actividad (sin el enlace) y muestra «Hemos enviado a [email] un enlace para cambiar su contraseña».
5. El trabajador abre el enlace y elige su contraseña como en CU-10 (desde el paso 4): se cierran todas sus sesiones.

**Flujos alternativos**

- **1a.** Adoptante, cuenta desactivada o anonimizada, o la propia cuenta: la opción no aparece y la API responde 422 `PASSWORD_RESET_NOT_ALLOWED`. La propia contraseña se cambia en «Mi perfil» (CU-24); los adoptantes usan «¿Has olvidado tu contraseña?» (CU-10).
- **3a.** El administrador cancela: no se envía nada.
- **5a.** El enlace caduca o ya se usó: el administrador puede enviar otro.

**Postcondiciones**

- El trabajador tiene un enlace válido durante 30 minutos. El administrador nunca conoce la contraseña.

**Reglas de negocio:** RN-02.

### CU-37 — Gestionar adopciones

| Actor principal | Fase |
| --- | --- |
| Administrador | 2 |

**Precondiciones**

- El usuario es administrador.

**Flujo principal (consulta)**

1. El administrador entra en «Adopciones» (`/admin/adoptions`).
2. El sistema muestra las adopciones con filtros por estado, animal, adoptante y plan, y la búsqueda por adoptante.
3. Al abrir una, se ven sus datos, el historial de pagos y las notas internas.

**Flujo principal (alta manual)**

1. El administrador pulsa «Nueva adopción», por ejemplo para un pago en efectivo en una jornada de puertas abiertas.
2. Elige el adoptante (debe tener cuenta), el animal y el plan, e indica el método del primer pago (efectivo o transferencia) y notas.
3. El sistema crea la adopción `active` (`created_by` = el administrador) y su primer pago `completed` con ese método (`recorded_by` = el administrador).
4. Se notifica al adoptante como en CU-13.

**Flujos alternativos**

- **A1. Pausar** una adopción `active` (sin baja solicitada): pasa a `paused` (deja de cobrarse) con una nota obligatoria.
- **A2. Reanudar** una adopción `paused`: pasa a `active`. Si `next_billing_date` ya ha pasado, se cobrará en el siguiente ciclo de CU-43.
- **A3. Cancelar** una adopción abierta: pasa a `cancelled` (`admin_cancelled`) con `end_date` = hoy y una nota obligatoria. La ventana ofrece devolver también la última cuota cobrada (CU-38 A1), en la misma operación.
- **Notas internas:** cada alta, pausa, reanudación o cancelación con nota añade una línea «fecha · acción · autor: texto» al final de `adoptions.notes`, sin borrar las anteriores. El adoptante recibe un aviso (campana y email) de cada cambio, pero nunca ve la nota.
- **2a.** El adoptante ya tiene una adopción abierta de ese animal, el animal no es adoptable o el usuario no es adoptante: no se permite (RN-03, RN-05, RN-06).

**Postcondiciones**

- La adopción queda creada o con el nuevo estado; el adoptante recibe la notificación correspondiente.

**Reglas de negocio:** RN-03, RN-05, RN-06, RN-07, RN-17.

### CU-38 — Gestionar pagos

| Actor principal | Fase |
| --- | --- |
| Administrador | 2 |

**Precondiciones**

- El usuario es administrador.

**Flujo principal**

1. El administrador entra en «Pagos» (`/admin/payments`).
2. El sistema muestra las cuotas con filtros por estado, método, rango de fechas, animal y adoptante, y la suma de lo cobrado en el filtro actual.
3. El administrador pulsa «Exportar CSV» y el sistema descarga los pagos filtrados (separador `;`, UTF-8, decimales con coma).

**Flujos alternativos**

- **A1. Devolver** un pago `completed`: el administrador confirma; el sistema llama a `refund` de la pasarela simulada, marca el pago como `refunded` con `refunded_at` y avisa al adoptante. La adopción no cambia; si debe cerrarse, se usa CU-37.
- **A2. Registrar un pago manual** de una adopción (cobrado fuera de la web): el administrador indica la adopción, el periodo, el importe y el método. Si la adopción estaba `paused` por ese periodo, pasa a `active` y avanza `next_billing_date`.
- **A2a.** Ya hay un pago válido de ese periodo: «Este periodo ya está pagado».
- **Concreción de A2:** se registra desde la ficha de la adopción y solo la cuota pendiente: la que empieza en `next_billing_date` (activa o pausada, sin baja solicitada) o, en una pendiente de pago dentro de sus 7 días, el primer mes desde hoy. El importe propuesto es el del plan (el programado, si lo hay, que se aplica en esa cuota) y se puede cambiar. Después la adopción queda activa y `next_billing_date` avanza un mes; se avisa al adoptante con el recibo.
- **Concreción de A1:** un pago en efectivo o por transferencia también se devuelve; el dinero se entrega a mano y en la web solo se marca como `refunded`.
- **A1a.** Intentar devolver un pago que no está `completed`: no se permite.

**Postcondiciones**

- Los pagos nunca se borran; solo cambian de estado.

**Reglas de negocio:** RN-13, RN-17.

### CU-39 — Gestionar donaciones

| Actor principal | Fase |
| --- | --- |
| Administrador | 2 |

**Precondiciones**

- El usuario es administrador.

**Flujo principal**

1. El administrador entra en «Donaciones» (`/admin/donations`).
2. El sistema muestra las donaciones con importe, fecha, donante («Anónimo» si lo es), mensaje, método y estado, con filtros por estado, método y fechas.
3. El sistema muestra el total recaudado por mes (solo `completed`).
4. El administrador puede exportar el listado filtrado en CSV.

**Flujos alternativos**

- **A1. Registrar una donación manual** recibida fuera de la web (efectivo o transferencia): importe, fecha, donante (opcional), anónima sí o no y mensaje. El sistema la guarda como `completed` con `recorded_by` = el administrador.
- **A2. Devolver** una donación `completed`, con confirmación: pasa a `refunded`.
- **Concreciones:**
  - Paso 2: el administrador ve «Anónimo» y, debajo, el nombre y el email si se dieron. También hay un buscador por nombre o email del donante.
  - Paso 3: la pestaña «Por meses» usa los filtros «desde» y «hasta» (sin ellos, los últimos 12 meses) y muestra también los meses sin donaciones, a 0 €.
  - A1: la fecha es hoy por defecto y se puede elegir un día anterior, nunca uno futuro. Con email, el donante recibe el agradecimiento con el recibo, como en CU-05.
  - A2: como en CU-38, una donación en efectivo o por transferencia solo se marca como devuelta. Se avisa al donante por email si lo dio y en la campana si tiene cuenta; si no hay ninguna de las dos cosas, la ventana de confirmación lo dice. El formulario público de donar (CU-05) avisa de esto a quien dona sin cuenta de adoptante.

**Postcondiciones**

- Las donaciones nunca se borran.

**Reglas de negocio:** RN-12, RN-17.

### CU-40 — Gestionar planes de adopción

| Actor principal | Fase |
| --- | --- |
| Administrador | 2 |

**Precondiciones**

- El usuario es administrador.

**Flujo principal**

1. El administrador entra en «Planes» (`/admin/plans`).
2. El sistema muestra los planes con su importe mensual, descripción, si es el plan por defecto, si está activo y el número de adopciones activas.
3. El administrador edita el nombre, el importe o la descripción, o cambia el plan por defecto, y guarda.
4. El sistema guarda los cambios.

**Flujos alternativos**

- **3a.** Cambio de importe con adopciones activas: el sistema avisa de que el nuevo importe se cobrará a todas las adopciones de ese plan desde su siguiente cuota y pide confirmación.
- **3b.** Importe menor o igual a 0: error en el campo.
- **A1. Desactivar** un plan: deja de ofrecerse en nuevas adopciones; las existentes siguen con él. No se puede desactivar el plan por defecto sin elegir antes otro.
- **A2. Crear** un plan nuevo: siempre mensual. No se pueden crear otras periodicidades.
- **A3. Borrar:** no existe en la interfaz; los planes con adopciones no se pueden borrar (RN-17).

**Postcondiciones**

- Los planes quedan actualizados en la web pública y en el flujo de adopción.

**Reglas de negocio:** RN-04, RN-17.

### CU-41 — Consultar estadísticas

| Actor principal | Fase |
| --- | --- |
| Administrador | 3 |

**Precondiciones**

- El usuario es administrador.

**Flujo principal**

1. El administrador entra en «Estadísticas» (`/admin/stats`).
2. Elige un rango de fechas (por defecto, los últimos 12 meses).
3. El sistema muestra:
   - ingresos por mes, con cuotas y donaciones por separado (gráfico de barras);
   - animales más adoptados (los 5 con más adopciones activas);
   - animales sin adoptantes (en el santuario o en tratamiento, sin adopciones activas);
   - adopciones nuevas y bajas por mes;
   - reparto de adopciones activas por plan.

   Los ingresos y las adopciones por mes dependen del rango; las otras tres listas son la situación actual.

**Flujos alternativos**

- **3a.** No hay datos en el rango: se indica en cada gráfico.
- **2a.** El rango es al revés o supera los 60 meses: error en el campo de la fecha.

**Postcondiciones**

- Ninguna (solo lectura).

### CU-42 — Consultar el registro de actividad

| Actor principal | Fase |
| --- | --- |
| Administrador | 3 |

**Precondiciones**

- El usuario es administrador.

**Flujo principal**

1. El administrador entra en «Actividad» (`/admin/activity`).
2. El sistema muestra quién hizo qué, sobre qué registro y cuándo, de más reciente a más antiguo, con filtros por usuario, tabla, acción y fechas.
3. Al abrir una entrada se ven los detalles del cambio.

**Postcondiciones**

- Ninguna. El registro nunca se modifica ni se borra.

**Notas:** las acciones de las tareas automáticas aparecen como «Sistema» (`user_id` vacío).

### CU-48 — Cerrar todas las sesiones de un usuario

| Actor principal | Fase |
| --- | --- |
| Administrador | Mejora de seguridad tras la Fase 3 (`docs/AUTH_SPEC.md`) |

No es una opción de uso habitual: sirve para casos concretos de seguridad, como que una persona avise de que le han robado el móvil o de que dejó la sesión abierta en un ordenador ajeno. Por eso no la tienen los adoptantes ni los cuidadores, exige un motivo y queda registrada.

**Precondiciones**

- El usuario es administrador.
- La cuenta afectada está activa (una cuenta inactiva o anonimizada ya no tiene sesiones).

**Flujo principal**

1. En la ficha del usuario (`/admin/users/:id`), el administrador pulsa «Cerrar sus sesiones».
2. El sistema abre una ventana que explica el efecto y pide el **motivo** (obligatorio, hasta 500 caracteres).
3. El administrador confirma. El sistema borra todas las sesiones de ese usuario en `user_sessions` y muestra «Se han cerrado N sesiones». En su siguiente petición, cada dispositivo de esa persona responde como sin sesión y el cliente le lleva a «Iniciar sesión».
4. El sistema anota la acción en el registro de actividad (CU-42) con el número de sesiones cerradas y el motivo.

**Flujos alternativos**

- **1a.** El usuario no existe: 404.
- **1b.** El usuario no tiene ninguna sesión abierta: se responde con 0 y se muestra «No tenía ninguna sesión abierta».
- **2a.** Sin motivo, o con más de 500 caracteres: no se cierra nada y se muestra el error junto al campo.
- **3a.** El administrador lo hace sobre su propia cuenta: se cierran sus demás sesiones y se mantiene la actual (como en CU-24).

**Postcondiciones**

- El usuario tiene que volver a iniciar sesión en todos sus dispositivos. La cuenta, su contraseña, su rol y sus adopciones no cambian.

**Notas:** si se sospecha que alguien conoce la contraseña, cerrar las sesiones no basta: la persona debe cambiarla (CU-24) o recuperarla (CU-10), que también cierran las sesiones.

## 9. Procesos automáticos del sistema

Todas las tareas se ejecutan con `node-cron` en zona horaria `Europe/Madrid`, son idempotentes y un administrador puede lanzarlas a mano (`POST /api/admin/jobs/:jobName/run`) para pruebas y demostraciones. Horarios: ver `TECH_SPEC.md` §11.4.

### CU-43 — Cobrar las cuotas mensuales

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `billing`) | 2 |

**Precondiciones**

- Hay adopciones `active`, sin baja solicitada y con `next_billing_date` igual o anterior a hoy.

**Flujo principal**

Para cada adopción, en su propia transacción:

1. Si tiene `next_plan_id`, lo copia a `plan_id` y lo vacía.
2. Cobra el importe del plan con la pasarela simulada, para el periodo que empieza en `next_billing_date`.
3. Si el cobro es correcto: crea el pago `completed`, avanza `next_billing_date` un mes, crea la notificación `payment_completed` y envía el recibo por email.
4. Al terminar, registra en el log cuántas cuotas se cobraron y cuántas fallaron.

**Flujos alternativos**

- **3a.** Cobro fallido: crea el pago `failed` con el motivo, pasa la adopción a `paused`, crea la notificación `payment_failed` y envía un email con un enlace para regularizar (CU-14).
- **2a.** Ya existe un pago válido de ese periodo (la tarea se ejecutó dos veces): no cobra de nuevo y solo avanza `next_billing_date` si no se había avanzado.
- **Error inesperado** con una adopción: se deshace su transacción, se registra el error y se continúa con las demás.

**Postcondiciones**

- Ninguna adopción activa queda con `next_billing_date` anterior a hoy, salvo las que hayan dado un error inesperado.

**Reglas de negocio:** RN-08, RN-09, RN-13, RN-19.

**Notas:** con `TEST_DATA.sql` recién cargado no hay cuotas vencidas, salvo la adopción pausada 7, que no se cobra. Para probar, se puede adelantar `next_billing_date` de una adopción, o lanzar la tarea con una fecha «hoy» inyectada en las pruebas.

### CU-44 — Cancelar adopciones pendientes caducadas

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `expire-pending`) | 2 |

**Precondiciones**

- Hay adopciones `pending` creadas hace más de 7 días.

**Flujo principal**

1. Para cada una, pasa el estado a `cancelled` con `end_reason = 'payment_not_completed'` y `end_date` = hoy.
2. Crea una notificación informativa para el adoptante.
3. Borra los tokens de `user_tokens` caducados.

**Postcondiciones**

- No quedan adopciones `pending` de más de 7 días.

**Reglas de negocio:** RN-07.

**Notas:** con `TEST_DATA.sql`, la adopción 12 (Héctor y Canelo, creada hace 9 días) se cancela; la 11 (Irene y Brisa, hace 2 días) no.

### CU-45 — Finalizar adopciones dadas de baja

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `finish-cancelled`) | 2 |

**Precondiciones**

- Hay adopciones `active` con `cancel_requested_at` y `end_date` anterior a hoy.

**Flujo principal**

1. Para cada una, pasa el estado a `finished` con `end_reason = 'user_cancelled'`.
2. Crea una notificación de despedida para el adoptante, con una invitación a volver cuando quiera.

**Postcondiciones**

- Las bajas solicitadas terminan al acabar el mes pagado.

**Reglas de negocio:** RN-10.

**Notas:** con `TEST_DATA.sql`, la adopción 9 (Sergio y Nieve) finalizará automáticamente cuando pase su `end_date`.

### CU-46 — Enviar el resumen mensual

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `monthly-digest`) | 2 |

**Precondiciones**

- Hay adoptantes con `email_notifications = TRUE` y `email_frequency = 'monthly_digest'`.

**Flujo principal**

1. El día 1 de cada mes, para cada uno de esos adoptantes, el sistema reúne las actualizaciones del mes anterior de sus animales con adopción activa.
2. Si hay alguna, envía un email con el título, un extracto y un enlace de cada actualización, agrupadas por animal.

**Flujos alternativos**

- **2a.** No hay novedades: no se envía nada.

**Postcondiciones**

- Cada adoptante con resumen mensual recibe como máximo un email de resumen al mes.

**Reglas de negocio:** RN-19.

### CU-47 — Avisar de animales sin actualización

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `update-reminder`) | 2 |

**Precondiciones**

- Hay animales con adopciones `active`.

**Flujo principal**

1. Cada día, el sistema calcula los días transcurridos desde la última actualización de cada animal con adoptantes activos.
2. Para cada animal con 12 días o más, crea una notificación `update_reminder` para cada cuidador y administrador activo, como máximo una por animal y día.

**Postcondiciones**

- Los trabajadores reciben el aviso en la campana, además de la alerta del escritorio (CU-27).

**Reglas de negocio:** RN-14.

### CU-50 — Avisar y pausar las cuotas con pago manual

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `manual-payments`) | Mejora tras la fase 3 |

**Precondiciones**

- Hay adopciones `active`, con pago manual (CU-49) y sin baja solicitada.

**Flujo principal**

Cada día, para cada una de ellas y en su propia transacción:

1. Si la cuota (`next_billing_date`) vence en 7 días o menos y todavía no se ha avisado de ella (`payment_reminder_sent_for`), crea una notificación `system` con enlace a «Mis animales», envía un email con el importe, la fecha y el último día para pagarla, y anota la cuota avisada.
2. Si han pasado 7 días desde la cuota sin pagarla (el último día para pagar es `next_billing_date` + 6), pasa la adopción a `paused`, lo anota en el registro de actividad como «Sistema», crea la notificación `payment_failed` y envía un email con el enlace para pagar (CU-14).

**Flujos alternativos**

- **1a.** El adoptante paga antes (CU-14, 1b): `next_billing_date` avanza un mes y el siguiente aviso será el de la cuota nueva.
- **Error inesperado** con una adopción: se deshace su transacción, se registra el error y se continúa con las demás.

**Postcondiciones**

- Cada cuota manual se avisa una sola vez; la tarea es idempotente.

**Reglas de negocio:** RN-08, RN-13, RN-19.


## 10. Trabajo diario del personal

Zonas, cualificaciones, plantillas de tareas y «Mi día» (Bloque A, CU-52 a CU-59), turnos y ausencias (Bloque B, CU-60 a CU-64) y dietas, visitas veterinarias y medicación (Bloque C, CU-65 a CU-69). e incidencias, notas de relevo, panel «Hoy» y avisos por email (Bloque D, CU-70 a CU-74).

### CU-52 — Gestionar zonas

| Actor principal | Fase |
| --- | --- |
| Administrador | Trabajo diario, Bloque A |

**Flujo principal**

1. El administrador abre «Zonas y cualificaciones».
2. Ve las zonas por nombre, con cuántos animales viven en cada una (sin fallecidos ni trasladados) y si están desactivadas.
3. Crea o edita una zona: nombre (único, sin distinguir mayúsculas), descripción opcional y si está activa.
4. En la ficha de un animal (CU-28) elige su zona entre las activas; el campo es opcional.

**Flujos alternativos**

- **3a.** Nombre repetido: error en el campo (`ZONE_NAME_TAKEN`).
- **A1.** Borrar una zona con animales, tareas o plantillas: no se borra (`ZONE_IN_USE`); se puede desactivar. Una zona vacía sí se borra.
- **4a.** Zona inexistente o desactivada en el formulario del animal: error en el campo `zoneId`.

**Postcondiciones:** queda en el registro de actividad. El cuidador puede consultar la lista de zonas (la usa en los formularios), pero no cambiarla.

**Reglas de negocio:** RN-18, RN-27.

### CU-53 — Gestionar cualificaciones

| Actor principal | Fase |
| --- | --- |
| Administrador | Trabajo diario, Bloque A |

**Flujo principal**

1. En «Zonas y cualificaciones», el administrador ve las cualificaciones (por ejemplo, «Administrar medicación», «Manejo de grandes rapaces», «Mantenimiento de instalaciones») con cuántos trabajadores la tienen.
2. Crea, edita o borra las que nadie usa.
3. En la ficha de un trabajador (CU-35), marca sus cualificaciones y las guarda.

**Flujos alternativos**

- **2a.** Nombre repetido (`QUALIFICATION_NAME_TAKEN`) o cualificación en uso por trabajadores o tareas (`QUALIFICATION_IN_USE`).
- **3a.** Un adoptante no tiene cualificaciones (404). Una cualificación inexistente da error en `qualificationIds`.

**Postcondiciones:** el cambio queda en el registro de actividad del usuario. No hay un rol de mantenimiento: es una cualificación.

**Reglas de negocio:** RN-25.

### CU-54 — Gestionar plantillas de tareas

| Actor principal | Fase |
| --- | --- |
| Administrador | Trabajo diario, Bloque A |

**Flujo principal**

1. El administrador abre «Plantillas de tareas» y ve cada una con su tipo, su zona y cuándo se repite («Cada día · 09:00, 17:00», «Lun, Mié, Vie · 09:00», «Cada 3 días · 13:00»).
2. Crea una plantilla: tipo (alimentación, limpieza, medicación, enriquecimiento, revisión de salud, mantenimiento), título, descripción, zona y/o animales, cualificación necesaria, horas (1 a 12), repetición (cada día, algunos días de la semana o cada N días, de 2 a 365, contando desde la fecha de inicio), fechas de inicio y fin y si está activa.
3. El sistema valida los datos y, si está activa, genera sus tareas de hoy (desde la hora actual) a 7 días vista (CU-58).
4. Sin zona, la tarea toma la zona común de sus animales.
5. Al editarla, se borran sus tareas pendientes desde ahora y se vuelven a generar; las reasignaciones manuales de esas tareas se pierden (se avisa en el formulario). Al desactivarla, se borran sus tareas pendientes futuras.
6. Una plantilla sin tareas resueltas se puede borrar (con sus pendientes).

**Flujos alternativos**

- **2a.** Ni zona ni animales; días de la semana o intervalo que faltan; fecha de fin anterior a la de inicio; hora con otro formato: error en el campo.
- **4a.** Animales de zonas distintas sin zona elegida, animal inexistente o que ya no está en el santuario: error en `animalIds`.
- **6a.** Con tareas resueltas: no se borra (`TEMPLATE_HAS_HISTORY`); se puede desactivar.

**Reglas de negocio:** RN-24, RN-27.

### CU-55 — Tareas del día y tareas puntuales

| Actor principal | Fase |
| --- | --- |
| Administrador | Trabajo diario, Bloque A |

**Flujo principal**

1. El administrador abre «Tareas del día»: las de un día (hoy por defecto), con filtros por zona y estado, y para cada una su hora, zona, insignias (tipo, atrasada, puntual, estado), a quién está asignada y, si está resuelta, quién y cuándo y las observaciones.
2. Crea una tarea puntual (sin plantilla): tipo, título, descripción, zona, animales, cualificación, día (hoy o después), hora y, opcionalmente, una persona.
3. Reasigna una tarea pendiente a un trabajador en activo, o le quita la asignación (vuelve a ser de la zona).
4. Borra una tarea pendiente.

**Flujos alternativos**

- **2a.** Sin zona, animales ni persona, o en un día pasado: error en el campo.
- **3a.** Persona que no es un trabajador activo o que no tiene la cualificación que exige la tarea: error en el campo.
- **3b, 4a.** La tarea ya está resuelta (`TASK_NOT_PENDING`).

**Postcondiciones:** crear, reasignar y borrar quedan en el registro de actividad; completar tareas no (ya guarda quién y cuándo).

**Reglas de negocio:** RN-25, RN-27.

### CU-56 — Consultar «Mi día»

| Actor principal | Fase |
| --- | --- |
| Cuidador o administrador | Trabajo diario, Bloque A |

**Flujo principal**

1. El cuidador entra en la aplicación y llega a «Mi día» (el administrador, al escritorio; también la tiene en el menú).
2. Si tiene turno ese día, lo ve arriba («Tu turno»: horario y zonas) con los botones para fichar (CU-63). Después, las tareas en tarjetas, ordenadas por hora: primero «Asignadas a ti» y después las demás del día. Son suyas las asignadas a él y, si la tarea no está asignada a nadie, las de una zona de su turno cuya hora cae dentro del turno (de la hora de inicio, incluida, a la de fin, sin incluir).
3. Cada tarjeta muestra la hora, el título, el tipo, si está atrasada o es puntual, la zona, los animales, la cualificación que exige y, si está resuelta, quién y a qué hora.
4. Puede pasar al día anterior o al siguiente y volver a hoy.

**Flujos alternativos**

- **3a.** Si le falta la cualificación, la tarjeta lo explica y no ofrece botones. Las de otro día se ven, pero no se pueden marcar.

**Reglas de negocio:** RN-25, RN-26.

### CU-57 — Completar una tarea

| Actor principal | Fase |
| --- | --- |
| Cuidador o administrador | Trabajo diario, Bloque A |

**Flujo principal**

1. En «Mi día», el trabajador pulsa «Hecha» en una tarea pendiente de hoy.
2. El sistema comprueba que es de hoy, que sigue pendiente y que tiene la cualificación, y guarda quién y cuándo.
3. Con «Con nota» puede añadir observaciones (hasta 1000 caracteres). Las tareas no llevan fotos.

**Flujos alternativos**

- **A1.** «No se ha podido hacer»: el motivo es obligatorio y queda en las observaciones; la tarea pasa a `not_done`.
- **A2.** «Deshacer»: quien la resolvió, el mismo día, o un administrador en cualquier momento, la devuelve a pendiente; se borran las observaciones.
- **2a.** Ya resuelta (`TASK_NOT_PENDING`), de otro día (`TASK_FUTURE_DAY`) o sin la cualificación (`MISSING_QUALIFICATION`, 403).
- Una tarea de otra zona también se puede completar (para ayudar a un compañero).

**Reglas de negocio:** RN-25, RN-26.

### CU-58 — Generar las tareas

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `generate-tasks`, 00:10) | Trabajo diario, Bloque A |

**Flujo principal**

Cada día, para cada plantilla activa y en su propia transacción:

1. Calcula sus ocurrencias de hoy a 7 días vista según la repetición, las fechas de inicio y fin y sus horas (Europe/Madrid). Solo las que aún no han pasado.
2. Crea las que faltan; las que ya existen no se repiten.
3. Cada tarea copia el tipo, el título, la descripción, la zona, la cualificación y los animales que siguen en el santuario.

**Flujos alternativos**

- **1a.** Cambio de hora: una hora que no existe (en marzo) pasa a la hora siguiente; una que existe dos veces (en octubre) usa la segunda.
- **3a.** Si todos sus animales ya no están, no se crea la tarea.
- **4.** Al registrar el fallecimiento o traslado de un animal (CU-33), se retira de sus tareas pendientes desde ese momento; las que eran solo de animales y se quedan sin ninguno se borran.
- **Error inesperado** con una plantilla: se deshace su transacción, se registra y se continúa.

**Reglas de negocio:** RN-24.

### CU-59 — Cerrar las tareas del día

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `task-alerts`, cada 15 minutos) | Trabajo diario, Bloque A |

**Flujo principal**

1. Las tareas pendientes de días anteriores pasan a `not_done`, sin persona (`resolved_by` vacío): en la interfaz, «Cerrada por el sistema al acabar el día».
2. En el Bloque C, esta tarea también avisará de la medicación no dada.

**Postcondiciones:** la tarea es idempotente.

**Reglas de negocio:** RN-26.

### CU-60 — Gestionar plantillas de turno

| Actor principal | Fase |
| --- | --- |
| Administrador | Trabajo diario, Bloque B |

**Flujo principal**

1. El administrador abre «Plantillas de turno».
2. Ve los turnos ordenados por la hora de inicio, con su horario, los días de la semana en que se hacen y cuántas personas necesita cada zona.
3. Crea o edita un turno: nombre (único, sin distinguir mayúsculas), hora de inicio y de fin (el turno empieza y acaba el mismo día), días de la semana, cuántas personas necesita cada zona (de 1 a 20; las zonas en blanco no se exigen) y si está activo.

**Flujos alternativos**

- **3a.** Nombre repetido (`SHIFT_TEMPLATE_NAME_TAKEN`), fin no posterior al inicio, ningún día o zona inexistente o desactivada: error en el campo.
- **A1.** Borrar un turno que ya tiene personas asignadas: no se borra (`SHIFT_TEMPLATE_IN_USE`); se desactiva. Desactivado, deja de aparecer en los días en que no tiene a nadie y no admite asignaciones nuevas.

**Postcondiciones:** queda en el registro de actividad. Todo el personal puede consultar la lista de turnos.

**Reglas de negocio:** RN-27, RN-31.

### CU-61 — Organizar el calendario de turnos

| Actor principal | Fase |
| --- | --- |
| Administrador (consulta: todo el personal) | Trabajo diario, Bloque B |

**Flujo principal**

1. El trabajador abre «Turnos» y ve la semana actual, de lunes a domingo. Puede pasar a la anterior o a la siguiente.
2. Cada día muestra sus turnos (los activos que se hacen ese día y los que tienen a alguien), quién está en cada uno con sus zonas y si ha fichado, las zonas sin cubrir («Falta personal en Gran voladero: 0 de 1») y quién está ausente. Arriba, cuántos huecos hay en la semana.
3. El administrador asigna a una persona a un turno de un día y elige sus zonas; vienen marcadas las que pide el turno.
4. El administrador quita a una persona de un turno.
5. El administrador copia en la semana que ve los turnos de la semana anterior: cada turno pasa al mismo día de la semana siguiente con las mismas zonas. No se borra nada y se dice qué no se ha copiado y por qué.

**Flujos alternativos**

- **3a.** La persona no es un trabajador en activo, está ausente ese día o ya tiene un turno que se solapa; el turno no existe, está desactivado o no se hace ese día de la semana; el día ya ha pasado, o una zona no existe o está desactivada: error en su campo.
- **4a.** El turno ya se ha fichado o es de un día pasado: no se quita (`SHIFT_ALREADY_STARTED`).
- **5a.** No se copia un turno si el día ya ha pasado, el turno está desactivado o ya no se hace ese día, la persona ya no está en activo o está ausente, o ya tiene ese turno u otro que se solapa. Repetir la copia no duplica nada.
- **A1.** Al desactivar a un trabajador (CU-35) se quitan sus turnos de hoy en adelante que no ha fichado.

**Postcondiciones:** cada asignación creada o quitada queda en el registro de actividad. Los avisos del enlace de CU-64 abren la semana del hueco (`/admin/shifts?week=`).

**Reglas de negocio:** RN-28, RN-31.

### CU-62 — Registrar ausencias

| Actor principal | Fase |
| --- | --- |
| Administrador | Trabajo diario, Bloque B |

**Flujo principal**

1. El administrador abre «Ausencias» y ve las de hoy en adelante, con la persona, las fechas, el motivo (vacaciones, baja médica, asuntos propios u otro) y las notas.
2. Registra una ausencia: persona, primer y último día, motivo y notas opcionales.
3. El sistema quita los turnos de esos días que la persona no ha fichado y lo dice: los quitados («hay que volver a cubrirlos») y los que se mantienen porque ya los había fichado.

**Flujos alternativos**

- **2a.** La persona ya tiene una ausencia que toca esos días, no es un trabajador o el último día es anterior al primero: error en el campo.
- **A1.** Borrar una ausencia: los turnos quitados no vuelven; hay que asignarlos de nuevo.

**Postcondiciones:** queda en el registro de actividad. En el calendario (CU-61), el cuidador ve que un compañero está ausente, pero no el motivo ni las notas.

**Reglas de negocio:** RN-28, RN-29.

### CU-63 — Fichar la entrada y la salida

| Actor principal | Fase |
| --- | --- |
| Cuidador o administrador | Trabajo diario, Bloque B |

**Flujo principal**

1. En «Mi día», el bloque «Fichaje» muestra su turno de hoy y si ha fichado («Aún no has fichado la entrada», «Trabajando desde las 07:58» o «Turno terminado: de 07:58 a 15:05»; sin turno, «Hoy no tienes turno»). Pulsa «Fichar entrada» y se guarda la hora.
2. Al acabar, pulsa «Fichar salida» y lo confirma (después no se puede cambiar; un error se arregla hablando con el administrador).
3. En «Mis fichajes» (`/admin/my-shifts`) consulta sus turnos de un rango de fechas (las últimas 4 semanas por defecto, 92 días como mucho), del más reciente al más antiguo, con la entrada, la salida, las horas trabajadas de cada uno y el total.

**Flujos alternativos**

- **1a.** Un turno de otra persona no existe para él (404). Un turno de otro día: `SHIFT_NOT_TODAY`. Entrada repetida: `ALREADY_CHECKED_IN`.
- **2a.** Salida sin entrada: `NOT_CHECKED_IN`. Salida repetida: `ALREADY_CHECKED_OUT`.

**Postcondiciones:** el administrador ve en el calendario quién ha fichado. Un turno fichado ya no se quita (ni a mano ni al registrar una ausencia).

**Reglas de negocio:** RN-30.

### CU-64 — Avisar de turnos sin cubrir

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `coverage-check`, cada hora a los 5 minutos) | Trabajo diario, Bloque B |

**Flujo principal**

1. Calcula las zonas sin cubrir de hoy y los 6 días siguientes, sin los turnos que ya han acabado.
2. Por cada hueco que no se había avisado, envía un aviso a la campana de cada administrador en activo, en su idioma: «Falta personal en «Clínica y recuperación» en el turno de Tarde del 26/11/2026: 0 de 1.», con un enlace a la semana del calendario.

**Flujos alternativos**

- **2a.** Si el hueco ya se avisó, no se repite aunque siga sin cubrir. Si el administrador lo ha elegido, el aviso llega también por email (CU-73).

**Postcondiciones:** la tarea es idempotente (`staff_alerts` guarda cada aviso por día, turno y zona).

**Reglas de negocio:** RN-31.

### CU-65 — Gestionar la dieta de un animal

| Actor principal | Fase |
| --- | --- |
| Cuidador o administrador | Trabajo diario, Bloque C |

**Flujo principal**

1. En la ficha del animal, pestaña «Cuidados», pulsa «Nuevo alimento».
2. Escribe el alimento, la cantidad y la unidad (g, kg, unidades o ml) y, si quiere, las tomas («Mañana y tarde»), notas y las fechas de inicio (hoy por defecto) y de fin.
3. El sistema lo guarda y lo muestra en «Dieta».

**Flujos alternativos**

- **2a.** Cantidad no mayor que 0, con más de dos decimales, o fin anterior al inicio: error en el campo.
- **3a.** El animal ha fallecido o ha sido trasladado: «Este animal ya no está en el santuario.».
- **4.** Editar o borrar: si deja de comerlo, se le pone fecha de fin y queda «Terminada» en el historial.

**Postcondiciones:** el cambio queda en el registro de actividad. La dieta no crea tareas.

**Reglas de negocio:** RN-32.

### CU-66 — Anotar lo que ha comido cada animal

| Actor principal | Fase |
| --- | --- |
| Cuidador o administrador | Trabajo diario, Bloque C |

**Flujo principal**

1. En «Mi día», pulsa «Hecha» en una tarea de alimentación.
2. La ventana muestra un desplegable por animal con «Todo» ya elegido; cambia los que han comido menos y, si quiere, añade observaciones o una foto.
3. Pulsa «Marcar como hecha»: la tarea se completa y lo que ha comido cada animal se guarda.

**Flujos alternativos**

- **3a.** Un animal que no es de esa comida, o anotar comida en una tarea que no es de alimentación: error en el campo.
- **3b.** Si un animal llega a las tomas seguidas comiendo poco: CU-67.
- **4.** «Deshacer» la tarea borra también lo anotado.

**Postcondiciones:** la pestaña «Cuidados» muestra las comidas de los últimos 14 días.

**Reglas de negocio:** RN-26, RN-32.

### CU-67 — Avisar si un animal come poco

| Actor principal | Fase |
| --- | --- |
| Sistema (al completar una comida) | Trabajo diario, Bloque C |

**Flujo principal**

1. Al anotar una comida, el sistema cuenta las últimas tomas seguidas del animal en las que comió «Menos de la mitad» o «Nada».
2. Si llegan al número de los ajustes (2 por defecto), avisa en la campana, en su idioma, a los administradores y a quien tiene turno ese día en la zona: «Carbón ha comido poco en sus 2 últimas tomas.», con enlace a su pestaña «Cuidados».

**Flujos alternativos**

- **2a.** La misma racha no se vuelve a avisar aunque siga comiendo poco; una toma buena la corta y la siguiente racha sí se avisa.
- **2b.** El administrador cambia el número de tomas en «Tareas del día» → «Ajustes» (de 1 a 10).

**Postcondiciones:** el aviso queda en `staff_alerts`; si el administrador lo ha elegido, también sale por email (CU-73).

**Reglas de negocio:** RN-33, RN-34.

### CU-68 — Programar y registrar visitas veterinarias

| Actor principal | Fase |
| --- | --- |
| Cuidador o administrador; sistema (tarea `task-alerts`) | Trabajo diario, Bloque C |

**Flujo principal**

1. En «Cuidados», pulsa «Programar visita» y elige día (hoy o después), hora, motivo y, si quiere, veterinario.
2. El sistema guarda la visita y crea su tarea de revisión en «Mi día» de la zona del animal, con la insignia «Visita veterinaria».
3. El día de la visita, la tarea `task-alerts` avisa en la campana a los administradores y a quien tiene turno en la zona: «Hoy a las 11:00, visita veterinaria de Pipa: …».
4. Tras la visita, pulsa «Registrar la visita» (en «Mi día» o en «Cuidados») y rellena el formulario del historial veterinario (CU-34), con la descripción ya puesta.
5. El sistema crea el registro, marca la visita como hecha y completa su tarea.

**Flujos alternativos**

- **1a.** El animal no tiene zona: «Este animal no tiene zona…»; archivado: «Este animal ya no está en el santuario.».
- **4a.** Antes de su día: «La visita se podrá registrar el día en que está programada.».
- **4b.** «Hecha» sobre su tarea no vale: hay que registrarla con el formulario.
- **6.** «Cambiar» mueve la visita y su tarea; «Cancelar la visita» la cancela y quita su tarea. Una visita hecha o cancelada ya no cambia.

**Postcondiciones:** cada cambio queda en el registro de actividad; el aviso de la visita, en `staff_alerts`.

**Reglas de negocio:** RN-34, RN-36.

### CU-69 — Gestionar pautas de medicación y avisar de la medicación no dada

| Actor principal | Fase |
| --- | --- |
| Cuidador o administrador; sistema (tareas `generate-tasks` y `task-alerts`) | Trabajo diario, Bloque C |

**Flujo principal**

1. En «Cuidados», pulsa «Nueva pauta»: medicamento, dosis, vía, horas, fechas, cualificación necesaria y notas.
2. El sistema guarda la pauta y crea sus dosis de hoy a 7 días vista como tareas de medicación («Doxiciclina · 100 mg») en la zona del animal; `generate-tasks` sigue creándolas cada día.
3. Quien la da la marca como hecha en «Mi día» (si tiene la cualificación).
4. Cada 15 minutos, `task-alerts` busca las dosis de ayer y de hoy no dadas (pendientes pasada la hora y el margen, o no realizadas) y avisa una vez de cada una: «Carbón no ha recibido la dosis de las 10:00: Doxiciclina · 100 mg.».

**Flujos alternativos**

- **1a.** Sin horas, horas mal escritas, fin antes del inicio o más de 12 horas: error en el campo. Animal sin zona o archivado: como en CU-68.
- **5.** «Editar» rehace las dosis pendientes desde ahora. «Terminar» la cierra hoy y quita las dosis que faltan. «Borrar» solo si no tiene dosis resueltas («Esta pauta ya tiene dosis resueltas: termínala en lugar de borrarla.»).

**Postcondiciones:** la tarjeta de la pauta muestra las dosis dadas y no dadas; los cambios quedan en el registro de actividad.

**Reglas de negocio:** RN-25, RN-34, RN-35.

### CU-70 — Comunicar y gestionar incidencias

| Actor principal | Fase |
| --- | --- |
| Cualquier trabajador (comunicar, ver y resolver); administrador (crear su tarea) | Trabajo diario, Bloque D |

**Flujo principal**

1. Desde «Incidencias» o «Mi día», pulsa «Comunicar incidencia»: tipo (salud, comportamiento, instalaciones u otra), gravedad (baja, media o alta), zona y/o animal, «Título» (un resumen corto, de 3 a 80 caracteres, que es lo que se ve en el listado, en «Hoy» y en los avisos), «Qué pasa» (la descripción completa) y una foto opcional.
2. El sistema la guarda como «Abierta». Si se eligió un animal sin zona, toma la del animal.
3. Si la gravedad es alta, avisa al momento en la campana a los administradores en activo y a quien tiene turno hoy en la zona (sin contar a quien la comunica): «Incidencia grave en «Clínica y recuperación»: …».
4. Todo el personal ve el listado (por defecto, las pendientes: abiertas y en curso; filtros por estado, gravedad y zona) y la ficha. El menú muestra junto a «Incidencias» cuántas quedan pendientes.
5. Cualquier trabajador la resuelve («Resolver», explicando cómo) desde el listado o la ficha. No hay que «empezarla»: si existe, ya ha ocurrido; pasa a «En curso» cuando el administrador crea una tarea a partir de ella. Al resolverla deja de estar entre las pendientes; en «Resueltas» se ve cómo se resolvió, quién y cuándo, y se puede reabrir.
6. El administrador puede crear una tarea puntual a partir de ella (con el tipo, el título, la zona y el animal ya puestos); la incidencia pasa a «En curso».

**Flujos alternativos**

- **1a.** Sin descripción, o sin zona ni animal: «Describe lo que pasa.» / «Elige una zona o un animal.».
- **5a.** Mismo estado: «La incidencia ya está en ese estado.». Resolver sin nota: «Explica cómo se ha resuelto.».
- **6a.** Si ya tiene tarea o está resuelta: «Esta incidencia ya tiene una tarea.» / «Esta incidencia ya está resuelta.».

**Postcondiciones:** el alta, los cambios de estado y la tarea quedan en el registro de actividad (`incidents`).

**Reglas de negocio:** RN-27, RN-37, RN-39.

### CU-71 — Dejar y leer notas de relevo

| Actor principal | Fase |
| --- | --- |
| Cuidador o administrador | Trabajo diario, Bloque D |

**Flujo principal**

1. En «Mi día», la sección «Notas de relevo» muestra las notas de las últimas 24 horas de las zonas de su turno de hoy (el administrador, todas), las nuevas marcadas como «Nueva».
2. Pulsa «Marcar como leída» en las que ha leído.
3. Pulsa «Dejar una nota», elige una zona de su turno de hoy y escribe la nota (hasta 1000 caracteres). No hace falta fichar la salida para escribirla.

**Flujos alternativos**

- **3a.** Sin turno hoy en esa zona: «No tienes turno hoy en esta zona.». Zona desactivada: «Esta zona no existe o está desactivada.».

**Reglas de negocio:** RN-38.

### CU-72 — Ver el panel «Hoy»

| Actor principal | Fase |
| --- | --- |
| Administrador | Trabajo diario, Bloque D |

**Flujo principal**

1. Desde el menú «Trabajo diario» o el enlace del escritorio, abre «Hoy».
2. Ve en bloques: el recuento de las tareas de hoy, las atrasadas y las no realizadas, la medicación no dada, las incidencias abiertas y en curso (las graves primero), los turnos de hoy con quién no ha fichado, las zonas sin cubrir de los turnos que no han acabado, los animales que comen poco y las visitas veterinarias de hoy. Cada bloque enlaza a su pantalla.

**Reglas de negocio:** RN-18.

### CU-73 — Elegir los avisos por email

| Actor principal | Fase |
| --- | --- |
| Administrador; sistema (tarea `staff-emails`) | Trabajo diario, Bloques A (margen de «atrasada») y D |

**Flujo principal**

1. En «Avisos por email», marca qué avisos del personal llegan también por email y pulsa «Guardar».
2. Cada aviso nuevo de esos tipos queda pendiente de email; cada 5 minutos, `staff-emails` envía un email a cada destinatario en activo con el texto del aviso y el botón «Abrir en el panel», en su idioma.

**Flujos alternativos**

- **2a.** Si un envío falla, el aviso sigue en la campana y se cuenta como fallido; no se reintenta.

**Postcondiciones:** el cambio queda en el registro de actividad (`work_settings`).

**Reglas de negocio:** RN-39.

### CU-74 — Recibir el resumen diario

| Actor principal | Fase |
| --- | --- |
| Sistema (tarea `daily-summary`); administrador | Trabajo diario, Bloque D |

**Flujo principal**

1. En «Avisos por email», el administrador activa «Enviar el resumen del día» y elige la hora (20:00 por defecto).
2. Cada 15 minutos, `daily-summary` comprueba si ya es la hora; la primera vez que lo es, envía a cada administrador en activo el «Resumen del día»: tareas, medicación no dada, incidencias, animales que comen poco y zonas sin cubrir.

**Flujos alternativos**

- **2a.** Ya enviado hoy: no se repite (`staff_alerts` con `daily_summary`). Desactivado: no envía nada.

**Reglas de negocio:** RN-39.
