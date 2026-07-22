import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { PAGE_SIZE, dockApps, type MiniAppManifest } from "./apps/registry";
import { useAppOrder } from "./shared/lib/use-app-order";
import { useBattery } from "./shared/lib/use-battery";
import { useClock } from "./shared/lib/use-clock";

/** Cuánto hay que mantener pulsado para entrar en modo edición. */
const LONG_PRESS_MS = 3000;

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
function batteryLevelClass(level: number): "full" | "half" | "empty" {
  if (level > 66) return "full";
  if (level > 25) return "half";
  return "empty";
}

function StatusBar() {
  const time = useClock();
  const battery = useBattery();
  const step = battery.supported ? batteryLevelClass(battery.level) : "empty";
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
  const timer = useRef<number>(0);
  const fired = useRef(false);

  function start() {
    fired.current = false;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function cancel() {
    window.clearTimeout(timer.current);
  }

  useEffect(() => cancel, []);

  return (
    <button
      type="button"
      className="nk-app"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      // Si la pulsación larga ya ha disparado, el tap no debe abrir la app.
      onClick={() => !fired.current && onOpen(app)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={app.title}
    >
      <AppArt app={app} />
      {showLabel && <span className="nk-app__label">{app.title}</span>}
    </button>
  );
}

/** Icono en modo edición: tiembla y se puede arrastrar. */
function SortableAppIcon({ app, index }: { app: MiniAppManifest; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: app.id });

  return (
    <div
      ref={setNodeRef}
      className={`nk-app nk-app--wiggle${isDragging ? " nk-app--dragging" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Desfase por icono para que no tiemblen todos a la vez: sin esto
        // el efecto parece un parpadeo, no un temblor.
        animationDelay: `${(index % 7) * -0.13}s`,
        animationDuration: `${0.32 + (index % 3) * 0.03}s`,
      }}
      {...attributes}
      {...listeners}
    >
      <AppArt app={app} />
      <span className="nk-app__label">{app.title}</span>
    </div>
  );
}

/* -------------------------------------------------------------------- home */

function HomeScreen({ onOpen }: { onOpen: (a: MiniAppManifest) => void }) {
  const { apps, order, move } = useAppOrder();
  const [editing, setEditing] = useState(false);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const pages: MiniAppManifest[][] = [];
  for (let i = 0; i < apps.length; i += PAGE_SIZE) {
    pages.push(apps.slice(i, i + PAGE_SIZE));
  }

  const sensors = useSensors(
    // En modo edición ya no hace falta esperar: basta un pequeño desplazamiento
    // para distinguir arrastre de toque.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 8 } }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) move(String(active.id), String(over.id));
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

  const grid = (
    <div className="nk-pages" ref={pagesRef} onScroll={handleScroll}>
      {pages.map((pageApps, i) => (
        <div className="nk-page" key={i}>
          {pageApps.map((app) =>
            editing ? (
              <SortableAppIcon key={app.id} app={app} index={apps.indexOf(app)} />
            ) : (
              <AppIcon
                key={app.id}
                app={app}
                onOpen={onOpen}
                onLongPress={() => setEditing(true)}
              />
            ),
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {editing && (
        <div className="nk-editbar">
          <span className="nk-editbar__hint">Arrastra los iconos para colocarlos</span>
          <button type="button" className="nk-btn nk-btn--sm" onClick={() => setEditing(false)}>
            Hecho
          </button>
        </div>
      )}

      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            {grid}
          </SortableContext>
        </DndContext>
      ) : (
        grid
      )}

      <div className="nk-sea" onPointerDown={() => editing && setEditing(false)}>
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

        <div className="nk-dock">
          {dockApps.map((app) => (
            <AppIcon
              key={app.id}
              app={app}
              showLabel={false}
              onOpen={onOpen}
              onLongPress={() => setEditing(true)}
            />
          ))}
        </div>
      </div>
    </>
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
  const [open, setOpen] = useState<MiniAppManifest | null>(null);

  return (
    <main className="nk-phone">
      <StatusBar />
      {open ? (
        <AppView app={open} onBack={() => setOpen(null)} />
      ) : (
        <HomeScreen onOpen={setOpen} />
      )}
    </main>
  );
}
