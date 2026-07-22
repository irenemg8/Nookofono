import { useCallback, useState } from "react";
import type { PersonId } from "../../../shared/lib/use-current-user";

const STORAGE_KEY = "ipug.greetings";

/**
 * Lo único editable del pasaporte: el lema.
 *
 * El resto de datos son fijos y viven en `people.ts`. En fase 2 esto pasa a la
 * tabla `profiles` en D1. Ver docs/MIGRACION-BACKEND.md §6.
 */
export function useGreetings() {
  const [greetings, setGreetings] = useState<Record<PersonId, string>>(read);

  const setGreeting = useCallback((who: PersonId, value: string) => {
    setGreetings((prev) => {
      const next = { ...prev, [who]: value };
      write(next);
      return next;
    });
  }, []);

  return { greetings, setGreeting };
}

function read(): Record<PersonId, string> {
  const empty = { irene: "", vicente: "" };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return empty;
    return {
      irene: typeof raw.irene === "string" ? raw.irene : "",
      vicente: typeof raw.vicente === "string" ? raw.vicente : "",
    };
  } catch {
    return empty;
  }
}

function write(greetings: Record<PersonId, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(greetings));
  } catch {
    // Modo privado o cuota llena.
  }
}
