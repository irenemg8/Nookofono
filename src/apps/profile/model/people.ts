import type { PersonId } from "../../../shared/lib/use-current-user";

/**
 * Datos fijos del pasaporte.
 *
 * Igual que la ficha de Nilo, van en el código: el nombre, la isla, la fruta
 * autóctona y el cumpleaños no cambian, así que dejarlos editables sólo daría
 * ocasión de estropearlos. Para corregir uno, se edita aquí y se despliega.
 *
 * Lo único que se puede cambiar desde la app es el lema, que es justo lo que
 * en el juego se cambia cuando te apetece.
 */
export interface Person {
  name: string;
  island: string;
  fruit: string;
  /** Como se escribe en el pasaporte del juego: "29 de octubre". */
  birthday: string;
  since: string;
}

export const PEOPLE: Record<PersonId, Person> = {
  irene: {
    name: "Irene",
    island: "",
    fruit: "",
    birthday: "",
    since: "2026",
  },
  vicente: {
    name: "Vicente",
    island: "",
    fruit: "",
    birthday: "",
    since: "2026",
  },
};
