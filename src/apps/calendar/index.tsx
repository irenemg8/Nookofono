import { useMemo, useState } from "react";
import { useCollection, type Entity } from "../../shared/lib/use-collection";
import { useLongPress } from "../../shared/lib/use-long-press";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import {
  MONTHS,
  WEEKDAYS,
  endTime,
  humanDuration,
  longDate,
  monthGrid,
  toKey,
  todayKey,
} from "./model/dates";
import { REPEAT_LABEL, occursOn, type Repeat } from "./model/repeat";
import "./calendar.css";

/** Igual que en la pantalla de inicio, para que el gesto se sienta el mismo. */
const LONG_PRESS_MS = 3000;

type Who = "irene" | "vicente" | "both";

interface CalEvent extends Entity {
  title: string;
  /** `YYYY-MM-DD` en hora local. Primera vez, si se repite. */
  date: string;
  /** `HH:MM`, vacío si dura todo el día. */
  startsAt: string;
  durationMin: number;
  allDay: boolean;
  who: Who;
  notes: string;
  repeat: Repeat;
  /** Última fecha posible. Vacío = sin fin. */
  repeatUntil: string;
}

const WHO_LABEL: Record<Who, string> = {
  irene: "Irene",
  vicente: "Vicente",
  both: "Los dos",
};

const WHO_COLOR: Record<Who, string> = {
  irene: "#e86a92",
  vicente: "#5aa9e6",
  both: "var(--nk-leaf)",
};

const DURATIONS = [30, 60, 90, 120, 180];

