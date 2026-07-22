import { useCallback, useState } from "react";

const STORAGE_KEY = "ipug.nilo";

export interface Pet {
  name: string;
  breed: string;
  birthday: string;
  chip: string;
  passport: string;
  vet: string;
  photo: string | null;
  walkStreak: number;
}

const DEFAULT: Pet = {
  name: "Nilo",
  breed: "Carlino",
  birthday: "",
  chip: "",
  passport: "",
  vet: "",
  photo: null,
  walkStreak: 0,
};

export function usePet() {
  const [pet, setPet] = useState<Pet>(read);

  const update = useCallback((patch: Partial<Pet>) => {
    setPet((prev) => {
      const next = { ...prev, ...patch };
      write(next);
      return next;
    });
  }, []);

  return { pet, update };
}

function read(): Pet {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    // Mezcla con los valores por defecto para que un campo nuevo no rompa la ficha.
    return raw && typeof raw === "object" ? { ...DEFAULT, ...raw } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function write(pet: Pet) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pet));
  } catch {
    // La foto en data URL puede llenar la cuota.
  }
}
