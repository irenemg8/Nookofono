/**
 * Deja la base de datos lista para usarse.
 *
 * Sólo crea las dos filas de `users`, que son fijas y sin ellas no se puede
 * iniciar sesión. **No inventa contenido**: ni notas, ni eventos, ni gastos de
 * ejemplo. La app estrena vacía y lo que haya dentro lo habréis metido vosotros.
 *
 * Es idempotente: se puede volver a lanzar sin duplicar nada ni pisar el secreto
 * TOTP de quien ya lo tenga configurado.
 */
import { sql } from "drizzle-orm";

import { db, pool } from "./client.js";
import { profiles, users } from "./schema.js";

/**
 * Los dos, con su pasaporte.
 *
 * Los datos del pasaporte estaban escritos en `src/apps/profile/model/people.ts`
 * y no se podían cambiar sin desplegar. Ahora nacen aquí y viven en la tabla,
 * que es lo que permite corregir una fruta sin tocar el código.
 */
const PEOPLE = [
  {
    id: "irene",
    displayName: "Irene",
    profile: {
      islandName: "Hogar de Pus",
      nativeFruit: "Melocotón",
      birthday: "06-08",
      registeredAt: "2026",
    },
  },
  {
    id: "vicente",
    displayName: "Vicente",
    profile: {
      islandName: "Hogar de Pus",
      nativeFruit: "Campo de nabos",
      birthday: "03-17",
      registeredAt: "2026",
    },
  },
];

for (const { profile, ...person } of PEOPLE) {
  await db
    .insert(users)
    .values(person)
    .onConflictDoUpdate({
      target: users.id,
      // Sólo el nombre visible: pisar `totpSecret` dejaría fuera a quien ya
      // tuviera el autenticador configurado.
      set: { displayName: sql`excluded.display_name` },
    });

  // Los datos impresos del pasaporte se refrescan siempre, para poder corregir
  // una fruta relanzando el seed. El lema queda fuera a propósito: lo escribís
  // vosotros y volver a sembrar no debe borrarlo.
  await db
    .insert(profiles)
    .values({ personId: person.id, ...profile })
    .onConflictDoUpdate({
      target: profiles.personId,
      set: {
        islandName: sql`excluded.island_name`,
        nativeFruit: sql`excluded.native_fruit`,
        birthday: sql`excluded.birthday`,
        registeredAt: sql`excluded.registered_at`,
      },
    });
}

console.log(`Usuarios listos: ${PEOPLE.map((p) => p.id).join(", ")}.`);
await pool.end();
