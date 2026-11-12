# Santuario de Animales — Sistema de diseño

## 1. Propósito y principios

Este documento define **cómo se ve** la aplicación: colores, tipografía, formas y componentes. Lo que aquí se define se usa en **todas** las pantallas. La distribución concreta de cada pantalla está en `SCREENS.md`.

Las reglas son para cualquier persona o IA que escriba la interfaz: **no se inventan colores, tamaños ni componentes nuevos** si ya existe uno aquí. Si hace falta algo nuevo, primero se añade a este documento.

**Principios:**

| Principio | Qué significa en la práctica |
| --- | --- |
| **Cálido y suave** | Beiges, marrones, terracota y oliva poco saturados. Nada de blanco puro ni negro puro. |
| **Cómodo a la vista** | Contraste suficiente para leer sin cansarse, pero sin estridencias. El modo oscuro es igual de cuidado que el claro. |
| **Plano y limpio** | Sin sombras: las superficies se separan con bordes finos y cambios suaves de fondo. |
| **Amable** | Esquinas redondeadas, botones en forma de píldora, tuteo, mensajes cercanos. |
| **Los animales son lo importante** | Las fotos y las historias son el contenido principal; la interfaz las acompaña sin competir con ellas. |
| **Para todos los dispositivos** | Se diseña primero para móvil y se amplía hasta el monitor de escritorio. |
| **Accesible** | Contraste AA verificado, uso completo con teclado y nada que dependa solo del color. |

## 2. Color

La paleta combina una **base neutra cálida** (crema, beige, marrón) con dos colores de marca: **terracota** (principal) y **verde oliva** (secundario). Se puede usar un **caramelo** como acento decorativo. Los colores de los avisos son **suavizados** para encajar con el resto.

Todos los colores se usan **a través de variables CSS** (tokens), nunca con su código directamente en un componente. Así el modo oscuro funciona solo con cambiar el valor de las variables.

### 2.1 Paleta del modo claro (principal)

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-bg` | `#FAF6F0` | Fondo general de la página (crema) |
| `--color-surface` | `#FFFDF9` | Fondo de tarjetas, formularios, ventanas emergentes |
| `--color-surface-alt` | `#F3EBDF` | Superficie beige: cabecera, pie, bandas de sección, filas alternas, campos deshabilitados |
| `--color-border` | `#DCCDB8` | Borde fino de tarjetas y separadores |
| `--color-border-strong` | `#9A846E` | Borde de campos de formulario y controles |
| `--color-text` | `#3B2F26` | Texto principal (marrón muy oscuro) |
| `--color-text-muted` | `#6B5A4B` | Texto secundario: fechas, ayudas, metadatos |
| `--color-primary` | `#A9532F` | Terracota: botón principal, enlaces, elemento activo |
| `--color-primary-hover` | `#8E4426` | Terracota oscuro: botón principal al pasar el ratón o pulsar |
| `--color-primary-soft` | `#F6E3D8` | Fondo suave terracota: elemento seleccionado, etiqueta destacada |
| `--color-on-primary` | `#FFFDF9` | Texto sobre terracota u oliva |
| `--color-secondary` | `#5E6B2F` | Verde oliva: botón secundario relleno, elementos de naturaleza |
| `--color-secondary-hover` | `#4C5726` | Oliva oscuro |
| `--color-secondary-soft` | `#ECEFDC` | Fondo suave oliva |
| `--color-accent` | `#C8963E` | Caramelo. **Solo decorativo** (líneas, adornos, ilustraciones); nunca para texto ni iconos con significado |
| `--color-focus` | `#A9532F` | Anillo de foco del teclado |

### 2.2 Paleta del modo oscuro

Un oscuro **cálido** (marrón tostado), no negro ni gris azulado. Los colores de marca se aclaran para mantener el contraste.

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-bg` | `#1E1915` | Fondo general |
| `--color-surface` | `#28211C` | Tarjetas, formularios, ventanas emergentes |
| `--color-surface-alt` | `#322922` | Cabecera, pie, bandas de sección, filas alternas |
| `--color-border` | `#4A3E34` | Borde fino |
| `--color-border-strong` | `#7A6A5B` | Borde de campos |
| `--color-text` | `#EFE6DA` | Texto principal (crema) |
| `--color-text-muted` | `#BFB1A0` | Texto secundario |
| `--color-primary` | `#E0956E` | Terracota claro |
| `--color-primary-hover` | `#EBAA88` | Terracota más claro |
| `--color-primary-soft` | `#3D2A20` | Fondo suave terracota |
| `--color-on-primary` | `#1E1915` | Texto sobre terracota u oliva (oscuro, no blanco) |
| `--color-secondary` | `#AAB874` | Oliva claro |
| `--color-secondary-hover` | `#BCC98A` | Oliva más claro |
| `--color-secondary-soft` | `#2C3020` | Fondo suave oliva |
| `--color-accent` | `#D9AE5F` | Caramelo (decorativo) |
| `--color-focus` | `#E0956E` | Anillo de foco |

### 2.3 Colores de los avisos

Cuatro tipos de aviso, con tonos suavizados pero **claros de identificar**. Cada aviso tiene un **borde** del color del tipo y un **fondo** muy suave del mismo tono, pensado para que el texto se lea con comodidad. El **texto** del aviso usa siempre `--color-text`, no el color del tipo. El icono sí usa el color del tipo.

| Tipo | Significado | Borde e icono (claro) | Fondo (claro) | Borde e icono (oscuro) | Fondo (oscuro) |
| --- | --- | --- | --- | --- | --- |
| `info` (azul) | Información útil | `#4F7290` | `#EEF3F7` | `#86A9C7` | `#1E2830` |
| `success` (verde) | Algo se ha hecho bien | `#4F7D41` | `#EEF5EA` | `#8FBB7E` | `#212E1F` |
| `warning` (amarillo) | Algo no cuadra, pero se puede continuar | `#A97B1E` | `#FBF4E2` | `#D8B45E` | `#332D19` |
| `error` (rojo) | Datos incorrectos o algo ha fallado | `#B04436` | `#FBEDEA` | `#E38778` | `#38211D` |

