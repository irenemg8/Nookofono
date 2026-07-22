export type PersonId = "irene" | "vicente";

const STORAGE_KEY = "ipug.me";

/**
 * Quién está usando el móvil.
 *
 * Todavía no hay inicio de sesión, así que se guarda en el dispositivo: el
 * móvil de Irene dice "irene" y el de Vicente "vicente". Cuando entre el TOTP
 * en fase 2, este hook pasa a leer el `sub` del JWT de sesión y todo lo que
 * cuelga de él sigue funcionando igual. Ver docs/MIGRACION-BACKEND.md §9.
 */
export function useCurrentUser(): PersonId {
  const saved = safeRead();
  return saved ?? "irene";
}

export function setCurrentUser(id: PersonId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Modo privado: se queda con el valor por defecto.
  }
}

function safeRead(): PersonId | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "irene" || raw === "vicente" ? raw : null;
  } catch {
    return null;
  }
}
