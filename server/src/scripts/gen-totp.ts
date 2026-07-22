/**
 * Genera el secreto TOTP de una persona, lo guarda y pinta el QR.
 *
 *   npm run totp -- irene
 *
 * El QR se escanea con Google o Microsoft Authenticator. **Guarda el secreto en
 * el gestor de contraseñas antes de cerrar la terminal**: si pierdes el móvil y
 * no lo tienes, te quedas fuera de tu propia app sin forma de recuperarla. Aquí
 * no hay "he olvidado mi contraseña".
 */
import { eq } from "drizzle-orm";
import { authenticator } from "otplib";
import qrcode from "qrcode-terminal";

import { db, pool } from "../db/client.js";
import { users } from "../db/schema.js";

const personId = process.argv[2];

if (personId !== "irene" && personId !== "vicente") {
  console.error("Uso: npm run totp -- <irene|vicente>");
  process.exit(1);
}

const existing = await db.query.users.findFirst({ where: eq(users.id, personId) });
if (!existing) {
  console.error(`No existe el usuario "${personId}". Lanza antes: npm run db:seed`);
  process.exit(1);
}

if (existing.totpSecret && process.argv[3] !== "--force") {
  console.error(
    `"${personId}" ya tiene autenticador configurado.\n` +
      "Si de verdad quieres reemplazarlo (y dejar fuera al móvil actual), repite con --force.",
  );
  process.exit(1);
}

const secret = authenticator.generateSecret();
const uri = authenticator.keyuri(existing.displayName, "iPug", secret);

// El anti-replay se reinicia con el secreto nuevo: los intervalos ya consumidos
// pertenecían al anterior y bloquearían el primer código del nuevo.
await db.update(users).set({ totpSecret: secret, lastTotpStep: 0 }).where(eq(users.id, personId));

console.log(`\nAutenticador de ${existing.displayName}\n`);
qrcode.generate(uri, { small: true });
console.log(`\nSecreto (guárdalo en el gestor de contraseñas):\n\n    ${secret}\n`);
console.log("Escanea el QR con Google Authenticator o Microsoft Authenticator.\n");

await pool.end();
