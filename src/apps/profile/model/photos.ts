import type { PersonId } from "../../../shared/lib/use-current-user";

/**
 * Fotos de pasaporte.
 *
 * Basta con dejar `irene.*` y `vicente.*` en `src/assets/profiles/` para que
 * aparezcan: Vite las descubre al compilar, así que no hay que registrarlas ni
 * subirlas desde la app.
 */
const files = import.meta.glob<{ default: string }>(
  "../../../assets/profiles/*.{webp,png,jpg,jpeg,avif}",
  { eager: true },
);

const byPerson = new Map<string, string>();
for (const [path, mod] of Object.entries(files)) {
  const name = path.split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase();
  if (name) byPerson.set(name, mod.default);
}

export function photoOf(person: PersonId): string | null {
  return byPerson.get(person) ?? null;
}
