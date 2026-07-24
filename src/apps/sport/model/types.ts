import type { PersonId } from "../../../shared/lib/use-current-user";
import type { Entity } from "../../../shared/lib/use-remote-collection";

/**
 * Modelo de la app Deporte.
 *
 * Tres colecciones:
 *  - `sports`  — el catálogo de deportes (preestablecidos + los que se añadan).
 *                Compartido: los dos ven la misma lista.
 *  - `sessions`— cada sesión cronometrada, con su deporte, duración y nota.
 *                **Por persona**: cada uno ve sólo las suyas (`user`).
 *  - `routines`— listados de ejercicios reutilizables. También por persona.
 */

export interface SportKind extends Entity {
  name: string;
  emoji: string;
  position: number;
}

export interface SportSession extends Entity {
  user: PersonId;
  /** Nombre del deporte, congelado por si luego se borra del catálogo. */
  sport: string;
  emoji: string;
  durationSec: number;
  note: string;
  /** Momento en que se terminó (epoch ms). */
  doneAt: number;
}

export type ExerciseKind = "reps" | "time";

export interface Exercise {
  name: string;
  kind: ExerciseKind;
  /** Repeticiones si `kind==="reps"`, segundos si `kind==="time"`. */
  amount: number;
}

export interface Routine extends Entity {
  user: PersonId;
  name: string;
  exercises: Exercise[];
}

/** Deportes con los que arranca el catálogo la primera vez. */
export const PRESET_SPORTS: { name: string; emoji: string }[] = [
  { name: "Yoga", emoji: "🧘" },
  { name: "Pádel", emoji: "🎾" },
  { name: "Tenis", emoji: "🎾" },
  { name: "Natación", emoji: "🏊" },
  { name: "Caminar", emoji: "🚶" },
  { name: "Correr", emoji: "🏃" },
  { name: "Gym", emoji: "🏋️" },
];

/** Emojis para elegir al crear un deporte nuevo. */
export const SPORT_EMOJIS = [
  "🏅", "🧘", "🎾", "🏊", "🚶", "🏃", "🏋️", "🚴", "⚽", "🏀", "🏐", "🥊",
  "⛹️", "🤸", "🧗", "⛷️", "🏓", "🏸", "🥾", "🤾", "🚣", "🤺", "🏇", "🛹",
  "🥋", "🏹", "⛳", "🤽", "🧍", "💪",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Segundos → `m:ss` o `h:mm:ss`. */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

/* --------------------------------------------------------- descarga historial */

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Historial de sesiones → blob `.csv` o `.xlsx`.
 *
 * `xlsx` va con `import()` dinámico, como en la app de hojas: sólo se descarga
 * la librería al exportar de verdad.
 */
export async function exportSessions(
  sessions: SportSession[],
  kind: "csv" | "xlsx",
): Promise<Blob> {
  const header = ["Fecha", "Deporte", "Duración", "Segundos", "Nota"];
  const rows = sessions.map((s) => [
    new Date(s.doneAt).toLocaleString("es-ES"),
    s.sport,
    formatDuration(s.durationSec),
    s.durationSec,
    s.note,
  ]);

  if (kind === "csv") {
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    // BOM para que Excel abra bien las tildes.
    return new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  }

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Deporte");
  const array = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([array], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
