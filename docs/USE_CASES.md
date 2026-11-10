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
| RN-08 | Cada mes, en `next_billing_date`, se cobra la cuota de las adopciones activas. Si el cobro falla, la adopción pasa a `paused` y se avisa al adoptante, que puede regularizarla. |
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
| RN-22 | Los fallecidos y trasladados no aparecen en el catálogo; los fallecidos pueden aparecer en «En memoria» (Fase 3). |
| RN-23 | El cuidador no gestiona dinero ni usuarios y no ve datos económicos (ingresos, pagos, donaciones). |

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
3. El visitante aplica filtros (especie, sexo, rango de edad, «disponible para adoptar»), busca por nombre o cambia el orden (más recientes, por nombre, menos adoptantes).
4. El sistema actualiza el listado y la paginación. Los filtros se reflejan en la URL para poder compartirla.
5. El visitante pulsa una tarjeta y pasa a CU-03.

**Flujos alternativos**

- **4a.** Ningún animal cumple los filtros: se muestra «No hay animales con estos filtros» y un botón para limpiarlos.
- **4b.** Página fuera de rango: se muestra la última página disponible.

**Postcondiciones**

- Ninguna (solo lectura).

**Reglas de negocio:** RN-22.

**Notas:** solo aparecen animales con `is_published = TRUE` y estado `in_sanctuary` o `in_treatment`. Los animales no adoptables (por ejemplo, uno que se prepara para su liberación) aparecen sin el botón de adoptar, salvo si se filtra por «disponible para adoptar». El filtro de sexo incluye la opción «Desconocido», porque en muchos buitres no se distingue a simple vista.

### CU-03 — Consultar la ficha pública de un animal

| Actor principal | Fase |
| --- | --- |
| Visitante (y cualquier usuario) | 1 |

**Precondiciones**

- El animal está publicado y su estado es `in_sanctuary` o `in_treatment`.

**Flujo principal**

1. El visitante abre la ficha (`/animals/:id`).
2. El sistema muestra la galería de fotos públicas en su orden, nombre, especie, raza (si tiene), sexo, edad aproximada, fecha de llegada, historia de rescate, carácter y necesidades especiales.
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
2. El sistema muestra el formulario: importe (libre, con algunas cantidades sugeridas), nombre, email, casilla «Donación anónima» y mensaje opcional. Si hay sesión de adoptante, el nombre y el email se rellenan con los de su cuenta.
3. El usuario completa el formulario y pulsa «Continuar».
4. El sistema valida los datos y muestra la pantalla de pago simulado con el aviso «Pago simulado: no se realizará ningún cargo real».
5. El usuario pulsa «Simular pago correcto».
6. El sistema crea la donación (`pending`), la cobra con la pasarela simulada y la marca como `completed` con su `paid_at` y su referencia.
7. El sistema muestra una página de agradecimiento con el recibo y envía un email de agradecimiento con el recibo, si hay email.
8. Si el usuario es adoptante, la donación queda vinculada a su cuenta y aparece en «Mis aportaciones» (CU-19), además de recibir una notificación `donation_thanks`.

**Flujos alternativos**

- **3a.** Importe vacío, 0, negativo o con más de dos decimales: error en el campo. No hay importe mínimo.
- **3b.** Email con formato no válido: error en el campo. El email es opcional sin sesión.
- **5a.** El usuario pulsa «Simular pago fallido»: la donación se guarda como `failed` con su motivo, y el sistema muestra «El pago no se ha completado» con la opción de volver a intentarlo. Un nuevo intento crea una donación nueva.
- **6a.** El usuario tiene sesión de trabajador: la donación se guarda sin `user_id` (RN-03).
- **7a.** No se indicó email: no se envía ningún email; el recibo solo se muestra en pantalla y se puede imprimir.

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
2. Introduce nombre, apellidos, email, contraseña (mínimo 8 caracteres) y su confirmación, y acepta la política de privacidad.
3. El sistema valida los datos y comprueba que el email no esté registrado (sin distinguir mayúsculas).
4. El sistema crea el usuario con `role = 'adopter'`, `email_verified = FALSE`, la contraseña con hash y `privacy_accepted_at`.
5. El sistema crea un token de verificación (24 horas) y envía el email de verificación.
6. El sistema inicia la sesión y muestra «Te hemos enviado un email para verificar tu cuenta». Si venía de adoptar, vuelve a la ficha del animal.

**Flujos alternativos**

- **3a.** El email ya está registrado: se muestra «Ya existe una cuenta con este email» con enlaces a «Iniciar sesión» y «He olvidado mi contraseña».
- **3b.** Las contraseñas no coinciden o no cumplen el mínimo: error en el campo.
- **3c.** No se acepta la política de privacidad: no se puede continuar.
- **5a.** Falla el envío del email: la cuenta se crea igualmente y el usuario puede pedir que se reenvíe (CU-08).

**Postcondiciones**

- Existe un usuario adoptante con el email sin verificar y la sesión iniciada.

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
- **3b.** Cuenta desactivada (`is_active = FALSE`) o anonimizada: se muestra «Esta cuenta no está activa. Contacta con el santuario».
- **3c.** Más de 5 intentos fallidos en 15 minutos: se muestra «Demasiados intentos; espera unos minutos».
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
3. Si la cuenta existe y está activa, el sistema crea un token `password_reset` (1 hora) y envía el email.
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
3. El sistema muestra los planes activos, con el plan por defecto (Usual) preseleccionado, y recuerda que la adopción es simbólica, que el animal no sale del santuario y que puede tener otros adoptantes.
4. El adoptante elige un plan y pulsa «Continuar».
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
- **6a.** El adoptante pulsa «Simular pago fallido»: se guarda el pago como `failed` con su motivo; la adopción sigue `pending` y se muestra «El pago no se ha completado. Puedes intentarlo de nuevo ahora o desde "Mis animales" durante 7 días» (CU-14).
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

