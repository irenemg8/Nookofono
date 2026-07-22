# iPug — DESIGN.md

> **Contrato de estilo. De obligado cumplimiento.**
>
> Este documento **no propone** un estilo nuevo: describe el que ya existe en
> `src/app/styles/`. Toda pantalla nueva se escribe con estas piezas. Si algo que
> necesitas no está aquí, **no lo inventes**: mira cómo lo resuelve una app ya
> construida (`notes`, `calendar`, `nilo`, `weather`, `sos`, `profile`,
> `airlines`, `music`, `advice`) y sigue ese patrón.
>
> Fuente de verdad de los valores: `src/app/styles/tokens.css` y
> `src/app/styles/global.css`. Este fichero explica **cuándo** usar cada cosa.
> Ver también `PROYECTO.md` §3.

---

## 0. Las diez reglas que no se rompen

1. **Nunca emojis en la interfaz.** Ni como icono, ni como viñeta, ni como
   decoración. Los iconos son ilustraciones WebP (`src/assets/*.webp`) o SVG
   inline dibujados a mano, como los de la barra de estado en `App.tsx`.
2. **Nunca colores a pelo.** Siempre `var(--nk-*)`. Si un color no existe como
   token, no se usa. Única excepción tolerada: el rojo de peligro `#e2504a`, que
   ya está repetido en `global.css`.
3. **Ninguna sombra es gris neutro.** Siempre teñida de marrón:
   `rgba(72, 32, 22, …)` o `var(--nk-shadow-strong)`. Es lo que da la calidez de
   Animal Crossing; con negro puro el resultado se vuelve frío al instante.
4. **Los iconos son squircles, no círculos.** `border-radius: 24%` (rejilla) o
   `28%` (`--nk-radius-icon`). Un círculo rompe la referencia de iOS.
5. **Los botones son de goma.** Grosor inferior con `box-shadow` sólido y
   hundido al pulsar. Nunca un botón plano. Ver §3.1.
6. **Nada de `font-size` menor de 16px en `input`, `textarea` o `select`.** iOS
   hace zoom automático al enfocar y descoloca la pantalla entera.
7. **Todo texto de interfaz, en español.** El código, en inglés. Sin mezclar.
8. **Toda animación se apaga con `prefers-reduced-motion`.** Sin excepción.
9. **Mobile-first, lienzo de 430px.** `.nk-phone` es `min(100%, 430px)`. No se
   diseña para escritorio: en pantalla ancha se dibuja el móvil centrado.
10. **Toda acción destructiva pasa por `ConfirmDialog`.** Nunca se borra al tap.

---

## 1. Tokens

Definidos en `src/app/styles/tokens.css`. **No se redefinen en el CSS de una
mini-app**: se consumen.

### 1.1 Superficies y playa

| Token | Valor | Cuándo |
|---|---|---|
| `--nk-sand` | `#f3eee0` | Fondo de la rejilla (la arena) |
| `--nk-sea` | `#8fbfbd` | Franja del mar bajo la ola |
| `--nk-sea-deep` | `#74a9a7` | Fondo del dock |
| `--nk-bg-cream` | `#fdf8e3` | Paneles, burbujas, modales |
| `--nk-surface` | `#fffdf2` | Tarjetas elevadas sobre crema |
| `--nk-surface-sunk` | `#f3ebcf` | Campos hundidos, filas alternas, chips |
| `--nk-border` | `#e0daca` | Bordes suaves y grosor de botón fantasma |

### 1.2 Texto

| Token | Valor | Cuándo |
|---|---|---|
| `--nk-text-strong` | `#482016` | Titulares y etiquetas de icono |
| `--nk-text` | `#807256` | Cuerpo de texto |
| `--nk-text-muted` | `#a99b7e` | Secundario, vacíos, pistas |

### 1.3 Marca y acentos

| Token | Valor | Cuándo |
|---|---|---|
| `--nk-leaf` | `#8dc63f` | **Acción primaria.** Fondo de `.nk-btn` |
| `--nk-leaf-dark` | `#4e8c36` | Grosor inferior del botón primario |
| `--nk-nook-green` | `#5dbb63` | Cifras destacadas (hora del bloqueo) |
| `--nk-accent-blue` | `#54d4fc` | Acento frío |
| `--nk-accent-pink` | `#fdc0c7` | Acento cálido |
| `--nk-accent-yellow` | `#f1ae04` | Avisos, destacados, "millas" |

