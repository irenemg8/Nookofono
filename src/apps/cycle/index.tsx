import { useMemo, useState } from "react";
import { notify } from "../../shared/lib/ntfy";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import {
  addDays,
  daysBetween,
  fromKey,
  phaseOf,
  predict,
  todayKey,
  toKey,
  type Cycle,
  type DateKey,
  type Phase,
} from "./model/predict";
import "./cycle.css";

/* ------------------------------------------------------------------ modelo */

/** Un periodo registrado: cuándo empezó y (al terminar) cuántos días duró. */
interface Period extends Entity {
  start: DateKey;
  bleedDays: number; // 0 mientras sigue abierto
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
  const periods = useRemoteCollection<Period>("/api/cycle/periods");
  const logs = useRemoteCollection<DayLog>("/api/cycle/logs");

  const cycles: Cycle[] = useMemo(
    () =>
      periods.items
        .map((p) => ({ start: p.start, bleedDays: p.bleedDays || undefined }))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [periods.items],
  );

  const pred = useMemo(() => predict(cycles), [cycles]);
  const today = todayKey();
  const todayPhase = phaseOf(today, cycles, pred);

  if (periods.status === "loading") return <p className="cy-note">Cargando…</p>;

  // Vicente ve el estado de Belinda, no el diario íntimo de Irene.
  if (me === "vicente") {
    return <BelindaView phase={todayPhase} pred={pred} />;
  }

  return <IreneView periods={periods} logs={logs} cycles={cycles} pred={pred} today={today} phase={todayPhase} />;
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
  periods,
  logs,
  cycles,
  pred,
  today,
  phase,
}: {
  periods: ReturnType<typeof useRemoteCollection<Period>>;
  logs: ReturnType<typeof useRemoteCollection<DayLog>>;
  cycles: Cycle[];
  pred: ReturnType<typeof predict>;
  today: DateKey;
  phase: Phase;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<DateKey | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // El periodo abierto (empezado, sin días de sangrado cerrados hoy).
  const activePeriod = periods.items.find((p) => {
    if (p.bleedDays > 0) return false;
    return daysBetween(p.start, today) <= 10; // sigue considerándose en curso
  });

  const logByDate = useMemo(() => {
    const m = new Map<DateKey, DayLog>();
    for (const l of logs.items) m.set(l.date, l);
    return m;
  }, [logs.items]);

  async function startPeriod() {
    await periods.create({ start: today, bleedDays: 0 });
    // Que Vicente se entere: modo Belinda de obras.
    await notify({
      topic: TOPIC,
      title: "Belinda",
      body: "A Irene le ha venido la regla. Modo chocolate y mantita activado.",
      priority: "high",
      tags: ["blood", "chocolate_bar"],
    });
  }

  async function endPeriod() {
    if (!activePeriod) return;
    const days = Math.max(1, daysBetween(activePeriod.start, today) + 1);
    await periods.update(activePeriod.id, { bleedDays: days });
  }

  return (
    <div className="cy">
      <div className="cy-hero">
        <Ring phase={phase} pred={pred} today={today} />
        <div className={`cy-phase cy-phase--${phase}`}>{PHASE_LABEL[phase]}</div>
        <p className="cy-belinda">Belinda al día 🌸</p>
      </div>

      <div className="cy-log">
        {activePeriod ? (
          <button type="button" className="nk-btn nk-btn--danger" onClick={endPeriod}>
            Se acabó la regla
          </button>
        ) : (
          <button type="button" className="nk-btn" onClick={startPeriod}>
            Hoy me ha venido
          </button>
        )}
        <button type="button" className="nk-btn nk-btn--ghost" onClick={() => setOpenDay(today)}>
          Anotar hoy
        </button>
      </div>

      <Calendar
        year={year}
        month={month}
        cycles={cycles}
        pred={pred}
        today={today}
        logByDate={logByDate}
        onPrev={() => setCursor(new Date(year, month - 1, 1))}
        onNext={() => setCursor(new Date(year, month + 1, 1))}
        onPick={setOpenDay}
      />

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
            <dd>
              {pred.regular
                ? `${pred.avgLength} días`
                : `${pred.minLength}–${pred.maxLength} días`}
            </dd>
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
          onSave={(patch) => {
            const existing = logByDate.get(openDay);
            if (existing) logs.update(existing.id, patch);
            else
              logs.create({
                date: openDay,
                symptoms: [],
                moods: [],
                flow: "",
                note: "",
                ...patch,
              });
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
  // Días hasta la próxima regla, para el número grande del centro.
  const daysToPeriod = pred ? Math.max(0, daysBetween(today, pred.nextPeriod)) : null;
  const frac = pred ? 1 - daysToPeriod! / pred.avgLength : 0;

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
  pred,
  today,
  logByDate,
  onPrev,
  onNext,
  onPick,
}: {
  year: number;
  month: number;
  cycles: Cycle[];
  pred: ReturnType<typeof predict>;
  today: DateKey;
  logByDate: Map<DateKey, DayLog>;
  onPrev: () => void;
  onNext: () => void;
  onPick: (d: DateKey) => void;
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
          const ph = phaseOf(key, cycles, pred);
          const hasLog = logByDate.has(key);
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
              onClick={() => onPick(key)}
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
  onSave,
  onClose,
}: {
  date: DateKey;
  log: DayLog | null;
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
          <div className="cy-section">
            <span>Flujo</span>
            <div className="cy-flow">
              {FLOWS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={flow === f}
                  onClick={() => setFlow(flow === f ? "" : f)}
                >
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

function prettyDate(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

function shortDate(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

// Se re-exporta para que el linter no marque `addDays` como no usado si algún
// día se quita del cálculo; mantiene la superficie del módulo estable.
export { addDays };