Tokens: `--color-info`, `--color-info-bg`, `--color-success`, `--color-success-bg`, `--color-warning`, `--color-warning-bg`, `--color-error`, `--color-error-bg`.

El rojo de error (`--color-error`) también se usa para el **texto de error bajo un campo** y para los **botones de acciones destructivas**, ya que cumple el contraste de texto sobre las superficies.

### 2.4 Contraste verificado

Todas las combinaciones se han calculado con la fórmula de WCAG 2.x. Mínimos: **4,5:1** para el texto y **3:1** para bordes de controles, iconos y foco.

| Combinación | Claro | Oscuro |
| --- | --- | --- |
| Texto principal sobre fondo | 12,04 | 14,11 |
| Texto principal sobre tarjeta | 12,75 | 12,84 |
| Texto principal sobre beige (`surface-alt`) | 10,96 | 11,52 |
| Texto secundario sobre fondo / tarjeta / beige | 6,12 / 6,48 / 5,57 | 8,31 / 7,56 / 6,78 |
| Texto del botón principal (normal / hover) | 5,21 / 6,88 | 7,21 / 8,83 |
| Texto del botón secundario (normal / hover) | 5,71 / 7,66 | 8,15 / 9,84 |
| Enlace terracota sobre fondo / tarjeta | 4,92 / 5,21 | 7,21 / 6,56 |
| Borde de campo sobre tarjeta | 3,50 | 3,05 |
| Texto principal sobre terracota suave / oliva suave | 10,43 / 11,07 | 10,97 / 10,96 |
| Anillo de foco sobre fondo | 4,92 | 7,21 |
| Texto dentro de un aviso (info / éxito / aviso / error) | 11,60 / 11,65 / 11,81 / 11,36 | 12,13 / 11,52 / 11,11 / 12,11 |
| Borde e icono del aviso sobre su fondo (info / éxito / aviso / error) | 4,54 / 4,35 / 3,46 / 4,94 | 6,08 / 6,49 / 6,93 / 5,70 |
| Texto de error de un campo sobre tarjeta | 5,55 | 6,04 |

> El caramelo del modo claro (`#C8963E`) tiene un contraste de 2,47 sobre el fondo: por eso **solo** se usa como adorno.

Si se cambia un color, hay que volver a comprobar su contraste antes de darlo por bueno.

### 2.5 Reglas de uso del color

