import { useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import LockScreen from "./app/LockScreen";
import { isWidget, paginate, type HomeItem } from "./apps/home-items";
import { enabledApps, type MiniAppManifest } from "./apps/registry";
import type { WidgetManifest } from "./apps/widgets";
import { useAppOrder } from "./shared/lib/use-app-order";
import { useDock } from "./shared/lib/use-dock";
import { useLongPress } from "./shared/lib/use-long-press";
import { useBattery } from "./shared/lib/use-battery";
import { useClock } from "./shared/lib/use-clock";
import { usePhotos, useRotatingPhoto } from "./shared/lib/use-photos";
import { useTimeOfDay } from "./shared/lib/use-time-of-day";
import { wallpapers } from "./app/wallpapers";

/** Cuánto hay que mantener pulsado para entrar en modo edición. */
const LONG_PRESS_MS = 3000;

/**
 * Una app del dock también está en la rejilla, así que aparecería dos veces
 * con el mismo id y dnd-kit los confundiría. Se prefijan los del dock.
 */
const DOCK_PREFIX = "dock:";
const DOCK_ZONE = "dock-zone";

/* ---------------------------------------------------------------- iconos
   Pictogramas de la barra de estado. Son SVG mínimos a propósito: la barra
   debe leerse como decorado, no competir con los iconos de las apps.       */

function SignalIcon() {
  return (
    <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor" aria-hidden="true">
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="4.5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="9" y="3" width="3" height="9" rx="1" opacity="0.3" />
      <rect x="13.5" y="0" width="3" height="12" rx="1" opacity="0.3" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="15" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
      <path
        d="M1 4.2a10.5 10.5 0 0 1 14 0M3.6 7a6.8 6.8 0 0 1 8.8 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="8" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M12.4 8.9A5.8 5.8 0 0 1 5.1 1.6a5.8 5.8 0 1 0 7.3 7.3Z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="9" height="12" viewBox="0 0 9 12" fill="currentColor" aria-hidden="true">
      <path d="M5.2 0 0 6.8h3L3.8 12 9 5.2H6L5.2 0Z" />
    </svg>
  );
}

/* ------------------------------------------------------------ barra de estado */

/** Tres tramos, como los iconos clásicos de pila: llena, media o vacía. */
function batteryStep(level: number): "full" | "half" | "empty" {
  if (level > 66) return "full";
  if (level > 25) return "half";
  return "empty";
}

function StatusBar() {
  const time = useClock();
  const battery = useBattery();
  const step = battery.supported ? batteryStep(battery.level) : "empty";
  const fill = step === "full" ? "100%" : step === "half" ? "50%" : "0%";

  return (
    <div className="nk-statusbar">
      <span className="nk-statusbar__left">
        <SignalIcon />
        <span>Pug Inc.</span>
        <WifiIcon />
      </span>

      <span className="nk-statusbar__time">{time}</span>

      <span className="nk-statusbar__right">
        <MoonIcon />
        {battery.charging && <BoltIcon />}
        {battery.supported && <span>{battery.level} %</span>}
        <span
          className={`nk-battery nk-battery--${step}`}
          title={
            battery.supported
              ? `Batería al ${battery.level} %`
              : "Este navegador no expone el nivel de batería"
          }
        >
          <span className="nk-battery__fill" style={{ width: fill }} />
        </span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------- iconos */

function AppArt({ app, size }: { app: MiniAppManifest; size?: number }) {
  return (
    <span className="nk-app__icon" style={{ width: size }}>
      <img src={app.iconSrc} alt="" loading="lazy" decoding="async" draggable={false} />
    </span>
  );
}

/** Icono normal: pulsación larga para entrar en modo edición, tap para abrir. */
function AppIcon({
  app,
  showLabel = true,
  onOpen,
  onLongPress,
}: {
  app: MiniAppManifest;
  showLabel?: boolean;
  onOpen: (a: MiniAppManifest) => void;
  onLongPress: () => void;
}) {
  const { handlers, firedRef } = useLongPress(onLongPress, LONG_PRESS_MS);

  return (
    <button
      type="button"
      className="nk-app"
      {...handlers}
      // Si la pulsación larga ya ha disparado, el tap no debe abrir la app.
      onClick={() => !firedRef.current && onOpen(app)}
      aria-label={app.title}
    >
      <AppArt app={app} />
      {showLabel && <span className="nk-app__label">{app.title}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ widgets */

function PhotoWidget({ widget, seed }: { widget: WidgetManifest; seed: number }) {
  const photos = usePhotos();
  const photo = useRotatingPhoto(photos, seed);

  return (
    <div className="nk-widget__frame">
      {photo ? (
        <img src={photo} alt="" loading="lazy" decoding="async" draggable={false} />
      ) : (
        <div className="nk-widget__empty">
          <strong>Sin fotos</strong>
          <span>Deja imágenes en src/assets/photos/</span>
        </div>
      )}
      {widget.label && <span className="nk-widget__badge">{widget.label}</span>}
    </div>
  );
}

function Widget({
  widget,
  seed,
  onOpenPhotos,
  onLongPress,
}: {
  widget: WidgetManifest;
  seed: number;
  onOpenPhotos: () => void;
  onLongPress: () => void;
}) {
  const { handlers, firedRef } = useLongPress(onLongPress, LONG_PRESS_MS);

  return (
    <div
      className="nk-widget"
      role="button"
      tabIndex={0}
      {...handlers}
      onClick={() => !firedRef.current && onOpenPhotos()}
      onKeyDown={(e) => e.key === "Enter" && onOpenPhotos()}
    >
      <PhotoWidget widget={widget} seed={seed} />
      <span className="nk-app__label">{widget.label}</span>
    </div>
  );
}

/* ------------------------------------------------- elementos en modo edición */

/** Icono del dock arrastrable. Sin etiqueta, como el resto del dock. */
function SortableDockIcon({ app, index }: { app: MiniAppManifest; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: DOCK_PREFIX + app.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`nk-app nk-sortable nk-sortable--wiggle${
        isDragging ? " nk-sortable--dragging" : ""
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        animationDelay: `${(index % 4) * -0.17}s`,
      }}
      {...attributes}
      {...listeners}
    >
      <AppArt app={app} />
    </div>
  );
}

/* -------------------------------------------------- elemento en modo edición */

function SortableItem({ item, index }: { item: HomeItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const widget = isWidget(item);

  return (
    <div
      ref={setNodeRef}
      className={[
        widget ? "nk-widget" : "nk-app",
        "nk-sortable nk-sortable--wiggle",
        isDragging ? "nk-sortable--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Desfase por elemento para que no tiemblen todos a la vez: sin esto
        // el efecto parece un parpadeo, no un temblor.
        animationDelay: `${(index % 7) * -0.13}s`,
        animationDuration: `${0.32 + (index % 3) * 0.03}s`,
      }}
      {...attributes}
      {...listeners}
    >
      {widget ? <PhotoWidget widget={item} seed={index} /> : <AppArt app={item} />}
      <span className="nk-app__label">{widget ? item.label : item.title}</span>
    </div>
  );
}

/* -------------------------------------------------------------------- home */

function HomeScreen({ onOpen }: { onOpen: (a: MiniAppManifest) => void }) {
  const { items, order, move } = useAppOrder();
  const dock = useDock();
  const [editing, setEditing] = useState(false);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const pages = paginate(items);

  const sensors = useSensors(
    // En modo edición ya no hace falta esperar: basta un pequeño desplazamiento
    // para distinguir arrastre de toque.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 8 } }),
  );

  /**
   * Cuatro casos, según de dónde sale el elemento y dónde cae:
   * dock→dock reordena, rejilla→dock lo mete (y saca a otro, porque los huecos
   * son fijos), dock→rejilla lo quita del dock, y rejilla→rejilla reordena.
   */
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const from = String(active.id);
    const to = String(over.id);
    const fromDock = from.startsWith(DOCK_PREFIX);
    const toDock = to.startsWith(DOCK_PREFIX) || to === DOCK_ZONE;

    const appId = fromDock ? from.slice(DOCK_PREFIX.length) : from;
    const overId = to.startsWith(DOCK_PREFIX) ? to.slice(DOCK_PREFIX.length) : undefined;

    if (fromDock && toDock) return dock.move(appId, overId!);
    if (fromDock) return dock.remove(appId);

    if (toDock) {
      // Un widget ocupa cuatro celdas: no cabe en un hueco del dock.
      if (isWidget(items.find((i) => i.id === appId)!)) return;
      return dock.insert(appId, overId);
    }

    move(from, to);
  }

  function handleScroll() {
    const el = pagesRef.current;
    if (!el) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(index: number) {
    const el = pagesRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  /** Tocar un widget de fotos abre la app Fotos. */
  function openPhotos() {
    const target = enabledApps.find((a) => a.id === "photos");
    if (target) onOpen(target);
  }

  /** Tocar cualquier hueco que no sea un icono o un widget sale del modo edición. */
  function handleBackgroundTap(e: React.PointerEvent) {
    if (!editing) return;
    if (!(e.target as HTMLElement).closest(".nk-app, .nk-widget")) setEditing(false);
  }

  const grid = (
    <div
      className="nk-pages"
      ref={pagesRef}
      onScroll={handleScroll}
      onPointerDown={handleBackgroundTap}
    >
      {pages.map((pageItems, i) => (
        <div className="nk-page" key={i}>
          {pageItems.map((item) => {
            const index = items.indexOf(item);
            if (editing) return <SortableItem key={item.id} item={item} index={index} />;
            return isWidget(item) ? (
              <Widget
                key={item.id}
                widget={item}
                seed={index}
                onOpenPhotos={openPhotos}
                onLongPress={() => setEditing(true)}
              />
            ) : (
              <AppIcon
                key={item.id}
                app={item}
                onOpen={onOpen}
                onLongPress={() => setEditing(true)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );

  const sea = (
    <div className="nk-sea" onPointerDown={handleBackgroundTap}>
        <svg
          className="nk-sea__wave"
          viewBox="0 0 430 26"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 26V10c36-13 74-13 110 0s74 13 110 0 74-13 110 0 74 13 100 3v13Z" />
        </svg>

        <div className="nk-dots">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              className="nk-dot"
              aria-current={i === page}
              aria-label={`Página ${i + 1}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

      <Dock
        apps={dock.apps}
        editing={editing}
        onOpen={onOpen}
        onLongPress={() => setEditing(true)}
      />
    </div>
  );

  if (!editing) {
    return (
      <>
        {grid}
        {sea}
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
      <SortableContext
        items={dock.ids.map((id) => DOCK_PREFIX + id)}
        strategy={rectSortingStrategy}
      >
        {sea}
      </SortableContext>
    </DndContext>
  );
}

/** Barra fija inferior. En modo edición es también zona de destino. */
function Dock({
  apps,
  editing,
  onOpen,
  onLongPress,
}: {
  apps: MiniAppManifest[];
  editing: boolean;
  onOpen: (a: MiniAppManifest) => void;
  onLongPress: () => void;
}) {
  // Permite soltar en el dock aunque esté vacío o se apunte a un hueco libre.
  const { setNodeRef, isOver } = useDroppable({ id: DOCK_ZONE, disabled: !editing });

  return (
    <div
      ref={setNodeRef}
      className={`nk-dock${editing ? " nk-dock--editing" : ""}${isOver ? " nk-dock--over" : ""}`}
    >
      {apps.map((app, i) =>
        editing ? (
          <SortableDockIcon key={app.id} app={app} index={i} />
        ) : (
          <AppIcon
            key={app.id}
            app={app}
            showLabel={false}
            onOpen={onOpen}
            onLongPress={onLongPress}
          />
        ),
      )}
    </div>
  );
}

/* --------------------------------------------------------------- vista app */

function AppView({ app, onBack }: { app: MiniAppManifest; onBack: () => void }) {
  return (
    <div className="nk-view">
      <div className="nk-view__head">
        <button type="button" className="nk-btn" onClick={onBack}>
          ‹ Inicio
        </button>
        <h1 className="nk-view__title">{app.title}</h1>
      </div>

      <div style={{ display: "grid", placeItems: "center", gap: 28 }}>
        <AppArt app={app} size={104} />

        <div className="nk-dialogue">
          <p style={{ margin: 0, fontWeight: 700 }}>{app.teaser}</p>
          <p style={{ margin: "10px 0 0", fontSize: "0.85rem", opacity: 0.75 }}>
            Todavía no está construida.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [locked, setLocked] = useState(true);
  const [open, setOpen] = useState<MiniAppManifest | null>(null);
  const phase = useTimeOfDay();

  // El fondo de inicio va en la carcasa, no en la rejilla, para que la ola del
  // mar pueda dibujarse entre el fondo y los iconos.
  const homeWallpaper = !locked && !open ? wallpapers[phase].home : null;

  return (
    <main
      className={`nk-phone${locked ? " nk-phone--locked" : ""}`}
      data-theme={phase}
      style={homeWallpaper ? { backgroundImage: `url(${homeWallpaper})` } : undefined}
    >
      {locked ? (
        <LockScreen onUnlock={() => setLocked(false)} phase={phase} />
      ) : (
        <>
          <StatusBar />
          {open ? (
            <AppView app={open} onBack={() => setOpen(null)} />
          ) : (
            <HomeScreen onOpen={setOpen} />
          )}
        </>
      )}
    </main>
  );
}
