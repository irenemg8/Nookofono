/**
 * Verificación del código de 6 dígitos del autenticador.
 *
 * Ver `docs/MIGRACION-BACKEND.md` §9.3. Dos piezas que no son opcionales:
 *
 * 1. **Ventana de 1 intervalo** (±30 s). Subirla "por comodidad" multiplica la
 *    superficie de ataque sin arreglar nada real.
 * 2. **Anti-replay**: se guarda el último intervalo consumido por cada persona.
 *    Sin esto, un código visto por encima del hombro sirve durante el minuto
 *    siguiente, que es justo el escenario del que protege un segundo factor.
 */
import { eq, sql } from "drizzle-orm";
import { authenticator } from "otplib";

import { db } from "../db/client.js";
import { users } from "../db/schema.js";

export type TotpResult = "ok" | "invalid" | "replay" | "unconfigured";

export async function verifyTotp(
  personId: string,
  code: string,
  window: number,
): Promise<TotpResult> {
  const row = await db.query.users.findFirst({ where: eq(users.id, personId) });
  if (!row?.totpSecret) return "unconfigured";

  authenticator.options = { window };

  let valid: boolean;
  try {
    valid = authenticator.verify({ token: code, secret: row.totpSecret });
  } catch {
    // `otplib` lanza si el secreto no es Base32 válido.
    return "invalid";
  }
  if (!valid) return "invalid";

  const step = Math.floor(Date.now() / 30_000);
  if (step <= row.lastTotpStep) return "replay";

  // La condición va en el UPDATE, no sólo en el `if` de arriba: dos peticiones
  // simultáneas con el mismo código podrían pasar ambas la comprobación previa,
  // y sólo una debe ganar. Si no actualiza ninguna fila, otra llegó antes.
  const updated = await db
    .update(users)
    .set({ lastTotpStep: step })
    .where(sql`${users.id} = ${personId} AND ${users.lastTotpStep} < ${step}`)
    .returning({ id: users.id });

  return updated.length > 0 ? "ok" : "replay";
}
