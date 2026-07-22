# iPug — documento maestro

> El móvil de Pug Inc. Una web mobile-first, privada, para Irene y Vicente,
> con la estética del Nookófono de *Animal Crossing: New Horizons*.

- **Repo:** `ipug`
- **Carpeta local:** `C:\Users\irene\Desktop\VRLabs\Nookofono`
- **Fecha del documento:** 22 de julio de 2026
- **Estado:** diseño cerrado, implementación en fase 0

---

## 0. Índice

1. [Decisiones tomadas](#1-decisiones-tomadas)
2. [Catálogo de mini-apps](#2-catálogo-de-mini-apps)
3. [Sistema de diseño](#3-sistema-de-diseño)
4. [Arquitectura](#4-arquitectura)
5. [Estructura de carpetas](#5-estructura-de-carpetas)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Interacciones clave](#7-interacciones-clave)
8. [Fases de despliegue](#8-fases-de-despliegue)
9. [APIs externas](#9-apis-externas)
10. [Roadmap](#10-roadmap)
11. [Licencias y aviso legal](#11-licencias-y-aviso-legal)

Documento hermano: **[`MIGRACION-BACKEND.md`](./MIGRACION-BACKEND.md)** — el manual
completo para pasar de GitHub Pages a un backend real. No te lo saltes cuando
llegue el momento; está escrito para que la migración sea mecánica.

---

## 1. Decisiones tomadas

| Tema | Decisión | Motivo |
|---|---|---|
| **Nombre** | **iPug** | Parodia de Apple. El gesto de mantener pulsado para reordenar apps ya era un guiño a iOS, así que nombre e interacción cuentan el mismo chiste. Deja libres las marcas internas (PugPug Airlines). |
| **Hosting fase 1** | GitHub Pages | Para enseñar el frontend a Vicente cuanto antes, con datos de ejemplo. |
| **Hosting fase 2** | Cloudflare Workers | Ver §8. Es el único free tier de 2026 sin cláusula comercial, sin pausas y con ancho de banda ilimitado. |
| **Apps en v1** | Todas | Las que aún no tengan backend funcionan con datos locales. |
| **Iconos** | Los aporta Irene → se convierten a **WebP** | Ver §3.6 para el pipeline. |
| **Idioma** | UI en español, código en inglés | Estándar de la industria; encaja con las librerías y la documentación. |
| **Framework** | React 19 + TypeScript + Vite | Ecosistema, tipado y velocidad de desarrollo. |
| **Arquitectura** | FSD-light + registry de mini-apps + repository pattern | Añadir o quitar una app = una carpeta y una línea. Ver §4. |

### 1.1 El aviso importante sobre GitHub Pages

**GitHub Pages no puede alojar datos privados.** Verificado en la documentación
oficial de GitHub:

- Con cuenta gratuita, **el repositorio debe ser público** para poder publicar.
- Y aunque pagues GitHub Pro para tener el repo privado, **el sitio publicado
  sigue siendo público**. Pro solo esconde el código fuente, no la web.
- Límite duro de **1 GB** por sitio → inviable para fotos.
- **Sin código de servidor**: no puedes ocultar una API key ni saltarte el CORS.

**Consecuencia práctica y regla de oro del proyecto:**

> En la fase de GitHub Pages, **jamás** se sube un dato real. Ni gastos, ni saldos,
> ni fotos vuestras, ni la cartilla de Nilo, ni direcciones. Todo son datos de
> ejemplo (*seed*) inventados. Los datos reales entran **solo** después de migrar
> a Workers con autenticación (§8, fase 2).

Esto no es paranoia: un sitio de GitHub Pages es indexable por Google.

---

## 2. Catálogo de mini-apps

Estado: 🟢 funcional en v1 · 🟡 funcional con datos locales · 🔵 requiere backend

20 apps, todas con icono ilustrado. Las 4 marcadas con ⚓ están además en el dock.

| # | App | Estado | Notas |
|---|---|---|---|
| 1 | **Tiempo** | ✅ Construida | Datos reales de Open-Meteo, ubicación del móvil |
| 2 | **Notas** | ✅ Construida | Papel con renglones, reordenables, personales y compartidas |
| 3 | **Pugporte** | ✅ Construida | Datos fijos en código; sólo el lema es editable |
| 4 | **Nilo** | ✅ Construida | Ficha fija, vacunas, gráfica de peso, paseos con GPS |
| 5 | **Pug airlines** | ✅ Construida | Tarjetas de embarque. Falta el globo terráqueo |
| 6 | **Spotify** ⚓ | ✅ Construida | Tocadiscos real vía Web Playback SDK |
| 7 | **Cacahuete** ⚓ | ✅ Construida | Aviso al otro móvil vía ntfy. Ver §9.7 |
| 8 | **Compra** ⚓ | ⬜ Pendiente | Requiere el JSON precomputado de Mercadona |
| 9 | **Valentín** ⚓ | ⬜ Pendiente | Falta definir cómo habla |
| 10 | **Cuentas** | ⬜ Pendiente | Entrada manual + importar CSV |
| 11 | **Calendario** | ⬜ Pendiente | Necesita backend para compartir de verdad |
| 12 | **Casa** | ⬜ Pendiente | |
| 13 | **Tareas** | ⬜ Pendiente | |
| 14 | **Incidencias** | ⬜ Pendiente | |
| 15 | **Calculadora** | ⬜ Pendiente | La única que no necesita nada |
| 16 | **Excel** | ⬜ Pendiente | |
| 17 | **Fotos** | ⬜ Pendiente | Necesita R2 |
| 18 | **Archivos** | ⬜ Pendiente | RAG sobre documentos, según el rename a "RAGugtín" |
| 19 | **Deporte** | ⬜ Pendiente | |
| 20 | **Por hablar** | ⬜ Pendiente | |

⚓ = también en el dock.

> ⚠️ **Todas las apps construidas guardan en `localStorage`**, es decir, en el
> móvil de cada uno. **Irene y Vicente no comparten datos todavía**: cada uno ve
> sus notas, sus destinos y su historial. Eso no se arregla con más frontend —
> hace falta el backend de la fase 2. Es la limitación más importante del
> estado actual.

Apps aportadas por Irene junto con sus iconos, con la interpretación que les di
(pendiente de confirmar): **Cacahuete** = botón de "me agobio, rescátame".
**Valentín** = consejos. **Casa** = inventario del hogar y plantas.
**Incidencias** = averías y reparaciones. **Por hablar** = temas pendientes de
hablar con calma. **Deporte** = entrenamientos y rachas. **Tiempo** = el tiempo
en Valencia.

### 2.1 Perfil (Pasaporte)

Dos pasaportes al estilo Animal Crossing, uno por persona. Campos calcados de la
pantalla real del juego (verificados):

**No editables:** nombre, nombre de la isla, fruta autóctona, cumpleaños, fecha de
registro.
**Editables:** foto, título, comentario.
**Extra:** icono del signo del zodiaco, sello de "Representante Residente".

Detalle de diseño verificado que merece la pena respetar: **el comentario tiene un
máximo de 24 caracteres y se muestra dentro de un bocadillo de diálogo**. Y el
título no se escribe libre, se construye combinando dos listas de palabras. Vamos
a imitar ambas cosas porque son justo lo que hace que se sienta auténtico.

Aquí van las fotos de Irene y Vicente (pendientes de que las pases).

### 2.2 Calendario

- Vista mensual + vista de agenda.
- Cada evento se asigna a **Irene / Vicente / Ambos**, con color propio.
- Marcado visual de aniversarios y cumpleaños recurrentes.
- Sin sincronización externa en v1; en fase 2, opción de exportar a `.ics`.

### 2.3 Notas

- Blocs **personales** (solo tuyos) y **compartidos** (ambos).
- Markdown ligero: títulos, listas, casillas de tarea.
- Fijar notas arriba.
- Conflictos: "gana la última escritura" con marca de tiempo del servidor. Es
  suficiente para dos personas; ver §4.5 si algún día queréis edición simultánea.

### 2.4 PugPug Airlines

La app más vistosa, parodia de Dodo Airlines (que a su vez parodia a Japan
Airlines — el precedente lo puso Nintendo, así que estamos en buena compañía).

- **Globo terráqueo 3D** interactivo.
- Lista de destinos que vosotros añadís. Cada uno: **visitado** (tachado) o
  **pendiente** (sin tachar).
- Al añadir un destino, se **geocodifica automáticamente** y aparece una
  **chincheta roja** en el globo.
- **Línea de arco desde Valencia** (39.4699, -0.3763) hasta cada destino.
- Ficha de destino con estilo de **tarjeta de embarque**: perforación central,
  talón con código de vuelo, sello rotado.

### 2.5 Dinero

- Cuentas manuales con saldo y movimientos.
- Gastos por categoría, con quién lo pagó y cómo se reparte.
- Balance "quién debe a quién".
- **Importación de extractos CSV** de Revolut y BBVA, parseados en el navegador.
- ⚠️ La lectura automática de saldos bancarios **no es posible para particulares**;
  ver §9.2. Es la mayor renuncia del proyecto y conviene asumirla desde el
  principio.

### 2.6 Lista de la compra

Inspirada en la app de Mercadona:

- Navegación por categorías con foto de producto.
- Ficha de producto: precio, precio por kilo/litro, formato.
- **Favoritos** y **listas** guardadas.
- Marcar productos como comprados durante la compra.
- Total estimado del carro.

### 2.7 Nilo (Pug Care)

Seguimiento del pug:

- **Ficha**: nombre, raza, fecha de nacimiento, número de **microchip**, número de
  **pasaporte**, veterinario.
- **Vacunas**: nombre, fecha puesta, fecha de caducidad, aviso cuando toca.
- **Peso**: registro con gráfica de evolución.
- **Salud**: entradas de "hoy no se encuentra bien", síntomas, medicación, visitas.
- **Paseos**: "modo paseo" explícito con cronómetro, ruta en mapa y distancia.
  ⚠️ **Los pasos automáticos no son posibles desde una web** — la feature está
  rediseñada; ver §9.5 para el porqué y la alternativa.

### 2.8 Fotos, 2.9 Archivos

Galería y gestor de archivos. Ambas necesitan almacenamiento real (R2), así que en
v1 son maquetas con imágenes de ejemplo.

### 2.10 Calculadora

La única app 100 % funcional sin backend desde el minuto uno. Con la estética de
botones de goma de AC, que le va perfecta.

### 2.11 Hojas

Hojas de cálculo ligeras: rejilla, fórmulas básicas (`SUMA`, `PROMEDIO`,
referencias entre celdas). No pretende ser Excel; pretende ser suficiente.

### 2.12 Música

Lista compartida de Spotify. Ver §9.

### 2.13 Ideas para más adelante

Recetas · Pelis y series pendientes · Retos de pareja (estilo Millas Nook) ·
Cápsula del tiempo (cartas que se abren en una fecha) · Mapa de casa/inventario ·
Diario · Regalos e ideas.

---

## 3. Sistema de diseño

Basado en investigación de fuentes públicas. Marco cada dato como **[V]**
verificado en fuente citada o **[I]** inferido.

### 3.1 Paleta

Los valores verificados provienen del CSS de `IdreesInc/NookPhone`, una maqueta
pública cuyo autor sampleó los colores de capturas del juego, y de un gist muy
citado con el CSS del bocadillo de diálogo.

```css
:root {
  /* Superficies */
  --nk-bg-cream:      #FDF8E3; /* [V] fondo de pantalla y paneles */
  --nk-surface:       #FFFDF2; /* [I] tarjetas elevadas */
  --nk-surface-sunk:  #F3EBCF; /* [I] campos hundidos, filas alternas */
  --nk-border:        #E0DACA; /* [V] bordes suaves */

  /* Texto */
  --nk-text:          #807256; /* [V] texto principal, marrón cálido */
  --nk-text-strong:   #482016; /* [V] titulares */
  --nk-text-muted:    #A99B7E; /* [I] secundario */

  /* Verdes de marca */
  --nk-leaf:          #8DC63F; /* [I] verde hoja de la UI */
  --nk-nook-green:    #5DBB63; /* [V] verde corporativo Nook Inc. */
  --nk-leaf-dark:     #4E8C36; /* [I] contorno y sombra de la hoja */

  /* Acentos pastel */
  --nk-accent-blue:   #54D4FC; /* [V] */
  --nk-accent-pink:   #FDC0C7; /* [V] */
  --nk-accent-yellow: #F1AE04; /* [V] flecha de diálogo, Millas */

  /* Sistema */
  --nk-shadow:        rgba(0, 0, 0, .10);    /* [V] */
  --nk-shadow-strong: rgba(72, 32, 22, .18); /* [I] sombra teñida de marrón */
}
```

**Regla que marca la diferencia:** en Animal Crossing ninguna sombra es gris
neutro, siempre está teñida hacia el marrón o el verde del entorno. Usar
`--nk-shadow-strong` en lugar de negro puro cambia por completo la calidez del
resultado.

### 3.2 Tipografía

El juego usa **Seurat** (diálogos e interfaz) y **FOT-Rodin** (Fontworks), ambas
comerciales. Sustitutas libres bajo licencia SIL Open Font, aptas para todo uso:

| Fuente | Uso |
|---|---|
| **Fredoka** | Titulares y UI. La más parecida a Rodin/Seurat. |
| **Nunito** | Cuerpo de texto. La más legible del grupo. |
| **Varela Round** | Alternativa; es la que usa la maqueta real del NookPhone. |

```css
:root {
  --nk-font:      "Fredoka", "Varela Round", system-ui, sans-serif;
  --nk-font-body: "Nunito", system-ui, sans-serif;

  --nk-fs-app-title: clamp(1.6rem, 8.75vw, 2.19rem); /* 35px sobre lienzo 400 */
  --nk-fs-status:    clamp(.9rem, 5.5vw, 1.375rem);  /* 22px */
  --nk-fs-h2:        1.5rem;
  --nk-fs-body:      1rem;
  --nk-fs-caption:   .75rem;
}
```

⚠️ Los `input` con `font-size` menor de 16px provocan zoom automático al enfocar
en iOS. Nunca bajar de 16px en campos de formulario.

### 3.3 Pantalla de inicio

**La referencia no es el NookPhone del juego, sino una pantalla de inicio de iOS
tematizada con iconos de Animal Crossing.** Es una distinción importante y define
todo el layout: no imitamos el menú de una consola, imitamos un iPhone. Lo cual,
además, es coherente con el nombre.

Anatomía, de arriba abajo:

| Zona | Especificación |
|---|---|
| **Barra de estado** | Cobertura + operador ("Pug Inc.") + wifi · hora centrada · luna + batería |
| **Rejilla** | **4 columnas**, filas automáticas, desplazamiento horizontal por páginas |
| **Etiquetas** | **Sí, bajo cada icono**, en marrón oscuro, ~13px, peso 500 |
| **Ola** | Curva que separa la arena del mar, invadiendo la zona de la rejilla |
| **Puntos** | Uno por página, sobre el mar |
| **Dock** | Fijo abajo, mar profundo, **4 iconos sin etiqueta** |

Las apps del dock **no se quitan de la rejilla**: aparecen en los dos sitios. Se
aparta así de iOS, donde el dock es exclusivo, pero es lo que pidió Irene y para
20 apps tiene sentido — el dock son atajos, no un cajón separado.

La rejilla es de **12 iconos por página** (4×3, constante `PAGE_SIZE`), y las
páginas se calculan troceando la lista ordenada. Consecuencia útil: al arrastrar
un icono, los siguientes **se desbordan solos a la página siguiente**, igual que
en iOS.

Paleta de la playa, muestreada de la referencia:

```css
--nk-sand:     #F3EEE0;  /* arena: fondo de la rejilla */
--nk-sea:      #8FBFBD;  /* mar: franja bajo la ola */
--nk-sea-deep: #74A9A7;  /* mar profundo: fondo del dock */
```

```css
.nk-page {
  flex: 0 0 100%;
  scroll-snap-align: center;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: clamp(14px, 3.2vw, 22px) clamp(4px, 1.5vw, 10px);
}

.nk-app__icon {
  width: clamp(58px, 16vw, 70px);
  aspect-ratio: 1;
  border-radius: 24%;              /* squircle iOS, NO círculo */
  box-shadow: 0 2px 5px rgba(72, 32, 22, .16);
  transition: transform .15s ease;
}
.nk-app:active .nk-app__icon { transform: scale(.92); }
```

**Paginación:** `scroll-snap-type: x mandatory` sobre un contenedor con
`overflow-x: auto`. El gesto táctil manda y los puntos solo reflejan el estado
(se calculan de `scrollLeft / clientWidth`). Tocar un punto navega a esa página.

> **Nota sobre la investigación previa:** el informe de estilo concluyó que el
> NookPhone del juego usa 3 columnas y **no** lleva etiqueta bajo cada icono (el
> nombre aparece grande arriba, cambiando según el icono enfocado). Eso es
> correcto **para el juego**, pero la referencia elegida es otra cosa. Queda
> anotado por si algún día quieres una vista alternativa fiel a la consola.

### 3.4 Componentes característicos

**Bocadillo de diálogo** — radios verificados, y son la firma visual del juego:

```css
.nk-dialogue {
  background: var(--nk-bg-cream);
  color: var(--nk-text);
  border-radius: 40% 40% 30% 30% / 150% 150% 150% 150%;
  padding: 2.2em 2em;
  animation: nk-blob 1.25s ease-in-out infinite alternate;
}
@keyframes nk-blob {
  from { transform: rotate( .3deg) scale(1);   }
  to   { transform: rotate(-.3deg) scale(.99); }
}
```

**Botón píldora** — el truco está en usar `box-shadow` sólido como grosor
inferior, que es lo que da la sensación de botón físico de goma:

```css
.nk-btn {
  border-radius: 999px;
  padding: .85em 2em;
  background: var(--nk-leaf);
  color: #fff;
  font-family: var(--nk-font);
  font-weight: 700;
  border: none;
  box-shadow: 0 4px 0 var(--nk-leaf-dark), 0 6px 10px var(--nk-shadow);
  transition: transform .12s ease, box-shadow .12s ease;
}
.nk-btn:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--nk-leaf-dark), 0 2px 4px var(--nk-shadow);
}
```

**Panel de papel**, **spinner de hoja** y **sparkles**: ver implementación en
`src/shared/ui/`.

### 3.5 Estilo de los iconos

Receta visual **[I]**, deducida de capturas:

1. Cuadrado con esquinas muy redondeadas (*squircle*), `border-radius: ~28%`.
   **No es un círculo.**
2. Fondo de **color plano único** por app, sin degradados fuertes.
3. Pictograma **blanco o crema sobre el color**, silueta gruesa y rellena. Nada de
   line-art fino ni detalles pequeños.
4. Borde interior claro de 2-4px, `rgba(255,255,255,.55)`. **Sin contorno negro.**
5. Sombra exterior corta hacia abajo.

Colores de fondo asignados a nuestras apps:

| App | Color | App | Color |
|---|---|---|---|
| Perfil | `#E8C547` | Nilo | `#C98A5E` |
| Calendario | `#EF6F6C` | Fotos | `#E86A92` |
| Notas | `#F1AE04` | Archivos | `#6BCFCF` |
| PugPug Airlines | `#5AA9E6` | Calculadora | `#8C8C9E` |
| Dinero | `#7BC67E` | Hojas | `#4FA96B` |
| Compra | `#F58A3C` | Música | `#7FA8E8` |

### 3.6 Pipeline de iconos a WebP

Cuando pases los PNG, el proceso es este. Déjalos en `assets-src/icons/`:

```bash
npm run icons        # convierte assets-src/icons/*.png → public/icons/*.webp
```

El script (`scripts/build-icons.mjs`, usa `sharp`):

- Redimensiona a **512×512** (el tamaño de origen habitual de estos sets es
  1000×1000, así que hay margen de sobra).
- Exporta a **WebP con calidad 90**, típicamente un 70-80 % menos de peso que el
  PNG original.
- Genera además una variante **@2x** para pantallas retina.
- Deja el nombre en kebab-case, que es la clave con la que el manifest de cada
  mini-app referencia su icono.

### 3.7 Sonido

Assets **Kenney UI Audio** e **Interface Sounds**, ambos **CC0** (sin atribución
requerida): `kenney.nl/assets/ui-audio`.

⚠️ La política de autoplay de los navegadores exige un gesto del usuario antes de
reproducir nada. Hay que inicializar el `AudioContext` en el primer toque.

---

## 4. Arquitectura

El objetivo que pediste: **añadir o quitar apps, o cambiar de tecnología, tiene
que ser trivial**. Se consigue combinando tres patrones, cada uno resolviendo un
problema distinto.

### 4.1 Por qué estos tres y no otros

| Patrón | Qué resuelve | ¿Lo usamos? |
|---|---|---|
| **Feature-Sliced Design** | Estructura de carpetas con regla de dependencia unidireccional | ✅ En versión reducida |
| **Registry / plugin + manifest** | Que cada mini-app se auto-declare | ✅ Es la pieza clave |
| **Ports & Adapters (hexagonal)** | Aislar el dominio de la infraestructura | ✅ **Solo en la capa de datos** |
| Clean Architecture | Lo mismo, con más ceremonia | ❌ Genera cuatro ficheros para leer una lista de la compra |
| Micro-frontends | Que equipos independientes desplieguen por separado | ❌ Sois dos personas y un repo. Sería dolor puro. |

Aplicar hexagonal a *toda* la aplicación sería sobreingeniería. Aplicarlo **solo
a la capa de datos** es exactamente donde aporta valor, porque es la única
frontera que de verdad vas a querer cambiar (Pages → Workers → lo que venga).

### 4.2 La regla de dependencia

```
shared/     ←  no importa de nadie
entities/   ←  solo importa de shared
apps/       ←  importa de entities y shared
app/        ←  importa del registry
```

**Nada importa desde `apps/` hacia fuera, salvo el registry.** Esa única regla es
la que hace que borrar una carpeta no rompa nada.

### 4.3 El registry — el corazón del sistema

```ts
// src/apps/registry.ts
export interface MiniAppManifest {
  id: string;
  title: string;          // en español, se muestra en la UI
  icon: string;           // nombre del .webp en public/icons/
  color: string;          // color de fondo del icono
  path: string;           // ruta del router
  enabled: boolean;       // desactivar sin borrar código
  page: number;           // página por defecto, empezando en 1
  inDock?: boolean;       // además, en la barra fija inferior
  comingSoon?: boolean;   // se pinta atenuada
  component: LazyExoticComponent<ComponentType>;
  tools?: LlmTool[];      // capacidades expuestas al LLM (fase 3)
}

const modules = import.meta.glob('./*/manifest.ts', { eager: true });
export const registry = Object.values(modules)
  .map((m) => m.default)
  .filter((a) => a.enabled);
```

El router, la rejilla, el dock, **el número de páginas y sus puntos** y (en el
futuro) las herramientas del LLM **se generan del registry**. Nada de eso está
escrito a mano en ningún sitio: mover una app al dock es cambiar su `slot`, y
crear una página nueva es poner `page: 3` en alguna app.

**Añadir una app "Recetas"** = crear `src/apps/recipes/` con su `manifest.ts`.
Nada más. Ni tocar el router, ni la home, ni la navegación.
**Quitarla** = `enabled: false`, o borrar la carpeta.

### 4.4 La capa de datos intercambiable

El puerto no sabe nada de HTTP ni de SQL:

```ts
// src/shared/data/ports.ts
export interface Repository<T, TNew = Omit<T, 'id'>> {
  list(filter?: Record<string, unknown>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(data: TNew): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}
```

Y hay un único punto de cambio en todo el proyecto:

```ts
// src/shared/data/index.ts   ← EL ÚNICO FICHERO QUE CAMBIA AL MIGRAR
import { makeLocalRepo } from './adapters/local.adapter'; // fase 1
// import { makeHttpRepo } from './adapters/http.adapter'; // fase 2

export const repos = {
  notes:  makeLocalRepo<Note>('notes'),
  events: makeLocalRepo<CalendarEvent>('events'),
  // ...
};
```

Los componentes **nunca** ven el backend. Solo ven `repos.notes.list()`. Migrar de
`localStorage` a un Worker con D1 es cambiar `makeLocalRepo` por `makeHttpRepo`.
Una línea, cero cambios en las 12 mini-apps.

Adaptadores previstos:

| Adaptador | Fase | Guarda en |
|---|---|---|
| `local.adapter.ts` | 1 (GitHub Pages) | `localStorage` / IndexedDB |
| `http.adapter.ts` | 2 (Workers) | D1 vía la API del Worker |
| `supabase.adapter.ts` | alternativa | Postgres de Supabase |
| `memory.adapter.ts` | tests | memoria |

### 4.5 Estado y sincronización

**TanStack Query v5** + `persistQueryClient` sobre IndexedDB.

Para dos personas **no hacen falta WebSockets**: un `refetchInterval` de 15-30
segundos con la pestaña visible, más `refetchOnWindowFocus`, da una experiencia
indistinguible del tiempo real.

Dos avisos verificados en la documentación de TanStack que ahorran horas de
depuración:

1. Las mutaciones **no sobreviven a una recarga de página** salvo que registres
   `queryClient.setMutationDefaults(['notes','create'], { mutationFn })`. Las
   funciones no se serializan.
2. Cada mutación reescribe **el objeto persistido entero** en IndexedDB. Con
   pocos datos ni se nota, pero antes de meter 3.000 gastos hay que pasar a
   `experimental_createQueryPersister`, que persiste por query.

Y uno más: **no usar `localStorage` como persister** — 5 MB de cuota y bloquea el
hilo principal.

Si algún día queréis **editar la misma nota a la vez**, el camino es Yjs con un
Durable Object de Cloudflare como proveedor WebSocket. No antes: para listas y
gastos, "gana la última escritura" es correcto y muchísimo más simple.

---

## 5. Estructura de carpetas

```
ipug/
├─ docs/
│  ├─ PROYECTO.md              ← este documento
│  └─ MIGRACION-BACKEND.md     ← el manual de migración
│
├─ assets-src/icons/           ← PNG originales (no se publican)
├─ scripts/build-icons.mjs     ← conversión a WebP
│
├─ public/
│  ├─ icons/                   ← .webp generados
│  ├─ sounds/                  ← Kenney CC0
│  └─ manifest.webmanifest
│
├─ src/
│  ├─ app/                     ← arranque, sin lógica de negocio
│  │  ├─ main.tsx
│  │  ├─ providers.tsx         ← QueryClient, tema, sesión
│  │  ├─ router.tsx            ← rutas generadas DESDE el registry
│  │  └─ styles/tokens.css     ← las variables de §3.1
│  │
│  ├─ apps/                    ← una carpeta = una mini-app
│  │  ├─ registry.ts           ← ⭐ el fichero clave
│  │  ├─ profile/
│  │  │  ├─ manifest.ts        ← id, título, icono, ruta, enabled
│  │  │  ├─ index.tsx          ← componente raíz (lazy)
│  │  │  ├─ ui/                ← componentes propios
│  │  │  ├─ model/             ← hooks de TanStack Query, tipos, zod
│  │  │  └─ api/               ← llamadas al repositorio, nunca fetch directo
│  │  ├─ calendar/
│  │  ├─ notes/
│  │  ├─ airlines/
│  │  ├─ money/
│  │  ├─ shopping/
│  │  ├─ nilo/
│  │  ├─ photos/
│  │  ├─ files/
│  │  ├─ calculator/
│  │  ├─ sheets/
│  │  └─ music/
│  │
│  ├─ entities/                ← modelos de dominio compartidos
│  │  ├─ person/               ← Irene, Vicente, "ambos"
│  │  └─ money/                ← formateo de importes, divisas
│  │
│  └─ shared/                  ← nadie de aquí importa hacia arriba
│     ├─ ui/                   ← NkButton, NkDialogue, NkPanel, NkSheet...
│     ├─ lib/                  ← fechas, cn(), hooks genéricos, sonido
│     ├─ config/
│     └─ data/                 ← ⭐ capa de datos abstraída
│        ├─ ports.ts
│        ├─ query-keys.ts
│        ├─ seed/              ← datos de ejemplo de la fase 1
│        └─ adapters/
│
├─ index.html
├─ vite.config.ts
└─ package.json
```

---

## 6. Modelo de datos

Definido ya en fase 1 aunque viva en `localStorage`, para que el `schema.sql` de
D1 en fase 2 sea una traducción directa. Todas las tablas llevan `id` (UUID),
`created_at` y `updated_at`.

```ts
type PersonId = 'irene' | 'vicente';
type Assignee = PersonId | 'both';

Profile   { personId, displayName, islandName, nativeFruit, birthday,
            registeredAt, photoKey, title, comment /* máx 24 */, zodiac }

CalendarEvent { title, description, startsAt, endsAt, allDay,
                assignee: Assignee, color, recurrence }

Note      { title, body, ownerId: PersonId | 'shared', pinned, tags[] }

Destination { name, country, lat, lon, visited, visitedAt, notes }

Account   { name, kind: 'bank'|'cash'|'card', currency, balance, institution }
Expense   { description, amountCents, currency, category, paidBy: PersonId,
            splitMode: 'even'|'payer'|'custom', accountId, occurredAt }

ShoppingList { name, archived }
ShoppingItem { listId, productId?, name, quantity, unit,
               priceCents?, checked }
FavoriteProduct { productId, name, imageUrl, lastPriceCents }

Pet          { name, breed, birthday, chipNumber, passportNumber, vetName }
Vaccination  { petId, name, appliedAt, expiresAt, notes }
WeightEntry  { petId, measuredAt, grams }
HealthEntry  { petId, occurredAt, symptoms, medication, vetVisit, notes }
Walk         { petId, startedAt, endedAt, durationSec, distanceM, steps? }
```

---

## 7. Interacciones clave

### 7.1 Mantener pulsado para reordenar (estilo iPhone) ✅ implementado

1. **Pulsación larga** sobre cualquier icono entra en *modo edición*. La duración
   está en la constante `LONG_PRESS_MS` de `src/App.tsx`.
2. Todos los iconos **tiemblan** (rotación de ±2,2° alternando). Cada uno lleva
   `animation-delay` y `animation-duration` ligeramente distintos según su
   posición: **sin ese desfase el efecto parece un parpadeo, no un temblor**. Es
   el detalle que lo hace creíble.
3. El icono arrastrado **se eleva** (escala 1,12 + sombra marcada), deja de
   temblar y oculta su etiqueta.
4. Los demás **se reorganizan en vivo** dejando el hueco.
5. Se sale tocando el mar o con el botón **"Hecho"**.
6. El orden se guarda en `localStorage` bajo `ipug.icon-order`.

Implementación: **`@dnd-kit`** (`PointerSensor` + `TouchSensor`), que es la
librería con mejor soporte táctil y accesibilidad.

> **Nota sobre `LONG_PRESS_MS`:** está en **3000 ms** porque así lo pidió Irene.
> iOS real usa ~500 ms, así que puede resultar lento en comparación. Cambiar el
> número es una línea.

Cuatro detalles que rompen esto en móvil si se olvidan:
- `touch-action: none` en los iconos arrastrables, o el navegador se queda el
  gesto para hacer scroll.
- `onContextMenu={(e) => e.preventDefault()}` y `-webkit-touch-callout: none`,
  o sale el menú contextual del navegador al mantener pulsado.
- El temblor va sobre `.nk-app__icon`, **no** sobre `.nk-app`: el contenedor
  lleva el `transform` que dnd-kit necesita para mover el icono, y si se mezclan,
  la rotación pisa al arrastre.
- Tras disparar la pulsación larga hay que **anular el `click`**, o al soltar se
  abriría la app.

### 7.2 Reconciliación del orden guardado

`useAppOrder` no confía en lo que hay en `localStorage`: lo cruza con el registry,
descarta los ids de apps que ya no existen y añade al final las nuevas. Así,
**añadir una app nunca rompe el orden guardado** ni deja huecos.

### 7.3 Barra de estado

- **Hora**: real, del dispositivo. Se comprueba cada segundo pero se guarda el
  string ya formateado, así React descarta 59 de cada 60 renders.
- **Batería**: real vía Battery Status API, dibujada en **tres tramos** — llena
  (>66 %), media (>25 %) y vacía, esta última en rojo. Rayo cuando carga.

⚠️ La Battery Status API **solo existe en navegadores Chromium**. Safari y Firefox
la eliminaron por privacidad, así que **en el iPhone no habrá dato**. Cuando no
está disponible se dibuja la pila vacía y se omite el porcentaje, en vez de
inventar un número.

### 7.2 Instalación como PWA

- iOS **no genera splash screens** desde el manifest: hay que declarar
  `apple-touch-startup-image` por cada resolución. Lo hace `vite-plugin-pwa`.
- `viewport-fit=cover` es **obligatorio** o `env(safe-area-inset-*)` devuelve 0 y
  el contenido se mete bajo el notch.
- Safari **puede purgar los datos** de sitios no usados en ~7 días si no están
  instalados en la pantalla de inicio. Un motivo más para instalarla de verdad.

---

## 8. Fases de despliegue

### Fase 1 — GitHub Pages (ahora)

- Repo `ipug`, público, **solo datos de ejemplo**.
- Despliegue con GitHub Actions a cada push en `main`.
- Datos en `localStorage` mediante `local.adapter.ts`.
- URL: `https://<usuario>.github.io/ipug`.

Sirve para enseñar el diseño, validar la navegación y decidir qué apps merecen la
pena. Nada más, y no hace falta que sea nada más.

### Fase 2 — Cloudflare Workers (cuando queráis datos reales)

Todo el detalle está en **[`MIGRACION-BACKEND.md`](./MIGRACION-BACKEND.md)**.
Resumen de por qué Cloudflare y no otro:

| | Cloudflare Workers | Vercel Hobby | Netlify Free | GitHub Pages |
|---|---|---|---|---|
| Assets estáticos | **Gratis e ilimitados** | 100 GB | Por créditos | 100 GB |
| Funciones | **100k/día** | 1M/mes pero 4 CPU-h | Consumen créditos | ❌ |
| Se pausa al agotar | ❌ Nunca | ✅ 30 días | — | — |
| Cláusula "no comercial" | ❌ No | ✅ **Sí** | — | — |
| Secretos en runtime | ✅ | ✅ | ✅ | ❌ |

Base de datos **Cloudflare D1** (SQLite): 5 GB, 5M lecturas/día, 100k
escrituras/día y **no se pausa nunca**. Frente a Supabase, que **pausa el proyecto
tras 7 días de baja actividad** con 90 días para restaurarlo antes de perder los
datos — riesgo inaceptable justo para la app que guarda el historial médico de
Nilo. Un viaje de diez días sin abrir la app bastaría.

Estimación de consumo con uso diario intensivo de dos personas: entre **20× y
330× por debajo** de todos los límites. Coste real: **0 €/mes indefinidamente**.

### Fase 3 — LLM (opcional)

Proxy en el Worker con la API key en un secreto, rate limit por usuario, y *tool
calling* sobre vuestros propios datos. El diseño del registry (§4.3) ya lo deja
preparado: cada mini-app declara sus `tools` en el manifest y el Worker las
recopila automáticamente. Añadir una app le da esa capacidad al asistente sin
tocar nada más.

⚠️ Es la **única pieza del stack que no es gratis**. Anthropic no tiene tier
gratuito continuo; las cuentas nuevas reciben 5 $ de crédito. Con Haiku 4.5 y unas
200 consultas al mes hablamos de céntimos, pero conviene saberlo.

---

## 9. APIs externas

Investigación con pruebas de endpoints y CORS **ejecutadas en vivo el 22 de julio
de 2026**. Esta sección contiene malas noticias importantes; prefiero que las
sepas ahora y no después de construir media app sobre una suposición falsa.

| API | Veredicto | Resumen |
|---|---|---|
| Mercadona | ⚠️ Con condiciones | Funciona sin auth, pero **sin CORS** → requiere proxy o job de build |
| Revolut personal | ❌ Imposible directo | No existe API personal. Open Banking exige licencia AISP |
| BBVA | ❌ Imposible directo | Igual: certificado eIDAS de entidad regulada |
| Spotify | ⚠️ Con condiciones | Funciona 100 % en cliente, pero **el dueño necesita Premium** |
| Globo terráqueo | ✅ Usable | Todo gratis, MIT, sin API keys |
| Contador de pasos | ❌ Imposible fiable | No hay acceso web a Apple Health ni Health Connect |

### 9.1 Mercadona — ⚠️ funciona, pero no como esperas

**No existe API oficial.** Ni portal de desarrolladores, ni documentación, ni
programa de partners. Lo que hay es la API interna del propio `tienda.mercadona.es`,
descubierta por ingeniería inversa. Los endpoints responden **200 sin ninguna
autenticación**:

```
GET https://tienda.mercadona.es/api/categories/?lang=es&wh=vlc1
GET https://tienda.mercadona.es/api/categories/{id}/?lang=es&wh=vlc1
GET https://tienda.mercadona.es/api/products/{id}/?lang=es&wh=vlc1
```

`vlc1` es el código de almacén de Valencia, que es justo el vuestro.

**El problema:** probado en vivo, `/api/` devuelve 200 **sin ninguna cabecera
`Access-Control-Allow-Origin`**. Una web estática **no puede llamarlo desde el
navegador**. Necesita proxy sí o sí.

**No hay endpoint de búsqueda** en `/api/` (devuelve 404 en todas las variantes).
La búsqueda va contra **Algolia** con credenciales públicas incrustadas en la web
de Mercadona, y esa **sí responde `Access-Control-Allow-Origin: *`** → llamable
directo desde el navegador.

⚠️ Pero Mercadona Tech anunció en 2026 que **ha sustituido Algolia por un buscador
propio** (bajaron el coste un 94 %). Las credenciales siguen respondiendo hoy,
pero es infraestructura en retirada, y el App ID ha rotado históricamente. **No lo
hardcodees** sin plan B.

**Riesgo real que debes conocer:**
- El `robots.txt` de Mercadona **prohíbe explícitamente `/api`**.
- Hay **Akamai Bot Manager activo** (cookies `_abck`, `bm_sz`, script sensor
  ofuscado). El tráfico automatizado de volumen **será detectado y bloqueado**,
  posiblemente sin aviso.
- Para dos personas con caché agresiva el riesgo práctico es bajísimo, pero no es
  "legal por defecto": es tolerado mientras seas invisible.

> **Arquitectura adoptada:** no llamar a Mercadona en tiempo real. Un **job
> nocturno** (GitHub Action, 1×/día) recorre el catálogo de `vlc1` y vuelca un
> **JSON estático** (~4.000 productos). La app lo carga y hace **búsqueda local**
> con Fuse.js. Cero llamadas en runtime, cero CORS, cero riesgo de bloqueo.
>
> Regalo inesperado: comparando los snapshots día a día tenéis **histórico de
> precios gratis**. "La leche ha subido 8 céntimos" es una feature preciosa para
> una app de pareja, y no la teníamos en el plan.

**Campo clave del JSON:** `price_instructions.bulk_price` + `reference_format`
son el "€/L" o "€/kg" que sale en la ficha. Y `previous_unit_price` distinto de
`null` significa que el precio ha cambiado → tachado y badge de bajada.

**Detalles de UX de la app de Mercadona que vamos a copiar:**
- Tarjeta: foto cuadrada grande → nombre → formato → **precio grande** → €/kg
  pequeño debajo → stepper `− 1 +`.
- **Al marcar un producto como comprado, no desaparece: se mueve a una sección
  "Comprados" al final de la lista.** Este es *el* detalle que hace que su app
  guste tanto. Lo copiamos tal cual.
- Se puede añadir cualquier cosa a la lista sin clasificarla; la app la agrupa
  sola por sección del súper, que es el orden en que recorres el lineal.

### 9.2 Bancos (Revolut y BBVA) — ❌ la peor noticia

**No hay forma de que un particular lea su saldo automáticamente.** No es una
limitación técnica que se pueda sortear: es regulatoria.

- **Revolut**: la API Business es solo para cuentas Business de pago. Textual de
  su documentación: *"There's no public API for personal Revolut accounts."* La
  API de Open Banking exige ser **TPP regulado bajo PSD2** (licencia AISP) o
  partner aprobado caso a caso.
- **BBVA**: sus endpoints PSD2 están en el hub de **Redsys**, y producción exige
  **certificado eIDAS QWAC + QSEAL**, que **solo se emite a personas jurídicas**
  (~500-1.500 €/año) y requiere estar registrado ante el Banco de España.
- **PSD3 / FIDA** siguen en tramitación y **no van a abrir esto a particulares**:
  el modelo sigue basado en entidades autorizadas.
- **GoCardless / Nordigen**, que era la vía gratuita clásica, está **cerrado a
  nuevos registros y en fase de cierre**. Todo tutorial que lo recomiende está
  obsoleto.

**La única vía real:** **Enable Banking** tiene un tier gratuito de "producción
restringida" en el que enlazas **tus propias cuentas** y ellos actúan como el AISP
autorizado. Pero: exige clave privada RSA (→ backend obligatorio), los bancos
limitan a ~4 refrescos/día, y **PSD2 obliga a re-autenticarse con el banco cada 90
días**. No es "conéctalo y olvídate".

> **Recomendación:** para una app de pareja, **no montéis open banking**. El
> coste/beneficio es malo. En su lugar:
> 1. **Gastos manuales compartidos** (estilo Splitwise). El 90 % del valor, el 0 %
>    del dolor.
> 2. **Importar CSV**: tanto Revolut como BBVA permiten exportar extractos. Un
>    arrastrar-y-soltar que parsea el CSV **en el propio navegador, sin servidor**
>    os da los gráficos de gasto sin ninguna API.
>
> Si algún día queréis automatizarlo de verdad, Enable Banking con un cron en el
> Worker. Queda documentado, pero no es para v1.

### 9.3 Spotify — ⚠️ sirve, pero léete esto antes

Es la API que más ha cambiado, y **toda la información de 2024-2025 que circula
está desactualizada**. Cambios de **febrero de 2026**:

1. 🚨 **El dueño de la app debe tener Spotify Premium activo.** Si la suscripción
   caduca, **la app deja de funcionar**. Es la condición más dura.
2. Development mode baja de 25 a **5 usuarios**. Para vosotros dos, sobra.
3. Se eliminan los endpoints de lectura en lote (`GET /tracks`, `/albums`…) → hay
   que pedirlos de uno en uno.
4. `search` baja su `limit` máximo de 50 a **10**.
5. Los endpoints de playlist pasan de `/tracks` a **`/items`**.

**Lo que sí sigue funcionando, que es justo lo que necesitáis:** playlists
colaborativas y "sonando ahora".

**Lo que está muerto desde noviembre de 2024, sin vuelta atrás:** `audio-features`,
`audio-analysis`, `recommendations`, `related-artists` y las playlists editoriales
de Spotify. Si se te ocurría "analizar la energía de nuestras canciones",
descártalo ya. No hay lista de espera ni promesa de reapertura.

**Buena noticia:** el flujo **PKCE funciona 100 % desde el navegador sin backend**
— verificado en vivo, `accounts.spotify.com/api/token` refleja el origin y
`api.spotify.com` responde `Access-Control-Allow-Origin: *`. Es la única
integración externa que funcionará ya en la fase de GitHub Pages.

Scopes: `playlist-read-collaborative`, `playlist-read-private`,
`user-read-currently-playing`, `user-read-playback-state`.

⚠️ **Antes de registrar la app, decidid quién de los dos tiene el Premium más
estable** — esa debe ser la cuenta propietaria.

**Extended Quota está fuera de alcance**: desde mayo de 2025 exige empresa
registrada y **250.000 usuarios activos mensuales** mínimo. Da igual, con 5 os
sobra.

### 9.4 Globo terráqueo — ✅ sin problemas

Todo gratis, licencias MIT/BSD, sin API keys.

> **Elección: `react-globe.gl`** (MIT). Es literalmente el caso de uso que
> resuelve: `arcsData` con `startLat/startLng/endLat/endLng` para las líneas desde
> Valencia, `pointsData` para las chinchetas, texturas de Tierra incluidas y
> controles de rotación. Arrastra three.js (~600 kB), lo cual da igual aquí.

Alternativa considerada: **cobe** pesa 5 kB y es precioso, pero **solo dibuja
marcadores, no arcos** — y los arcos son media gracia de la app.

**Geocodificación:** en vez de llamar a una API, empaquetamos el dataset
**GeoNames `cities15000`** (~25.000 ciudades de más de 15.000 habitantes,
licencia CC-BY, ~400 kB filtrado y comprimido) y buscamos en local con Fuse.js.
Cero llamadas, cero límites, funciona offline, instantáneo.

⚠️ Nota por si alguna vez te tienta Nominatim: **prohíbe explícitamente el
autocompletado según escribes**. Si hiciera falta búsqueda en vivo, la opción
correcta es **Photon** (CORS abierto, diseñado para autocompletar).

Para la textura del globo usamos **NASA Blue Marble** (dominio público)
empaquetada, así que no hace falta ningún proveedor de tiles.

### 9.5 Pasos y paseos de Nilo — ❌ hay que rediseñarlo

**No se puede contar pasos de forma fiable desde una web.** Sin excepciones:

- **Apple Health / HealthKit**: no existe ninguna API web. Solo nativo.
- **Google Health Connect**: solo SDK nativo de Android. **No hay puente web.**
- **Google Fit REST API**: deprecada, soporte hasta finales de 2026.
- **Contar con la pantalla apagada**: imposible. El conteo real lo hace un
  **coprocesador de bajo consumo** del móvil al que la web no tiene acceso.

Lo que sí se puede: `DeviceMotion` + `Geolocation.watchPosition()` + **Screen Wake
Lock**, todo con la **app abierta y la pantalla encendida**.

⚠️ Trampa de depuración: en iOS, si no pides `DeviceMotionEvent.requestPermission()`
**desde un click**, Safari no da error — simplemente emite ceros en silencio.

> **Rediseño adoptado: "Modo paseo" explícito.** Pulsáis "Empezar paseo" al salir
> con Nilo, la pantalla se mantiene encendida, y al volver tenéis **ruta dibujada
> en el mapa, distancia y duración**. Los pasos quedan como estimación secundaria,
> claramente etiquetada como aproximada.
>
> Como *feature de pareja* ("nuestros paseos con Nilo", con su mapa) es más bonita
> que un contador de pasos, y sobre todo es honesta sobre sus límites. Un contador
> pasivo mediocre, cuyos números no cuadran con los del móvil, se sentiría roto.
>
> **Si queréis los pasos reales:** un **Atajo de iOS** que lee los pasos de Health
> y hace un POST a la app. Diez minutos de configuración y precisión perfecta,
> porque viene del coprocesador. En Android, MacroDroid o Tasker hacen lo mismo.

### 9.6 Notificaciones push — ⚠️ requiere servidor

**Este es el caso más claro de "aquí hace falta backend" de todo el proyecto.**

Una notificación push de verdad (Web Push) necesita tres cosas que un sitio
estático no puede dar:

1. Un **service worker** que reciba el mensaje. Esto sí lo puede hacer Pages.
2. Un sitio donde **guardar la suscripción** de cada móvil.
3. Un servidor que **firme el envío con claves VAPID** — y la clave privada no
   puede estar en el navegador, porque cualquiera podría mandaros avisos.

Además, en iOS las push **sólo funcionan si la app está instalada en la pantalla
de inicio**, nunca desde Safari.

**Solución provisional adoptada: ntfy.sh.** Se publica en un "tema" y quien esté
suscrito recibe la notificación. Sin cuenta, sin clave, sin servidor propio, y
con CORS abierto (comprobado el 22/07/2026). Los dos necesitan la **app ntfy**
instalada y suscrita al canal.

```
POST https://ntfy.sh/<tema>          → enviar
GET  https://ntfy.sh/<tema>/json?poll=1&since=12h  → historial reciente
```

⚠️ **Un tema de ntfy es público para quien sepa su nombre.** No hay contraseña:
la privacidad depende de que nadie lo adivine. Vale para "estoy agobiada, ven";
no vale para nada delicado. Y ntfy sólo guarda los mensajes ~12 h, así que el
archivo permanente se lleva aparte en el dispositivo.

**Al migrar** esto se sustituye por Web Push con VAPID desde el Worker, y el
canal deja de ser adivinable. Ver `MIGRACION-BACKEND.md` §12.2.

### 9.7 Las tres reglas que salen de todo esto

1. **Precomputar en build-time todo lo que se pueda.** Catálogo de Mercadona y
   dataset de ciudades. Convierte tres problemas de API en cero problemas.
2. **Solo hace falta un endpoint de servidor**: el proxy de Mercadona. Un
   Cloudflare Worker gratuito basta. No montar infraestructura para más.
3. **Ser honesto con lo que no se puede hacer** y rediseñar la feature, en vez de
   entregar una versión mediocre que se sienta rota.

---

## 10. Roadmap

| Fase | Contenido | Estado |
|---|---|---|
| **0** | Esqueleto Vite + tokens de diseño + pantalla de inicio + registry | 🚧 En curso |
| **1** | Las 12 apps navegables con datos de ejemplo · reordenar iconos · PWA | ⬜ |
| **2** | Iconos reales en WebP · sonidos · pasaportes con vuestras fotos | ⬜ |
| **3** | Migración a Cloudflare Workers · TOTP · D1 · datos reales | ⬜ |
| **4** | Fotos y archivos en R2 | ⬜ |
| **5** | Integraciones externas (Spotify, Mercadona, bancos) | ⬜ |
| **6** | LLM | ⬜ |

---

## 11. Licencias y aviso legal

- **Animal Crossing, Nookófono, Nook Inc. y Dodo Airlines son marcas de
  Nintendo.** Este es un proyecto privado, sin ánimo de lucro y sin distribución
  pública de assets del juego. Como *homenaje de uso personal* no hay problema;
  como producto publicado, sí lo habría.
- Los **sets de iconos fan** que circulan (`@okpng`, `MarkNickerson/NookPhoneIcons`)
  están marcados explícitamente como **"personal use only"**. Válidos para
  vosotros dos; no redistribuibles.
- **Fuentes**: Fredoka, Nunito y Varela Round están bajo SIL Open Font License,
  válidas para cualquier uso.
- **Sonidos**: Kenney, CC0, sin atribución requerida.
- **Iconos libres de repuesto**, por si quieres completar el set: Phosphor Icons
  (MIT, tiene peso `fill` que encaja perfecto con el estilo grueso), Iconoir (MIT),
  Lucide (ISC).
- ⚠️ `guokaigdg/animal-island-ui` es una librería React con estética AC muy útil
  como referencia, pero está bajo **CC BY-NC 4.0**: uso comercial prohibido. Se
  puede mirar, no copiar a un producto.

### Fuentes de la investigación

**Estilo:** `github.com/IdreesInc/NookPhone` · `fontsinuse.com/uses/51354` ·
`game8.co` (apps del NookPhone, pasaporte) · `gameuidatabase.com/gameData.php?id=606` ·
`interfaceingame.com/games/animal-crossing-new-horizons/` · `kenney.nl/assets/ui-audio`

**Stack:** `developers.cloudflare.com` (Workers, D1, R2, Durable Objects) ·
`supabase.com/docs/guides/platform/free-project-pausing` ·
`docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits` ·
`vercel.com/docs/plans/hobby` · `feature-sliced.design` ·
`tanstack.com/query/v5/docs` · documentación de PWA en iOS

> **Consejo:** para afinar los colores definitivos, abre Game UI Database e
> Interface In Game en el navegador y usa un cuentagotas sobre las capturas
> reales. Es la única forma de convertir los valores marcados **[I]** en valores
> exactos.