- El adoptante tiene una adopción propia en estado `pending` (creada hace 7 días o menos) o `paused`.

**Flujo principal**

1. En «Mis animales», la adopción aparece con el aviso «Pendiente de pago» o «Pausada: la última cuota no se pudo cobrar», y el botón «Pagar ahora».
2. El adoptante pulsa el botón; el sistema muestra el importe y la pantalla de pago simulado.
3. El adoptante pulsa «Simular pago correcto».
4. El sistema crea el pago `completed` y:
   - si estaba `pending`: la pasa a `active` como en CU-13, paso 7;
   - si estaba `paused`: cobra el periodo que empieza en `next_billing_date`, la pasa a `active` y avanza `next_billing_date` un mes.
5. El sistema notifica el cobro (`adoption_welcome` o `payment_completed`) y vuelve a «Mis animales».

**Flujos alternativos**

- **1a.** Adopción `pending` creada hace más de 7 días: no se ofrece pagar, porque CU-44 la cancelará. Se ofrece iniciar una adopción nueva.
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
4. El usuario puede marcar todas como leídas o borrar una notificación. En `/notifications` está el listado completo, paginado.

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
5. El sistema muestra el recibo: datos del santuario, del adoptante, concepto, importe, fecha, referencia y la indicación «Pago simulado». En la Fase 2 es una página HTML imprimible; desde la Fase 3, un PDF descargable.

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

**Notas:** volver a adoptar al mismo animal más adelante crea una adopción nueva (CU-13), una vez cerrada la anterior.

### CU-22 — Descargar el certificado de adopción

| Actor principal | Fase |
| --- | --- |
| Adoptante | 3 |

**Precondiciones**

- La adopción es propia y está `active`.

**Flujo principal**

1. En «Mis animales», el adoptante pulsa «Certificado».
2. El sistema genera un PDF con el nombre del adoptante, el nombre y la foto de portada del animal, la especie y la fecha de inicio de la adopción.
3. El navegador descarga el archivo `certificado-<animal>.pdf`.

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
   - idioma (Fase 3).
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

### CU-26 — Regalar una adopción

| Actor principal | Fase |
| --- | --- |
| Adoptante | 3 |

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

**Notas:** antes de implementar este caso hay que decidir quién paga las cuotas siguientes: quien regala (durante cuántos meses) o quien recibe. Es una decisión funcional pendiente (`TECH_SPEC.md` §18, cuestión 6).

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
2. Rellena nombre, especie (de la lista de especies), raza (opcional), sexo (macho, hembra o desconocido), fecha de nacimiento aproximada, fecha de llegada, historia de rescate, carácter, necesidades especiales y resumen de salud, y marca si es adoptable y si se publica.
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
- **2b.** Se marca como adoptable un animal fallecido o trasladado: no se permite.

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

**Postcondiciones**

- La actualización queda modificada o eliminada.

### CU-33 — Registrar el fallecimiento o traslado de un animal

| Actor principal | Fase |
| --- | --- |
| Cuidador, administrador | 2 (el cierre de adopciones ya funciona en la Fase 1) |

**Precondiciones**

- El animal está en estado `in_sanctuary` o `in_treatment`.

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

- **4a.** Desactivar a un adoptante con adopciones activas: el sistema pregunta si también se dan de baja (como CU-21) o se mantienen. Por defecto, se dan de baja.
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
3. El sistema crea la cuenta con `email_verified = TRUE`, sin contraseña utilizable, y un token `password_reset` de 24 horas.
4. El sistema envía al trabajador un email de invitación con un enlace para elegir su contraseña (CU-10, desde el paso 4).
5. El sistema muestra «Cuenta creada. Hemos enviado una invitación a [email]».

**Flujos alternativos**

- **3a.** El email ya está registrado: «Ya existe una cuenta con este email». Si es de un adoptante, no se convierte (RN-03).
- **4a.** La invitación caduca sin usarse: el administrador puede reenviarla desde la ficha del usuario.

**Postcondiciones**

- Existe la cuenta de trabajador, pendiente de que su titular elija la contraseña.

**Reglas de negocio:** RN-02, RN-03.

**Notas:** las cuentas de `TEST_DATA.sql` ya tienen contraseña, siguiendo el convenio `NombreApellido26#!`. En la aplicación real, la contraseña la elige el trabajador.

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

- **A1. Pausar** una adopción `active`: pasa a `paused` (deja de cobrarse) con una nota obligatoria.
- **A2. Reanudar** una adopción `paused`: pasa a `active`. Si `next_billing_date` ya ha pasado, se cobrará en el siguiente ciclo de CU-43.
- **A3. Cancelar** una adopción abierta: pasa a `cancelled` (`admin_cancelled`) con `end_date` = hoy y una nota obligatoria. Se pregunta si se devuelve la última cuota (CU-38).
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
   - animales más adoptados (adopciones activas);
   - animales sin adoptantes;
   - adopciones nuevas y bajas por mes;
   - reparto de adopciones activas por plan.

**Flujos alternativos**

- **3a.** No hay datos en el rango: se indica en cada gráfico.

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