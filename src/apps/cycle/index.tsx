import { useMemo, useState } from "react";
import { notify } from "../../shared/lib/ntfy";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import {
  cyclesFromDays,
  fromKey,
  phaseOf,
  predict,
  todayKey,
  toKey,
  type DateKey,
  type Phase,
} from "./model/predict";
import "./cycle.css";

/* ------------------------------------------------------------------ modelo */

/** Un día suelto de regla. Marcar = crear; desmarcar = borrar. */
interface PeriodDay extends Entity {
  date: DateKey;
}

/** El diario de un día: síntomas, ánimo, flujo, nota. */
interface DayLog extends Entity {
  date: DateKey;
  symptoms: string[];
  moods: string[];
  flow: "" | "ligero" | "medio" | "fuerte";
  note: string;
}

const SYMPTOMS = [
  "Dolor", "Hinchazón", "Cansancio", "Dolor de cabeza", "Náuseas",
  "Antojos", "Acné", "Pecho sensible", "Retortijones", "Sin energía",
];
const MOODS = ["Feliz", "Tranquila", "Irritable", "Triste", "Ansiosa", "Cariñosa"];
const FLOWS = ["ligero", "medio", "fuerte"] as const;

const PHASE_LABEL: Record<Phase, string> = {
  period: "Regla",
  fertile: "Días fértiles",
  ovulation: "Ovulación",
  "predicted-period": "Regla prevista",
  none: "Fase tranquila",
};

const TOPIC = "ipug-belinda-2a9c7e4f1d38";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/* ------------------------------------------------------------------- app */

export default function CycleApp() {
  const me = useCurrentUser();
  const days = useRemoteCollection<PeriodDay>("/api/cycle/days");
  const logs = useRemoteCollection<DayLog>("/api/cycle/logs");

  const daySet = useMemo(() => new Set(days.items.map((d) => d.date)), [days.items]);
  const cycles = useMemo(() => cyclesFromDays(daySet), [daySet]);
  const pred = useMemo(() => predict(cycles), [cycles]);

  const today = todayKey();
  const todayPhase = phaseOf(today, cycles, pred);

  async function togglePeriod(date: DateKey) {
    const existing = days.items.find((d) => d.date === date);
    if (existing) {
      await days.remove(existing.id);
      return;
    }
    const created = await days.create({ date });
    // El aviso a Vicente sólo al marcar HOY como primer día tras una pausa, no
    // cada vez que se toquetea el calendario.
    const isNewStart = date === today && !daySet.has(yesterday(today));
    if (created && isNewStart) {
      await notify({
        topic: TOPIC,
        title: "Belinda",
        body: "A Irene le ha venido la regla. Modo chocolate y mantita activado.",
        priority: "high",
        tags: ["blood", "chocolate_bar"],
      });
    }
  }

  if (days.status === "loading") return <p className="cy-note">Cargando…</p>;

  if (me === "vicente") {
    return <BelindaView phase={todayPhase} pred={pred} />;
  }

  return (
    <IreneView
      logs={logs}
      cycles={cycles}
      daySet={daySet}
      pred={pred}
      today={today}
      phase={todayPhase}
      onTogglePeriod={togglePeriod}
    />
  );
}

/* --------------------------------------------------------------- Vicente */