export default function CalendarApp() {
  const events = useCollection<CalEvent>("ipug.calendar");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string>(todayKey);
  const [composing, setComposing] = useState<string | null>(null);
  const [pending, setPending] = useState<CalEvent | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => monthGrid(year, month), [year, month]);

  /**
   * Eventos de cada día visible. No basta con agrupar por fecha: uno que se
   * repite aparece en días que no son el suyo, así que hay que preguntar por
   * cada casilla.
   */
  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    const days = new Set(grid.map(toKey));
    days.add(selected);

    for (const key of days) {
      const list = events.items.filter((e) => occursOn(e, key));
      list.sort((a, b) => (a.allDay ? "" : a.startsAt).localeCompare(b.allDay ? "" : b.startsAt));
      if (list.length > 0) map.set(key, list);
    }
    return map;
  }, [events.items, grid, selected]);

  const dayEvents = byDate.get(selected) ?? [];

  function shift(months: number) {
    setCursor(new Date(year, month + months, 1));
  }

  function goToday() {
    setCursor(new Date());
    setSelected(todayKey());
  }

  return (
    <div className="cal">
      <header className="cal-head">
        <h2 className="cal-head__title">
          {MONTHS[month]} {year}
        </h2>

        <div className="cal-head__nav">
          <button type="button" onClick={() => shift(-1)} aria-label="Mes anterior">
            ‹
          </button>
          <button type="button" className="cal-today" onClick={goToday}>
            Hoy
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Mes siguiente">
            ›
          </button>
        </div>
      </header>

      <div className="cal-grid">
        {WEEKDAYS.map((d) => (
          <div className="cal-weekday" key={d}>
            {d}
          </div>
        ))}

        {grid.map((date) => {
          const key = toKey(date);
          return (
            <DayCell
              key={key}
              date={date}
              dateKey={key}
              inMonth={date.getMonth() === month}
              selected={key === selected}
              today={key === todayKey()}
              events={byDate.get(key) ?? []}
              onSelect={() => setSelected(key)}
              onCompose={() => {
                setSelected(key);
                setComposing(key);
              }}
            />
          );
        })}
      </div>

      <section className="cal-day-panel">
        <div className="cal-day-panel__head">
          <h3>{longDate(selected)}</h3>
          <button type="button" className="nk-btn nk-btn--sm" onClick={() => setComposing(selected)}>
            + Evento
          </button>
        </div>

        {dayEvents.length === 0 ? (
          <p className="cal-empty">Nada este día.</p>
        ) : (
          <ul className="cal-list">
            {dayEvents.map((e) => (
              <li key={e.id} className="cal-event">
                <span className="cal-event__bar" style={{ background: WHO_COLOR[e.who] }} />
                <div className="cal-event__body">
                  <div className="cal-event__title">{e.title}</div>
                  <div className="cal-event__meta">
                    {e.allDay
                      ? "Todo el día"
                      : `${e.startsAt} – ${endTime(e.startsAt, e.durationMin)} · ${humanDuration(e.durationMin)}`}
                    {" · "}
                    {WHO_LABEL[e.who]}
                    {e.repeat !== "none" && ` · ${REPEAT_LABEL[e.repeat].toLowerCase()}`}
                  </div>
                  {e.notes && <p className="cal-event__notes">{e.notes}</p>}
                </div>
                <button
                  type="button"
                  className="cal-event__x"
                  onClick={() => setPending(e)}
                  aria-label="Borrar evento"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="cal-hint">Mantén pulsado un día para añadir un evento.</p>
      </section>

      {composing && (
        <EventForm
          date={composing}
          onClose={() => setComposing(null)}
          onSave={(data) => {
            events.create(data);
            setComposing(null);
          }}
        />
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar este evento?"
          body={
            pending.repeat === "none"
              ? `Se borrará «${pending.title}» del ${longDate(pending.date)}.`
              : `«${pending.title}» se repite ${REPEAT_LABEL[pending.repeat].toLowerCase()}. Se borrarán todas sus repeticiones, no sólo la de este día.`
          }
          confirmLabel="Borrar"
          onConfirm={() => {
            events.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- casilla */

function DayCell({
  date,
  dateKey,
  inMonth,
  selected,
  today,
  events,
  onSelect,
  onCompose,
}: {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  selected: boolean;
  today: boolean;
  events: CalEvent[];
  onSelect: () => void;
  onCompose: () => void;
}) {
  const { handlers, firedRef } = useLongPress(onCompose, LONG_PRESS_MS);

  return (
    <button
      type="button"
      className={[
        "cal-day",
        inMonth ? "" : "cal-day--out",
        selected ? "cal-day--on" : "",
        today ? "cal-day--today" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...handlers}
      onClick={() => !firedRef.current && onSelect()}
      aria-label={`${dateKey}, ${events.length} eventos`}
    >
      <span className="cal-day__n">{date.getDate()}</span>

      <span className="cal-dots">
        {/* Tres puntos como mucho: más no se distinguen y ensucian la casilla. */}
        {events.slice(0, 3).map((e) => (
          <span key={e.id} className={`cal-dot cal-dot--${e.who}`} />
        ))}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ formulario */

function EventForm({
  date,
  onClose,
  onSave,
}: {
  date: string;
  onClose: () => void;
  onSave: (data: Omit<CalEvent, keyof Entity>) => void;
}) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("18:00");
  const [durationMin, setDurationMin] = useState(60);
  const [allDay, setAllDay] = useState(false);
  const [who, setWho] = useState<Who>("both");
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [repeatUntil, setRepeatUntil] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      date,
      startsAt,
      durationMin,
      allDay,
      who,
      notes: notes.trim(),
      repeat,
      // Una fecha de fin sin repetición no significa nada: se descarta.
      repeatUntil: repeat === "none" ? "" : repeatUntil,
    });
  }

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>{longDate(date)}</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="cal-form" onSubmit={submit}>
          <label>
            <span>Qué</span>
            <input
              autoFocus
              value={title}
              placeholder="Cena con los de siempre"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="cal-chips">
            {(["irene", "vicente", "both"] as Who[]).map((w) => (
              <button
                key={w}
                type="button"
                className={`cal-chip cal-chip--${w}`}
                aria-pressed={who === w}
                onClick={() => setWho(w)}
              >
                {WHO_LABEL[w]}
              </button>
            ))}
          </div>

          <div className="cal-chips">
            <button
              type="button"
              className="cal-chip"
              aria-pressed={allDay}
              onClick={() => setAllDay((v) => !v)}
            >
              Todo el día
            </button>
          </div>

          {!allDay && (
            <>
              <div className="cal-form__row">
                <label style={{ flex: 1 }}>
                  <span>Empieza</span>
                  <input
                    type="time"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </label>
                <label style={{ flex: 1 }}>
                  <span>Termina</span>
                  <input type="time" value={endTime(startsAt, durationMin)} readOnly />
                </label>
              </div>

              <div className="cal-chips">
                {DURATIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="cal-chip"
                    aria-pressed={durationMin === m}
                    onClick={() => setDurationMin(m)}
                  >
                    {humanDuration(m)}
                  </button>
                ))}
              </div>
            </>
          )}

          <div>
            <span className="cal-form__legend">Se repite</span>
            <div className="cal-chips">
              {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className="cal-chip"
                  aria-pressed={repeat === r}
                  onClick={() => setRepeat(r)}
                >
                  {REPEAT_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {repeat !== "none" && (
            <label>
              <span>Hasta cuándo (opcional)</span>
              <input
                type="date"
                value={repeatUntil}
                min={date}
                onChange={(e) => setRepeatUntil(e.target.value)}
              />
            </label>
          )}

          <label>
            <span>Notas</span>
            <textarea
              rows={2}
              value={notes}
              placeholder="Dónde, con quién…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="cal-form__actions">
            <button type="button" className="nk-btn nk-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="nk-btn">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
