import type { PersonId } from "../../../shared/lib/use-current-user";

/**
 * El nombre de cada uno.
 *
 * El resto del pasaporte —isla, fruta autóctona y cumpleaños— vive ahora en la
 * tabla `profiles` y se sirve por `GET /api/profile/:id`, así que se puede
 * corregir sin desplegar. Aquí queda sólo el nombre, que acompaña a la foto y
 * es un fichero del repositorio, no una fila.
 */
export interface Person {
  name: string;
}

export const PEOPLE: Record<PersonId, Person> = {
  irene: { name: "Irene" },
  vicente: { name: "Vicente" },
};