function BelindaView({ phase, pred }: { phase: Phase; pred: ReturnType<typeof predict> }) {
  const message: Record<Phase, string> = {
    period: "Belinda está muy afectada. Chocolate, mantita y paciencia.",
    fertile: "Belinda anda receptiva… tú sabrás qué hacer con esa info.",
    ovulation: "Día grande de Belinda. Máxima fertilidad.",
    "predicted-period": "A Belinda le toca pronto. Ve preparando el chocolate.",
    none: "Belinda tranquila. Todo en calma por la zona.",
  };

  return (
    <div className="cy">
      <div className="cy-hero">
        <div className="cy-ring">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--nk-surface-sunk)" strokeWidth="8" />
          </svg>
          <div className="cy-ring__center">
            <div className="cy-ring__big">♥</div>
          </div>
        </div>
        <div className={`cy-phase cy-phase--${phase}`}>{PHASE_LABEL[phase]}</div>
        <p className="cy-belinda">{message[phase]}</p>
      </div>

      {pred && (
        <dl className="cy-facts">
          <div className="cy-fact">
            <dt>Próxima regla</dt>
            <dd>
              {pred.regular
                ? prettyDate(pred.nextPeriod)
                : `${shortDate(pred.windowStart)}–${shortDate(pred.windowEnd)}`}
            </dd>
          </div>
          <div className="cy-fact">
            <dt>Días fértiles</dt>
            <dd>
              {shortDate(pred.fertileStart)}–{shortDate(pred.fertileEnd)}
            </dd>
          </div>
        </dl>
      )}

      <p className="cy-note">
        Es una estimación de calendario, no un método anticonceptivo. Sé bueno con Belinda.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- Irene */

function IreneView({
  logs,
  cycles,
  daySet,
  pred,
  today,
  phase,
  onTogglePeriod,
}: {
  logs: ReturnType<typeof useRemoteCollection<DayLog>>;
  cycles: ReturnType<typeof cyclesFromDays>;
  daySet: Set<DateKey>;
  pred: ReturnType<typeof predict>;
  today: DateKey;
  phase: Phase;
  onTogglePeriod: (d: DateKey) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<DateKey | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const logByDate = useMemo(() => {
    const m = new Map<DateKey, DayLog>();
    for (const l of logs.items) m.set(l.date, l);
    return m;
  }, [logs.items]);

  return (
    <div className="cy">
      <div className="cy-hero">
        <Ring phase={phase} pred={pred} today={today} />
        <div className={`cy-phase cy-phase--${phase}`}>{PHASE_LABEL[phase]}</div>
        <p className="cy-belinda">Belinda al día 🌸</p>
      </div>

      <p className="cy-tap-hint">
        Toca un día para marcar la regla. Tócalo otra vez y se quita.
      </p>

      <Calendar
        year={year}
        month={month}
        cycles={cycles}
        daySet={daySet}
        pred={pred}
        today={today}
        logByDate={logByDate}
        onPrev={() => setCursor(new Date(year, month - 1, 1))}
        onNext={() => setCursor(new Date(year, month + 1, 1))}
        onTogglePeriod={onTogglePeriod}
      />

      <div className="cy-log">
        <button type="button" className="nk-btn nk-btn--ghost" onClick={() => setOpenDay(today)}>
          Anotar hoy
        </button>
      </div>

      <div className="cy-legend">
        <span><i style={{ background: "#e2504a" }} /> Regla</span>
        <span><i style={{ background: "#cdeecd" }} /> Fértil</span>
        <span><i style={{ background: "#6bb86f" }} /> Ovulación</span>
        <span><i style={{ background: "#f6d3dd" }} /> Prevista</span>
      </div>

      {pred && (
        <dl className="cy-facts">
          <div className="cy-fact">
            <dt>Próxima regla</dt>
            <dd>
              {pred.regular
                ? prettyDate(pred.nextPeriod)
                : `${shortDate(pred.windowStart)}–${shortDate(pred.windowEnd)}`}
            </dd>
          </div>
          <div className="cy-fact">
            <dt>Ciclo</dt>
            <dd>{pred.regular ? `${pred.avgLength} días` : `${pred.minLength}–${pred.maxLength} días`}</dd>
          </div>
          <div className="cy-fact">
            <dt>Días fértiles</dt>
            <dd>
              {shortDate(pred.fertileStart)}–{shortDate(pred.fertileEnd)}
            </dd>
          </div>
          <div className="cy-fact">
            <dt>Basado en</dt>
            <dd>{pred.basedOn === 0 ? "media típica" : `${pred.basedOn} ciclos`}</dd>
          </div>
        </dl>
      )}

      <p className="cy-note">
        {pred && !pred.regular
          ? "Tu ciclo es irregular, así que la regla y los días fértiles se muestran como un rango, no como días fijos. "
          : ""}
        La ventana fértil es una estimación de calendario, no un método
        anticonceptivo. Cuantas más reglas registres, más afina.
      </p>

      {openDay && (
        <DaySheet
          date={openDay}
          log={logByDate.get(openDay) ?? null}
          isPeriod={daySet.has(openDay)}
          onTogglePeriod={() => onTogglePeriod(openDay)}
          onSave={(patch) => {
            const existing = logByDate.get(openDay);
            if (existing) logs.update(existing.id, patch);
            else logs.create({ date: openDay, symptoms: [], moods: [], flow: "", note: "", ...patch });
          }}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ anillo */

function Ring({
  phase,
  pred,
  today,
}: {
  phase: Phase;
  pred: ReturnType<typeof predict>;
  today: DateKey;
}) {
  const daysToPeriod = pred ? Math.max(0, daysBetweenLocal(today, pred.nextPeriod)) : null;
  const frac = pred && daysToPeriod !== null ? 1 - daysToPeriod / pred.avgLength : 0;

  const color =
    phase === "period" ? "#e2504a" : phase === "ovulation" || phase === "fertile" ? "#6bb86f" : "#e58aa2";

  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="cy-ring">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--nk-surface-sunk)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(Math.max(frac, 0), 1))}
        />
      </svg>
      <div className="cy-ring__center">
        <div className="cy-ring__big">{daysToPeriod ?? "–"}</div>
        <div className="cy-ring__label">{daysToPeriod === 0 ? "hoy toca" : "días para la regla"}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- calendario */

function Calendar({
  year,
  month,
  cycles,
  daySet,
  pred,
  today,
  logByDate,
  onPrev,
  onNext,
  onTogglePeriod,
}: {
  year: number;
  month: number;
  cycles: ReturnType<typeof cyclesFromDays>;
  daySet: Set<DateKey>;
  pred: ReturnType<typeof predict>;
  today: DateKey;
  logByDate: Map<DateKey, DayLog>;
  onPrev: () => void;
  onNext: () => void;
  onTogglePeriod: (d: DateKey) => void;
}) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));

  return (
    <div className="cy-cal">
      <div className="cy-cal__head">
        <h3 className="cy-cal__title">
          {MONTHS[month]} {year}
        </h3>
        <div className="cy-cal__nav">
          <button type="button" onClick={onPrev} aria-label="Mes anterior">
            ‹
          </button>
          <button type="button" onClick={onNext} aria-label="Mes siguiente">
            ›
          </button>
        </div>
      </div>

      <div className="cy-grid">
        {WEEKDAYS.map((d) => (
          <div className="cy-weekday" key={d}>
            {d}
          </div>
        ))}
        {cells.map((date) => {
          const key = toKey(date);
          // La regla ya no se predice: se pinta lo que está marcado. El resto de
          // fases (fértil, ovulación, prevista) sí son predicción.
          const marked = daySet.has(key);
          const ph = marked ? "period" : phaseOf(key, cycles, pred);
          const hasLog = logByDate.has(key);
          const future = key > today;
          return (
            <button
              key={key}
              type="button"
              className={[
                "cy-day",
                date.getMonth() === month ? "" : "cy-day--out",
                key === today ? "cy-day--today" : "",
                ph !== "none" ? `cy-day--${ph}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              // No se marca regla en el futuro: no tiene sentido y descuadra.
              onClick={() => !future && onTogglePeriod(key)}
              disabled={future}
            >
              {date.getDate()}
              {hasLog && <span className="cy-day__mark" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- hoja día */

function DaySheet({
  date,
  log,
  isPeriod,
  onTogglePeriod,
  onSave,
  onClose,
}: {
  date: DateKey;
  log: DayLog | null;
  isPeriod: boolean;
  onTogglePeriod: () => void;
  onSave: (patch: Partial<DayLog>) => void;
  onClose: () => void;
}) {
  const [symptoms, setSymptoms] = useState<string[]>(log?.symptoms ?? []);
  const [moods, setMoods] = useState<string[]>(log?.moods ?? []);
  const [flow, setFlow] = useState<DayLog["flow"]>(log?.flow ?? "");
  const [note, setNote] = useState(log?.note ?? "");

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function save() {
    onSave({ symptoms, moods, flow, note: note.trim() });
    onClose();
  }

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2 style={{ textTransform: "capitalize" }}>{prettyDate(date)}</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="cy-daysheet">
          <button
            type="button"
            className={`cy-period-flag${isPeriod ? " cy-period-flag--on" : ""}`}
            onClick={onTogglePeriod}
          >
            {isPeriod ? "🩸 Día de regla — tocar para quitar" : "Marcar como día de regla"}
          </button>

          <div className="cy-section">
            <span>Flujo</span>
            <div className="cy-flow">
              {FLOWS.map((f) => (
                <button key={f} type="button" aria-pressed={flow === f} onClick={() => setFlow(flow === f ? "" : f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="cy-section">
            <span>Síntomas</span>
            <div className="cy-symptoms">
              {SYMPTOMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="cy-tag"
                  aria-pressed={symptoms.includes(s)}
                  onClick={() => toggle(symptoms, setSymptoms, s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="cy-section">
            <span>Ánimo</span>
            <div className="cy-moods">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="cy-tag"
                  aria-pressed={moods.includes(m)}
                  onClick={() => toggle(moods, setMoods, m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="cy-section">
            <span>Nota</span>
            <textarea
              className="cy-note-input"
              rows={2}
              value={note}
              placeholder="Lo que quieras recordar de hoy…"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="cy-period-toggle">
            <button type="button" className="nk-btn" onClick={save}>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ fechas */

function daysBetweenLocal(a: DateKey, b: DateKey): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

function yesterday(k: DateKey): DateKey {
  return toKey(new Date(fromKey(k).getTime() - 86_400_000));
}

function prettyDate(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

function shortDate(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