- **Botón o acción principal** de cada pantalla: terracota. Solo **una** acción principal por bloque.
- **Acción secundaria:** botón con borde (ver [§8.1](#81-botones)); el oliva relleno se reserva para acciones secundarias destacadas (por ejemplo, «Haz una donación» junto a «Adopta a distancia»).
- **Enlaces dentro de un texto:** terracota y subrayados.
- **Rojo:** solo para errores y acciones destructivas. Nunca como decoración.
- **Sobre los fondos suaves** (`--color-primary-soft`, `--color-secondary-soft` y los fondos de aviso), el texto va siempre en `--color-text`. El texto terracota sobre terracota suave no llega al contraste mínimo en modo claro (4,26).
- El color **nunca es la única forma** de transmitir algo: cada aviso o estado lleva además icono y texto.
- Las fotos de los animales no llevan filtros de color.

## 3. Modo claro y modo oscuro

| Aspecto | Decisión |
| --- | --- |
| Modo por defecto | **Claro**, siempre, aunque el sistema del usuario esté en oscuro |
| Cómo se cambia | Botón sencillo, **siempre visible** en la cabecera (también en móvil, fuera del menú de hamburguesa) |
| Dónde se recuerda | En el navegador (`localStorage`, clave `theme`, valores `light` o `dark`). Funciona igual con y sin sesión. |
| Cómo se aplica | Atributo `data-theme="light"` o `data-theme="dark"` en `<html>`; las variables CSS cambian según el atributo |

**Botón de cambio de tema:**

- Botón circular de 44 × 44 px con borde fino, sin texto visible.
- Icono de **luna** (`fa-moon`) en modo claro e icono de **sol** (`fa-sun`) en modo oscuro: indica el modo al que se cambia.
- `aria-label` dinámico: «Activar modo oscuro» o «Activar modo claro». `aria-pressed` refleja si el modo oscuro está activo.
- Funciona con teclado (Tab + Intro o Espacio).

**Evitar el parpadeo:** en `index.html` hay un pequeño script, **antes** de cargar React, que lee `localStorage` y aplica `data-theme` al `<html>`. Así la página nunca se ve un instante en el modo equivocado. La lectura va dentro de `try/catch`: si el navegador no deja leer `localStorage`, se usa el modo claro.

**Reglas del modo oscuro:**

- Mismos componentes, mismas formas, mismos espaciados: **solo cambian los colores**.
- No hay sombras en ninguno de los dos modos.
- Las imágenes no se oscurecen ni se invierten.
- `color-scheme: light` o `dark` en `<html>`, para que el navegador adapte las barras de desplazamiento y los controles nativos.

## 4. Tipografía

Dos familias tipográficas, ambas **gratuitas** (licencia SIL Open Font License) e **instaladas en el propio proyecto** con los paquetes de Fontsource. No se cargan desde los servidores de Google, para no enviar datos de los visitantes a terceros (RGPD) y para que funcionen sin conexión.

| Uso | Fuente | Paquete | Pesos |
| --- | --- | --- | --- |
| Títulos (h1–h3), nombre del animal, logo de texto | **Fraunces**: serifa suave y cálida | `@fontsource-variable/fraunces` | 500, 600 |
| Texto, botones, formularios, tablas | **Nunito Sans**: sin serifa, redondeada y muy legible | `@fontsource-variable/nunito-sans` | 400, 600, 700 |

Fuentes de respaldo: `Georgia, 'Times New Roman', serif` para los títulos y `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` para el texto.

### 4.1 Escala

Tamaños en `rem` (1 rem = 16 px), para respetar el tamaño de letra que elija el usuario en su navegador. Los títulos grandes son fluidos: crecen con el ancho de pantalla entre un mínimo (móvil) y un máximo (escritorio).

| Token | Tamaño | Familia | Peso | Interlineado | Uso |
| --- | --- | --- | --- | --- | --- |
| `--font-size-display` | `clamp(2rem, 1.4rem + 3vw, 3rem)` | Títulos | 600 | 1.15 | Portada de la página de inicio |
| `--font-size-h1` | `clamp(1.75rem, 1.4rem + 1.5vw, 2.25rem)` | Títulos | 600 | 1.2 | Título de cada página, nombre del animal en su ficha |
| `--font-size-h2` | `clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem)` | Títulos | 600 | 1.25 | Secciones |
| `--font-size-h3` | `1.25rem` | Títulos | 500 | 1.3 | Nombre del animal en la tarjeta, subsecciones |
| `--font-size-lg` | `1.125rem` | Texto | 400 | 1.6 | Introducciones, historia del animal |
| `--font-size-base` | `1rem` | Texto | 400 | 1.6 | Texto general, botones, campos |
| `--font-size-sm` | `0.875rem` | Texto | 400 / 600 | 1.5 | Metadatos, ayudas, etiquetas, tablas del panel |
| `--font-size-xs` | `0.75rem` | Texto | 600 | 1.4 | Contadores (campana), insignias pequeñas |

**Reglas:**

- El texto de lectura nunca baja de 1 rem en la web pública ni en el área del adoptante. En el panel se permite `--font-size-sm` en las tablas.
- Ancho máximo de los párrafos largos (historia del animal, actualizaciones): **70 caracteres** (`max-width: 70ch`).
- Negrita (700) solo para resaltar palabras sueltas; los botones y las etiquetas usan 600.
- Las cifras de tablas e importes usan números de ancho fijo (`font-variant-numeric: tabular-nums`) para que queden alineadas.
- Sin texto en mayúsculas completas, salvo siglas.

## 5. Espaciado, tamaños y bordes

### 5.1 Espaciado

Escala basada en múltiplos de 4 px. **Solo** se usan estos valores para márgenes, rellenos y separaciones.

| Token | Valor | Uso típico |
| --- | --- | --- |
| `--space-1` | 4 px | Icono y texto muy juntos |
| `--space-2` | 8 px | Elementos dentro de una insignia, separación entre icono y texto |
| `--space-3` | 12 px | Relleno de campos y avisos |
| `--space-4` | 16 px | Relleno de tarjetas en móvil, margen lateral de la página en móvil |
| `--space-5` | 24 px | Relleno de tarjetas en escritorio, separación entre tarjetas |
| `--space-6` | 32 px | Separación entre bloques |
| `--space-7` | 48 px | Separación entre secciones (escritorio) |
| `--space-8` | 64 px | Secciones grandes de la página de inicio |

### 5.2 Redondeo

| Token | Valor | Uso |
| --- | --- | --- |
| `--radius-sm` | 8 px | Miniaturas pequeñas, casillas de verificación |
| `--radius-md` | 12 px | Campos de formulario, avisos, menús desplegables |
| `--radius-lg` | 16 px | **Tarjetas**, ventanas emergentes, fotos grandes |
| `--radius-pill` | 999 px | **Botones**, insignias de estado, filtros, interruptores |
| `--radius-round` | 50 % | Botones de solo icono, avatares |

### 5.3 Bordes y separación

- **Sin sombras** (`box-shadow: none`) en ningún componente ni en ningún modo.
- Borde fino: `1px solid var(--color-border)` en tarjetas, separadores, cabecera y pie.
- Borde de controles: `1px solid var(--color-border-strong)` en campos y botones con borde.
- Los avisos usan un borde de **1,5 px** del color del tipo, para que se distingan de las tarjetas.
- La separación entre capas se consigue con el borde y con el cambio entre `--color-bg`, `--color-surface` y `--color-surface-alt`.

### 5.4 Tamaños mínimos

- **Zona táctil mínima: 44 × 44 px** para cualquier elemento pulsable (botones, iconos, enlaces del menú, casillas).
- Altura de botones y campos: 44 px (normal) o 36 px (compacto, solo en el panel con ratón).
- Ancho máximo del contenido: **1200 px**, centrado. Formularios: máximo 560 px de ancho.

## 6. Iconos e imágenes

### 6.1 Iconos

- **Librería principal: Font Awesome Free** (solo los iconos gratuitos), estilos *solid* y *regular*, con el componente oficial para React.
- **Complemento:** si falta un icono en Font Awesome Free, se puede usar **Lucide** (licencia ISC, gratuita). Para mantener la coherencia, nunca se mezclan dos librerías **dentro del mismo componente** o de la misma barra de iconos.
- No se permite ningún icono de pago (por ejemplo, Font Awesome Pro).
- Tamaño por defecto: el del texto (`1em`). En botones de solo icono, 20 px.
- Iconos decorativos: `aria-hidden="true"`. Iconos que sustituyen al texto: con `aria-label` en el botón que los contiene.

**Iconos de referencia** (para usar siempre el mismo con el mismo significado):

| Significado | Icono Font Awesome |
| --- | --- |
| Aviso de información | `circle-info` |
| Aviso de éxito | `circle-check` |
| Aviso de advertencia | `triangle-exclamation` |
| Aviso de error | `circle-exclamation` |
| Cerrar | `xmark` |
| Modo oscuro / claro | `moon` / `sun` |
| Menú | `bars` |
| Notificaciones | `bell` |
| Adoptar | `hand-holding-heart` |
| Donar | `heart` |
| Adoptantes de un animal | `users` |
| Actualización | `newspaper` |
| Fecha | `calendar` |
| Especie, animal (genérico) | `feather` |
| Salud | `stethoscope` |
| Pago, aportación | `receipt` |
| Editar / borrar | `pen` / `trash-can` |
| Buscar / filtrar | `magnifying-glass` / `sliders` |
| Subir foto | `camera` |
| Perfil | `circle-user` |
| Cerrar sesión | `right-from-bracket` |
| Mostrar / ocultar contraseña | `eye` / `eye-slash` |
| Desplegar un menú | `chevron-down` |
| Descargar | `download` |

### 6.2 Logo provisional

Mientras no haya logo, el logo es **texto**: «Santuario de Animales» en Fraunces 600, color `--color-text`, con el icono `feather` en terracota a la izquierda. En móvil, si no cabe, se muestra solo el icono más «Santuario».

El logo se encapsula en un único componente `Logo`, preparado para aceptar una imagen más adelante (`/logo.svg` o un *placeholder*) sin tocar el resto de la interfaz. Si se usa imagen, tendrá `alt="Santuario de Animales"` y una altura máxima de 40 px en la cabecera.

### 6.3 Fotos

- **Proporción:** 4:3 en las tarjetas y en la foto principal de la ficha; las miniaturas de galería son cuadradas (1:1). Se recortan con `object-fit: cover`, centradas.
- **Esquinas:** las fotos dentro de una tarjeta siguen el redondeo de la tarjeta en las esquinas superiores; las fotos sueltas usan `--radius-lg`.
- **Sin foto:** un recuadro con fondo `--color-surface-alt` y el icono `feather` en `--color-text-muted`, centrado. Nunca un hueco vacío ni una imagen rota.
- **Carga:** las fotos fuera de la pantalla se cargan con `loading="lazy"`. Mientras cargan, se muestra el mismo recuadro beige.
- **Texto alternativo:** obligatorio (viene de `photos.alt_text`).
- **Vídeos:** controles nativos del navegador, sin reproducción automática y sin sonido por defecto.

## 7. Diseño adaptable (responsive)

Se diseña **primero para móvil** (desde 360 px de ancho) y se añaden ajustes al aumentar el ancho.

| Punto de corte | Desde | Dispositivo típico | Columnas del catálogo | Márgenes laterales |
| --- | --- | --- | --- | --- |
| Base | 0 px | Móvil | 1 | 16 px |
| `sm` | 600 px | Móvil grande, tablet vertical | 2 | 24 px |
| `md` | 768 px | Tablet | 2 | 32 px |
| `lg` | 1024 px | Portátil | 3 | 32 px |
| `xl` | 1280 px | Monitor | 4 | Automáticos (contenido centrado a 1200 px) |

**Reglas:**

- Nada provoca desplazamiento horizontal de la página, en ningún ancho.
- Las cuadrículas usan `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))` para que las tarjetas se recoloquen solas.
- Los menús se convierten en **hamburguesa** por debajo de `lg` (1024 px), tanto en la web pública como en el área del adoptante y en el panel.
- Los formularios ocupan todo el ancho en móvil; en escritorio, como máximo 560 px y centrados (o en dos columnas en el panel).
- Las ventanas emergentes ocupan casi toda la pantalla en móvil y tienen un ancho máximo de 560 px en escritorio.
- Las tablas del panel se convierten en **lista de tarjetas** por debajo de `md` (768 px).
- Se comprueba siempre a 360, 768, 1024 y 1440 px, y con la letra del navegador al 200 %.

## 8. Componentes

Cada componente vive en `client/src/components/` con su archivo `.module.css`. Se nombran en inglés (`Button`, `AnimalCard`, `Alert`…).

### 8.1 Botones

Forma de **píldora** (`--radius-pill`) en todos los casos. Texto en Nunito Sans 600. Altura de 44 px (36 px en la variante compacta del panel). Relleno horizontal de 20 px. Si llevan icono, va a la izquierda del texto con 8 px de separación.

| Variante | Fondo | Texto | Borde | Uso |
| --- | --- | --- | --- | --- |
| `primary` | `--color-primary` | `--color-on-primary` | ninguno | Acción principal (Adoptar, Guardar, Continuar) |
| `secondary` | `--color-secondary` | `--color-on-primary` | ninguno | Acción secundaria destacada (Haz una donación) |
| `outline` | transparente | `--color-text` | `--color-border-strong` | Acción secundaria normal (Cancelar, Ver más) |
| `ghost` | transparente | `--color-primary` | ninguno | Acción terciaria en barras y tarjetas |
| `danger` | `--color-error` | `--color-on-primary` | ninguno | Acción destructiva **dentro** de una ventana de confirmación |
| `icon` | transparente | `--color-text` | `--color-border` | Solo icono, circular de 44 × 44 px (tema, cerrar, menú) |

**Estados:**

| Estado | Aspecto |
| --- | --- |
| Hover | `primary` y `secondary` pasan a su color `-hover`; `outline`, `ghost` e `icon` toman el fondo `--color-surface-alt` |
| Pulsado | Igual que hover |
| Foco de teclado | Anillo de 3 px `--color-focus` separado 2 px del botón (`outline-offset: 2px`) |
| Deshabilitado | Opacidad 0,5, cursor `not-allowed`; nunca es la única forma de explicar por qué no se puede (se añade un texto de ayuda) |
| Cargando | El texto cambia («Guardando…»), aparece un indicador giratorio a la izquierda, el botón se desactiva y mantiene su ancho |

En móvil, los botones principales de un formulario ocupan todo el ancho.

### 8.2 Tarjeta de animal (`AnimalCard`)

El componente más importante de la web pública.

```text
┌───────────────────────────────┐   ← borde 1px --color-border, radio 16px, fondo --color-surface
│                               │
│          FOTO  4:3            │   ← esquinas superiores redondeadas
│                               │
├───────────────────────────────┤
│ Rufo                          │   ← Fraunces, --font-size-h3
│ 🪶 Buitre leonado · Macho     │   ← --font-size-sm, --color-text-muted
│ 👥 2 adoptantes               │   ← --font-size-sm
│ [En tratamiento]              │   ← insignia, solo si aplica
└───────────────────────────────┘
```

- Relleno del texto: `--space-4` en móvil y `--space-5` en escritorio.
- **Toda la tarjeta es un único enlace** a la ficha del animal (sin enlaces anidados dentro). El nombre del animal es el texto del enlace para los lectores de pantalla.
- Hover y foco: el borde pasa a `--color-primary` y la foto hace un zoom muy leve (`scale(1.03)`, 200 ms) dentro de su marco. Sin sombras ni desplazamientos de la tarjeta.
- Si el animal no admite adopciones, insignia neutra «No disponible para adoptar». Si no tiene adoptantes, el texto es «Sin adoptantes todavía».
- Mismas proporciones y alturas en toda la cuadrícula: los textos largos se cortan con puntos suspensivos a una línea (el nombre) o dos (el resto).

**Otras tarjetas** (adopción en «Mis animales», actualización del muro, resumen del escritorio) siguen la misma base: fondo `--color-surface`, borde fino, `--radius-lg`, sin sombra, mismo relleno.

### 8.3 Avisos en línea (`Alert`)

Los mensajes de error, éxito, advertencia e información **no son ventanas emergentes**: aparecen dentro de la página, en un rectángulo.

```text
┌──────────────────────────────────────────────────────┐  ← borde 1,5px del color del tipo, radio 12px
│ (✓)  Cambios guardados.                          [✕] │  ← fondo suave del tipo; icono del color del tipo
│      Tu nombre ya aparece en la ficha de Rufo.       │  ← texto en --color-text
└──────────────────────────────────────────────────────┘
```

| Propiedad | Valor |
| --- | --- |
| Borde | 1,5 px sólido, `--color-<tipo>` |
| Fondo | `--color-<tipo>-bg` |
| Texto | `--color-text`; título opcional en negrita (600) y descripción normal |
| Icono | Font Awesome a la izquierda, `--color-<tipo>`, alineado con la primera línea |
| Redondeo | `--radius-md` (12 px) |
| Relleno | `--space-3` vertical y `--space-4` horizontal |
| Botón de cerrar | `xmark` a la derecha, botón de 44 × 44 px con `aria-label="Cerrar aviso"` |

**Comportamiento:**

| Tipo | ¿Desaparece solo? | ¿Se puede cerrar? | Atributo de accesibilidad |
| --- | --- | --- | --- |
| `success` | **Sí**, a los 6 segundos. La cuenta se detiene mientras el ratón o el foco están sobre el aviso. | Sí | `role="status"` |
| `info` | No | Sí | `role="status"` |
| `warning` | No | Sí | `role="status"` |
| `error` | **No**. Se queda hasta que se corrige o se cierra. | Sí | `role="alert"` |

**Posición:**

- **Encima del formulario o de la sección afectada**, no flotando sobre la página. Si el aviso queda fuera de la vista, la página se desplaza hasta él (con suavidad, salvo si el usuario ha pedido reducir el movimiento) y, si es un error, recibe el foco.
- **Errores de cada campo:** además del aviso general, cada campo con error muestra su mensaje **debajo del campo**, en `--color-error`, con el icono `circle-exclamation` y el borde del campo en rojo. El aviso general resume el problema («Revisa los 2 campos marcados») y enlaza a cada campo.
- Avisos **de página** (por ejemplo, «Verifica tu email para poder adoptar» o «Pago simulado: no se realizará ningún cargo real»): debajo de la cabecera, ocupando el ancho del contenido. Son de tipo `warning` o `info` y no desaparecen solos.
- Como máximo un aviso por tipo y zona: si se repite, se sustituye el anterior.

**Ejemplos de uso:**

| Situación | Tipo |
| --- | --- |
| Email o contraseña incorrectos; pago fallido; campos no válidos | `error` |
| Perfil guardado; adopción completada; actualización publicada | `success` |
| Email sin verificar; adopción pausada por cuota fallida; animal sin actualización desde hace 12 días | `warning` |
| Explicación de la adopción simbólica; pago simulado; «Activa hasta el 29/11» | `info` |

### 8.4 Ventanas emergentes (`Modal`)

Solo se usan donde tienen sentido:

1. **Confirmar acciones importantes o que no se pueden deshacer:** borrar (animal, foto, actualización, especie), darse de baja de una adopción, eliminar la cuenta, registrar un fallecimiento o traslado, cancelar una adopción o devolver un pago (panel).
2. **La pasarela de pago simulado.**
3. **Ver las fotos de la galería en grande** (visor con flechas anterior y siguiente).

Cualquier otra cosa (formularios, mensajes de resultado, explicaciones) va en la página.

| Propiedad | Valor |
| --- | --- |
| Base técnica | Elemento nativo `<dialog>` con `showModal()` |
| Fondo de detrás | Velo `rgba(30, 25, 21, 0.55)` en ambos modos |
| Caja | `--color-surface`, borde fino, `--radius-lg`, sin sombra, relleno `--space-5` |
| Ancho | Máximo 560 px; en móvil, el ancho de la pantalla menos 16 px a cada lado |
| Cabecera | Título (Fraunces, h2) y botón de cerrar `xmark` |
| Pie | Botones alineados a la derecha en escritorio y apilados (ancho completo) en móvil; la acción principal la última en escritorio y la primera en móvil |
| Visor de fotos | Fondo casi opaco, foto centrada al máximo tamaño posible, flechas laterales y contador «3 de 8» |

**Comportamiento:** el foco va al primer elemento útil al abrir (en confirmaciones destructivas, al botón **Cancelar**, nunca al de borrar); el foco queda atrapado dentro mientras está abierta; la tecla Esc y el botón ✕ la cierran (salvo durante un pago en curso); al cerrar, el foco vuelve al botón que la abrió.

**Confirmación destructiva:** título en forma de pregunta («¿Eliminar la foto?»), una frase con la consecuencia, botón `outline` «Cancelar» y botón `danger` con el verbo concreto («Eliminar foto»), nunca un simple «Aceptar». La eliminación de la cuenta pide además la contraseña dentro de la ventana.

**Pago simulado:** muestra el concepto, el importe y un aviso `info` fijo («Pago simulado: no se realizará ningún cargo real»), con dos botones: `primary` «Simular pago correcto» y `outline` «Simular pago fallido». El resultado se muestra después, como aviso en línea en la página de destino.

### 8.5 Formularios

- **Etiqueta** siempre visible encima del campo (no solo como texto de ejemplo dentro del campo). Los campos opcionales llevan «(opcional)»; los obligatorios no llevan asterisco, porque son la mayoría.
- **Campo:** altura de 44 px, fondo `--color-surface`, borde `--color-border-strong`, `--radius-md`, relleno horizontal `--space-3`. En foco: anillo de 3 px `--color-focus`.
- **Error:** borde `--color-error`, mensaje debajo (ver [§8.3](#83-avisos-en-línea-alert)) y `aria-invalid="true"` + `aria-describedby` apuntando al mensaje.
- **Ayuda:** texto `--font-size-sm` `--color-text-muted` debajo del campo.
- **Áreas de texto** (historia, actualizaciones): altura mínima de 6 líneas, con ajuste vertical.
- **Casillas y botones de opción:** nativos con `accent-color: var(--color-primary)`, con zona pulsable de 44 px que incluye la etiqueta.
- **Interruptores** (`Switch`, sí/no en preferencias): casilla nativa con `role="switch"` en forma de píldora de 48 × 28 px; apagado con fondo `--color-surface-alt` y círculo `--color-text-muted`, encendido con fondo `--color-primary` y círculo `--color-on-primary`. Etiqueta a la izquierda y el texto del estado al lado («Sí» / «No»).
- **Teléfono:** campo numérico que solo admite dígitos (como mucho 9) y añade los guiones solo mientras se escribe: `612-34-56-78`. Ayuda: «Móvil español de 9 dígitos, sin el prefijo +34».
- **Selección de plan** (adoptar): tres tarjetas seleccionables (radio) con nombre, importe y descripción; la seleccionada lleva borde `--color-primary` de 2 px y fondo `--color-primary-soft`. El plan Usual viene marcado.
- **Subida de fotos:** zona de arrastrar y soltar con borde discontinuo `--color-border-strong`, `--radius-lg`, icono `camera` y el botón «Elegir archivos» (para quien no puede arrastrar).
- Los errores del servidor se muestran igual que los del cliente.

### 8.6 Insignias de estado (`Badge`)

Píldoras pequeñas (`--font-size-sm` 600, relleno 4 × 10 px, `--radius-pill`) con borde de 1 px, fondo suave e icono opcional. El texto siempre en `--color-text`, para que se lea bien.

| Estado | Estilo | Texto |
| --- | --- | --- |
| Adopción `active` | `success` | Activa |
| Adopción `pending` | `warning` | Pendiente de pago |
| Adopción `paused` | `warning` | Pausada |
| Adopción `cancelled` / `finished` | Neutro (`--color-border`, fondo `--color-surface-alt`) | Cancelada / Finalizada |
| Pago `completed` / `failed` / `pending` / `refunded` | `success` / `error` / `warning` / `info` | Cobrado / Fallido / Pendiente / Devuelto |
| Animal `in_treatment` | `info` | En tratamiento |
| Animal no adoptable | Neutro | No disponible para adoptar |
| Animal oculto (panel) | Neutro | Oculto |
| Actualización `adopters` | Terracota suave (`--color-primary-soft`) | Solo adoptantes |
| Actualización no leída | Terracota relleno, texto `--color-on-primary` | Nuevo |

### 8.7 Navegación

**Cabecera** (web pública y área del adoptante):

- Fondo `--color-surface-alt`, borde inferior fino, altura de 64 px, fija en la parte superior al desplazar (`position: sticky`).
- Izquierda: logo. Centro (escritorio): enlaces principales. Derecha: campana (con sesión), botón de tema, acceso o menú de usuario.
- **Desde `lg` (1024 px):** enlaces visibles. El enlace activo está subrayado con una línea terracota de 2 px.
- **Por debajo de `lg`:** botón de hamburguesa (`bars`) a la derecha. El **botón de tema y la campana siguen visibles** fuera del menú.
- **Menú de hamburguesa:** panel que se despliega bajo la cabecera a todo el ancho, con fondo `--color-surface`. Enlaces en lista con zona pulsable de 48 px. Se cierra con Esc, con ✕ o al elegir un enlace. El botón tiene `aria-expanded` y `aria-controls`.
- **Menú de usuario** (con sesión, desde `lg`): botón `outline` con el icono `circle-user`, el nombre y `chevron-down`, con `aria-expanded` y `aria-controls`. Despliega bajo el botón un panel alineado a la derecha, de 240 px, con fondo `--color-surface`, borde fino y `--radius-md`; enlaces en lista con zona pulsable de 44 px y, al final, separado por una línea, «Cerrar sesión» (`right-from-bracket`). Se cierra con Esc, al pulsar fuera o al elegir una opción. Por debajo de `lg`, sus opciones van al final del menú de hamburguesa.

**Pie:** fondo `--color-surface-alt`, borde superior fino. Enlaces informativos, contacto, aviso de privacidad y la nota «Proyecto académico — pagos simulados».

**Panel de gestión:** ver [§8.10](#810-panel-de-gestión).

### 8.8 Notificaciones (campana)

- Botón `icon` con `bell`; si hay notificaciones sin leer, un contador terracota (`--font-size-xs`, texto `--color-on-primary`) en la esquina superior derecha. Máximo «9+».
- `aria-label` dinámico: «Notificaciones, 3 sin leer».
- Al pulsar, se abre un panel desplegable (no una ventana emergente) de 360 px de ancho bajo la campana. En móvil ocupa todo el ancho bajo la cabecera. Lista de las 10 últimas, las no leídas con un punto terracota y fondo `--color-primary-soft`, y un enlace «Ver todas».

### 8.9 Otros componentes

| Componente | Descripción |
| --- | --- |
| **Paginación** | Botones en píldora: «Anterior», números (con «…» si son muchos) y «Siguiente». La página actual tiene fondo terracota y `aria-current="page"`. En móvil, solo «Anterior», «Página 2 de 7» y «Siguiente». |
| **Filtros** | En escritorio, barra horizontal sobre el listado. En móvil, botón «Filtros» (`sliders`) que despliega un panel. Los filtros activos se muestran como píldoras con ✕ y un enlace «Limpiar filtros». |
| **Pestañas** | Para la ficha del animal en el panel (Datos, Fotos, Actualizaciones, Veterinario). Texto con línea inferior terracota en la activa. En móvil, se pueden desplazar en horizontal **dentro** de su barra. |
| **Galería** | Foto principal 4:3 y miniaturas cuadradas debajo; al pulsar, se abre el visor ([§8.4](#84-ventanas-emergentes-modal)). En móvil, las miniaturas se desplazan en horizontal. |
| **Estado vacío** | Icono grande en `--color-text-muted`, una frase amable y, si procede, un botón de acción. Ejemplo: «Todavía no has adoptado a ningún animal» + «Ver animales». |
| **Carga** | Bloques «esqueleto» con la forma del contenido (por ejemplo, tarjetas vacías en `--color-surface-alt`) con un pulso muy suave. Para acciones cortas, el botón en estado «Cargando». No se usan pantallas de carga a página completa. |
| **Tarjeta de actualización** (`UpdateCard`) | Fondo `--color-surface`, borde fino y `--radius-lg`. Arriba, la fecha (`newspaper`) o, en el muro, la miniatura cuadrada y el nombre del animal; a la derecha, las insignias «Solo adoptantes» y «Nuevo». Título h2/h3, texto y fotos 4:3 (dos columnas desde `md`). Las no leídas llevan el borde en `--color-primary`; en el muro, botón `ghost` «Marcar como leída / no leída» abajo a la derecha. |
| **Migas de pan** | En la ficha del animal y en el panel: «Animales › Rufo». `--font-size-sm`. |
| **Separador decorativo** | Línea fina caramelo (`--color-accent`) de 48 px bajo los títulos de sección de la página de inicio. Solo decorativa. |

### 8.10 Panel de gestión

Usa **la misma paleta y los mismos componentes**, pero con un estilo **más sobrio y compacto**, porque se trabaja con muchos datos:

- Fondo general `--color-bg`; sin fotos grandes ni elementos decorativos (sin separadores caramelo).
- **Menú lateral** en escritorio (`lg`+): 240 px de ancho, fondo `--color-surface-alt`, borde derecho fino, con las secciones agrupadas («Animales», «Administración») e iconos. Elemento activo con fondo `--color-primary-soft` y barra terracota a la izquierda. Por debajo de `lg`, el menú se abre con la hamburguesa.
- Los botones y campos usan la **variante compacta** (36 px) en escritorio; en pantallas táctiles, siempre 44 px.
- **Tablas:**
  - Cabecera con fondo `--color-surface-alt` y texto `--font-size-sm` 600.
  - Filas de 48 px, separadas por un borde fino; filas alternas con un fondo muy suave.
  - Cabecera fija al desplazar.
  - Importes y fechas alineados a la derecha, con `tabular-nums`.
  - Acciones de cada fila al final, como botones `icon` con `aria-label`.
  - **Por debajo de `md` (768 px), cada fila se convierte en una tarjeta:** título (lo más importante de la fila), los demás datos como pares «etiqueta: valor» y las acciones abajo.
- **Escritorio del panel:** tarjetas de resumen con una cifra grande (Fraunces, `--font-size-h1`), su etiqueta y, si procede, un enlace. Las alertas de actualización usan avisos `warning` (12–13 días) y `error` (14 días o más).

## 9. Movimiento

Animaciones **mínimas y suaves**: ayudan a entender un cambio, nunca decoran.

| Elemento | Animación | Duración |
| --- | --- | --- |
| Hover de botones y enlaces | Cambio de color y fondo | 150 ms |
| Hover de tarjeta | Cambio de color del borde + zoom leve de la foto | 200 ms |
| Menú de hamburguesa, desplegables, filtros | Aparición con deslizamiento corto (8 px) y fundido | 200 ms |
| Ventana emergente | Fundido del velo y de la caja | 200 ms |
| Aviso de éxito al desaparecer | Fundido | 200 ms |
| Cambio de tema | Transición de colores de fondo y texto | 200 ms |
| Esqueletos de carga | Pulso de opacidad | 1,5 s, en bucle |

- Curva: `ease-out` para lo que aparece y `ease-in` para lo que desaparece.
- Con `prefers-reduced-motion: reduce`, todas las duraciones pasan a 0 ms y los esqueletos no laten. Nada se mueve en bucle salvo los esqueletos de carga.
- Nunca: reproducción automática de vídeo, carruseles que pasan solos ni efectos de paralaje.

## 10. Textos y tono

- **Se trata al usuario de tú:** «Tu adopción», «Revisa los campos marcados».
- Tono **cercano, cálido y claro**. Frases cortas. Sin tecnicismos ni jerga informática («No hemos podido guardar los cambios», no «Error 500»).
- Los botones dicen **lo que hacen**, con un verbo: «Adoptar a Rufo», «Guardar cambios», «Eliminar foto». Nunca «Aceptar» u «OK».
- Los mensajes de error explican **qué ha pasado y qué hacer**: «El email no tiene un formato válido. Ejemplo: nombre@correo.com».
- **Delicadeza** en los temas sensibles: fallecimientos («Faro nos ha dejado»), bajas y pagos fallidos, sin culpar al usuario («No hemos podido cobrar la cuota» en lugar de «Tu pago ha sido rechazado»).
- Se habla siempre de **adopción simbólica**, «adoptar a distancia» o «apadrinar», y se recuerda que el animal sigue en el santuario.
- Fechas: «10 de noviembre de 2026» en textos y `10/11/2026` en tablas. Importes: `5,00 €` (formato español).
- Ningún texto se escribe directamente en un componente: todos van en `client/src/i18n/locales/es.json` (ver `TECH_SPEC.md`).

## 11. Accesibilidad

Objetivo: **WCAG 2.2, nivel AA**.

- [ ] Contraste verificado de todas las combinaciones de color, en ambos modos ([§2.4](#24-contraste-verificado)).
- [ ] Toda la aplicación se puede usar solo con teclado, con un orden de foco lógico y el anillo de foco siempre visible.
- [ ] Enlace «Saltar al contenido» como primer elemento enfocable de cada página.
- [ ] HTML semántico: un solo `h1` por página, títulos en orden, `<nav>`, `<main>`, `<footer>`, `<button>` para acciones y `<a>` para navegación.
- [ ] Zonas pulsables de 44 × 44 px como mínimo.
- [ ] Ninguna información depende solo del color (avisos e insignias llevan icono y texto).
- [ ] Todas las fotos con texto alternativo; los iconos decorativos, ocultos a los lectores de pantalla.
- [ ] Formularios con etiquetas asociadas, errores enlazados al campo y avisos anunciados (`role="alert"` / `role="status"`).
- [ ] Ventanas emergentes con foco atrapado, cierre con Esc y retorno del foco.
- [ ] La página se lee correctamente con la letra del navegador al 200 % y a 320 px de ancho, sin desplazamiento horizontal.
- [ ] Se respeta `prefers-reduced-motion`.
- [ ] `lang="es"` en `<html>`.
- [ ] El aviso de éxito que desaparece solo se puede pausar (ratón o foco encima) y su contenido nunca es imprescindible.

## 12. Implementación

### 12.1 Archivos de estilos

```text
client/src/styles/
├── tokens.css        variables de color (claro y oscuro), tipografía, espaciado, radios
├── reset.css         normalización mínima
├── global.css        estilos base: body, títulos, enlaces, foco, selección de texto
└── utilities.css     clases utilitarias mínimas (visually-hidden, container, stack,
                      card-grid, decorative-rule, reading)
```

`tokens.css` incluye también los tamaños de letra de §4.1 (`--font-size-*`) y las fuentes (`--font-heading`, `--font-body`).

Cada componente tiene su propio `NombreComponente.module.css`, que solo usa variables de `tokens.css`.

### 12.2 Variables CSS (extracto de `tokens.css`)

```css
:root,
:root[data-theme="light"] {
  color-scheme: light;

  /* Superficies y texto */
  --color-bg: #FAF6F0;
  --color-surface: #FFFDF9;
  --color-surface-alt: #F3EBDF;
  --color-border: #DCCDB8;
  --color-border-strong: #9A846E;
  --color-text: #3B2F26;
  --color-text-muted: #6B5A4B;

  /* Marca */
  --color-primary: #A9532F;
  --color-primary-hover: #8E4426;
  --color-primary-soft: #F6E3D8;
  --color-on-primary: #FFFDF9;
  --color-secondary: #5E6B2F;
  --color-secondary-hover: #4C5726;
  --color-secondary-soft: #ECEFDC;
  --color-accent: #C8963E;
  --color-focus: #A9532F;

  /* Avisos */
  --color-info: #4F7290;     --color-info-bg: #EEF3F7;
  --color-success: #4F7D41;  --color-success-bg: #EEF5EA;
  --color-warning: #A97B1E;  --color-warning-bg: #FBF4E2;
  --color-error: #B04436;    --color-error-bg: #FBEDEA;

  --color-overlay: rgba(30, 25, 21, 0.55);

  /* Tipografía */
  --font-heading: "Fraunces Variable", Georgia, "Times New Roman", serif;
  --font-body: "Nunito Sans Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  /* Espaciado */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* Radios */
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-pill: 999px; --radius-round: 50%;

  /* Tamaños (§5.4, §8.7, §4.1): nombres para valores ya definidos en este documento */
  --size-touch: 44px;      /* zona táctil mínima, altura de botones y campos */
  --size-header: 64px;     /* altura de la cabecera */
  --content-max: 1200px;   /* ancho máximo del contenido */
  --reading-max: 70ch;     /* ancho máximo de los párrafos largos */

  /* Movimiento */
  --duration-fast: 150ms;
  --duration-base: 200ms;
}

:root[data-theme="dark"] {
  color-scheme: dark;

  --color-bg: #1E1915;
  --color-surface: #28211C;
  --color-surface-alt: #322922;
  --color-border: #4A3E34;
  --color-border-strong: #7A6A5B;
  --color-text: #EFE6DA;
  --color-text-muted: #BFB1A0;

  --color-primary: #E0956E;
  --color-primary-hover: #EBAA88;
  --color-primary-soft: #3D2A20;
  --color-on-primary: #1E1915;
  --color-secondary: #AAB874;
  --color-secondary-hover: #BCC98A;
  --color-secondary-soft: #2C3020;
  --color-accent: #D9AE5F;
  --color-focus: #E0956E;

  --color-info: #86A9C7;     --color-info-bg: #1E2830;
  --color-success: #8FBB7E;  --color-success-bg: #212E1F;
  --color-warning: #D8B45E;  --color-warning-bg: #332D19;
  --color-error: #E38778;    --color-error-bg: #38211D;
}

@media (prefers-reduced-motion: reduce) {
  :root { --duration-fast: 0ms; --duration-base: 0ms; }
}
```

### 12.3 Script de tema en `index.html`

```html
<script>
  (function () {
    var theme = 'light';
    try {
      var saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') theme = saved;
    } catch (e) { /* sin acceso a localStorage: modo claro */ }
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

### 12.4 Dependencias que añade este documento

Todas gratuitas. Deben añadirse a la tabla de librerías del cliente en `TECH_SPEC.md` (§4.3):

| Paquete | Para qué |
| --- | --- |
| `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/free-regular-svg-icons`, `@fortawesome/react-fontawesome` | Iconos Font Awesome Free |
| `lucide-react` (opcional) | Iconos que falten en Font Awesome Free |
| `@fontsource-variable/fraunces`, `@fontsource-variable/nunito-sans` | Fuentes instaladas en el proyecto |

## 13. Licencias de los recursos

| Recurso | Licencia | Condiciones |
| --- | --- | --- |
| Font Awesome Free: iconos | CC BY 4.0 | Uso gratuito, incluso comercial. La atribución que exige la licencia ya está incluida en los comentarios de los archivos del paquete; no hay que quitarlos. Se puede añadir una mención en la página «Sobre el santuario». |
| Font Awesome Free: código | MIT | Uso libre |
| Lucide | ISC | Uso libre |
| Fraunces, Nunito Sans | SIL Open Font License 1.1 | Uso libre; no se pueden vender las fuentes por separado |
| Fontsource (empaquetado) | MIT | Uso libre |

No se usará ningún recurso (iconos, fuentes, imágenes, ilustraciones) cuya licencia no sea gratuita para este uso. Las fotos de los animales serán propias del santuario o de bancos con licencia libre, indicando la fuente si la licencia lo pide.