**Rojo de peligro:** `#e2504a`, con grosor `#b13a35`. Sólo para borrar y para la
batería vacía.

### 1.4 Tema de noche

El atributo `data-theme="night"` cuelga de `.nk-phone` y lo decide
`useTimeOfDay()` (21:00–7:00). **No se escribe CSS de noche a mano**: al usar
tokens, una pantalla nueva ya cambia sola. Verifica siempre tu pantalla en los
dos temas antes de darla por buena.

---

## 2. Tipografía

| Token | Valor |
|---|---|
| `--nk-font` | `"Fredoka", "Varela Round", system-ui, sans-serif` |
| `--nk-font-body` | `"Nunito", system-ui, sans-serif` |

**Regla:** `--nk-font` para titulares, botones, etiquetas y cifras —todo lo que
sea "interfaz"—; `--nk-font-body` para prosa. El `body` ya trae la de cuerpo, así
que en la práctica sólo hay que declarar `--nk-font` donde toque.

Pesos en uso: 500 (etiquetas de icono), 600 (interfaz), 700 (énfasis). **Nunca
800 ni 900**: rompen la redondez de Fredoka.

---

## 3. Componentes

### 3.1 Botón píldora — `.nk-btn`

El componente firma del proyecto. El grosor inferior sólido es lo que lo hace
sentir de goma.

```css
.nk-btn {
  font-family: var(--nk-font);
  font-weight: 600;
  color: #fff;
  background: var(--nk-leaf);
  border: none;
  border-radius: var(--nk-radius-pill);
  padding: 0.55em 1.3em;
  box-shadow: 0 4px 0 var(--nk-leaf-dark), 0 6px 10px var(--nk-shadow);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.nk-btn:active {
  transform: translateY(3px);                              /* se hunde */
  box-shadow: 0 1px 0 var(--nk-leaf-dark), 0 2px 4px var(--nk-shadow);
}
```

Variantes ya existentes: `.nk-btn--ghost` (secundario, crema),
`.nk-btn--danger` (rojo), `.nk-btn--sm` (compacto).

> **Al pulsar, `translateY` y la sombra bajan a la vez.** Si sólo se mueve uno de
> los dos, el botón parece deslizarse en lugar de hundirse.

### 3.2 Burbuja de diálogo — `.nk-dialogue`

Los radios asimétricos están verificados contra el juego. **No los toques.**

```css
border-radius: 40% 40% 30% 30% / 150% 150% 150% 150%;
animation: nk-blob 1.25s ease-in-out infinite alternate;   /* respira */
```

Para mensajes con voz: vacíos con gracia, teasers, lo que "dice" una app.
No para texto informativo largo.

### 3.3 Panel inferior — `.nk-sheet`

Menú que sube desde abajo (el de widgets). Fondo `rgba(40,24,16,.45)` con
`backdrop-filter: blur(3px)`, panel crema con esquinas superiores de 26px y
entrada `nk-rise` con `cubic-bezier(.32,.72,0,1)`.

**Cierra al tocar fuera**, y el panel para la propagación:
```tsx
<div className="nk-sheet" onPointerDown={onClose}>
  <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
```

### 3.4 Modal de confirmación — `ConfirmDialog`

`src/shared/ui/ConfirmDialog.tsx`. **Obligatorio antes de cualquier borrado.**
Ya resuelve el foco y el estilo:

```tsx
<ConfirmDialog
  title="¿Borrar esta nota?"
  body={`Se borrará «${nota.title}» y no se podrá recuperar.`}
  confirmLabel="Borrar"
  onConfirm={…}
  onCancel={…}
/>
```

`RemoveBadge` es el botón redondo de quitar en modo edición (`danger` para rojo).

### 3.5 Pestañas — patrón de `notes.css`

Fila de `role="tablist"` con `aria-selected`. La activa se rellena con
`--nk-surface`; el resto queda plano sobre el fondo. Es el patrón para segmentar
por persona (**Compartidas / Irene / Vicente**), que se repite en varias apps.

