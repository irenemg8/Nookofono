/**
 * Ficha de Nilo.
 *
 * Va fija en el código a propósito: el microchip, el pasaporte y la fecha de
 * nacimiento no cambian nunca, así que no tiene sentido que sean editables
 * desde la app —sólo se podrían estropear—. Para corregir un dato, se edita
 * aquí y se despliega.
 *
 * La foto se toma de `src/assets/pets/nilo.*`: basta con dejar el fichero.
 */
const photos = import.meta.glob<{ default: string }>(
  "../../../assets/pets/nilo.{webp,png,jpg,jpeg,avif}",
  { eager: true },
);

export const PET = {
  name: "Nilo",
  breed: "Carlino",
  /** ISO. Con esto se calcula la edad. */
  birthday: "",
  chip: "",
  passport: "",
  vet: "",
  vetPhone: "",
  photo: Object.values(photos)[0]?.default ?? null,
} as const;

/** Edad legible a partir de la fecha de nacimiento. */
export function ageOf(iso: string): string | null {
  if (!iso) return null;

  const birth = new Date(iso);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return null;

  if (months < 24) return `${months} ${months === 1 ? "mes" : "meses"}`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} años` : `${years} años y ${rest} m`;
}
