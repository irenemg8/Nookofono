import { useCallback, useState } from "react";

const STORAGE_KEY = "ipug.passports";

export type PersonId = "irene" | "vicente";

export interface Passport {
  name: string;
  island: string;
  fruit: string;
  birthday: string;
  greeting: string;
  since: string;
  /** Data URL. En fase 2 pasa a una clave de R2. Ver MIGRACION-BACKEND.md §11. */
  photo: string | null;
}

const DEFAULTS: Record<PersonId, Passport> = {
  irene: {
    name: "Irene",
    island: "Isla Pug",
    fruit: "Naranja",
    birthday: "",
    greeting: "",
    since: "2026",
    photo: null,
  },
  vicente: {
    name: "Vicente",
    island: "Isla Pug",
    fruit: "Naranja",
    birthday: "",
    greeting: "",
    since: "2026",
    photo: null,
  },
};

export function usePassports() {
  const [passports, setPassports] = useState<Record<PersonId, Passport>>(read);

  const update = useCallback((who: PersonId, patch: Partial<Passport>) => {
    setPassports((prev) => {
      const next = { ...prev, [who]: { ...prev[who], ...patch } };
      write(next);
      return next;
    });
  }, []);

  return { passports, update };
}

function read(): Record<PersonId, Passport> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULTS;
    // Se mezcla con los valores por defecto para que añadir un campo nuevo no
    // deje pasaportes a medias.
    return {
      irene: { ...DEFAULTS.irene, ...raw.irene },
      vicente: { ...DEFAULTS.vicente, ...raw.vicente },
    };
  } catch {
    return DEFAULTS;
  }
}

function write(passports: Record<PersonId, Passport>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(passports));
  } catch {
    // Las fotos en data URL pueden llenar la cuota de localStorage.
  }
}