### 3.6 Estado vacío

Texto breve, en `--nk-text-muted`, centrado, tono humano y en español:
> «Aquí no hay nada todavía.»

Nunca "No hay datos" ni "Sin resultados". Es un móvil de pareja, no un panel de
administración.

---

## 4. Estructura de una mini-app

```
src/apps/<id>/
├─ index.tsx        ← export default, es la pantalla
├─ <id>.css         ← estilos propios, prefijados
├─ model/           ← hooks, tipos, lógica pura
└─ ui/              ← componentes propios de esta app
```

Registro en dos sitios, y ninguno más:
1. `src/apps/registry.ts` → el manifiesto (icono, título, página, dock).
2. `src/apps/screens.ts` → `id: app(() => import("./<id>"))`.

**Una app sin entrada en `screens.ts` muestra sola la burbuja de "todavía no está
construida".** No hay que hacer nada más para dejarla pendiente.

### 4.1 Prefijos CSS

Cada app usa un prefijo corto y propio para no colisionar: `nt-` (notes), `cal-`
(calendar), `nl-` (nilo), `wx-` (weather)… **Las clases `nk-` son globales y
compartidas**: se consumen, no se redefinen.

### 4.2 La cabecera la pone el contenedor

`AppView` en `App.tsx` ya dibuja el botón «‹ Inicio» y el `<h1>` con el título.
**Una mini-app no dibuja su propia cabecera de vuelta.**

---

## 5. Interacción

### 5.1 Pulsación larga

`LONG_PRESS_MS = 3000` (lo pidió Irene). Con `useLongPress()`, que ya devuelve
`firedRef` para anular el `click` posterior:

```tsx
const { handlers, firedRef } = useLongPress(onLongPress, LONG_PRESS_MS);
<button {...handlers} onClick={() => !firedRef.current && abrir()} />
```

### 5.2 Las cuatro trampas del táctil

Documentadas en `PROYECTO.md` §7.1 y ya resueltas en `global.css`. Al crear algo
arrastrable hay que respetarlas:

- `touch-action: none` en lo arrastrable, o el navegador se queda el gesto.
- `-webkit-touch-callout: none` y `pointer-events: none` en los `img`, o iOS abre
  «Guardar imagen» y mata la pulsación larga.
- El temblor va sobre `.nk-app__icon` / `.nk-widget__frame`, **nunca** sobre el
  contenedor: ese lleva el `transform` de dnd-kit y se pisarían.
- Anular el `click` tras disparar la pulsación larga.

### 5.3 Temblor desfasado

Cada elemento lleva su propio `animationDelay` y `animationDuration` según el
índice. **Sin ese desfase el conjunto parpadea en vez de temblar** — es el
detalle que hace creíble el modo edición.

```tsx
animationDelay: `${(index % 7) * -0.04}s`,
animationDuration: `${0.16 + (index % 3) * 0.015}s`,
```

---

## 6. Accesibilidad

- Todo control es `<button type="button">` con `aria-label` si no lleva texto.
- Pestañas con `role="tab"` + `aria-selected`; conmutadores con `aria-pressed`.
- Toque mínimo de 44×44 px.
- Fechas y números con `toLocaleDateString("es-ES")` / `toLocaleString("es-ES")`.
  **Nunca formateo manual.**
- Todo bloque `@keyframes` necesita su `@media (prefers-reduced-motion: reduce)`.

---

## 7. Lista de comprobación antes de dar una pantalla por terminada

- [ ] Cero emojis y cero colores fuera de tokens
- [ ] Se ve bien en 430×932 **y** en 360×640 (móvil pequeño)
- [ ] Se ve bien en tema de día **y** de noche
- [ ] Los botones se hunden al pulsar
- [ ] Los `input` tienen `font-size` ≥ 16px
- [ ] El borrado pide confirmación
- [ ] El estado vacío tiene una frase humana en español
- [ ] Las animaciones se apagan con `prefers-reduced-motion`
- [ ] Registrada en `registry.ts` y en `screens.ts`
- [ ] Consola sin errores ni warnings
