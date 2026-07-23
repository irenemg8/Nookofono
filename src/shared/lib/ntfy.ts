/**
 * Aviso al móvil del otro, vía ntfy.sh.
 *
 * ntfy entrega notificaciones push sin cuenta, sin clave y sin servidor propio:
 * se publica en un "tema" y quien esté suscrito lo recibe. Es la única forma de
 * que un aviso llegue con la app cerrada mientras no haya Web Push con VAPID
 * (ver `docs/PLAN.md` §2).
 *
 * ⚠️ **Un tema de ntfy es público para quien sepa su nombre.** No hay
 * contraseña: la privacidad depende de que nadie lo adivine, y por eso los
 * nombres son largos y sin sentido. Nada delicado por aquí.
 *
 * Que llegue el aviso exige que **los dos** tengan la app ntfy instalada y
 * suscrita al tema.
 */
export interface NtfyMessage {
  topic: string;
  title: string;
  body: string;
  /** Los del móvil: `urgent` vibra y suena aunque esté en silencio. */
  priority?: "min" | "low" | "default" | "high" | "urgent";
  /** Emoji o nombres de icono que ntfy pinta junto al aviso. */
  tags?: string[];
}

export async function notify(message: NtfyMessage): Promise<boolean> {
  try {
    const res = await fetch(`https://ntfy.sh/${message.topic}`, {
      method: "POST",
      headers: {
        Title: encodeHeader(message.title),
        Priority: message.priority ?? "default",
        ...(message.tags ? { Tags: message.tags.join(",") } : {}),
      },
      body: message.body,
    });
    return res.ok;
  } catch {
    // Sin conexión el aviso no sale, pero la acción que lo dispara ya se guardó
    // en la base de datos: no se pierde nada, sólo no suena.
    return false;
  }
}

/**
 * Las cabeceras HTTP sólo admiten ASCII. Un título con tildes o emoji reventaría
 * la petición, así que ntfy acepta el título codificado en RFC 2047.
 */
function encodeHeader(text: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  const b64 = btoa(unescape(encodeURIComponent(text)));
  return `=?UTF-8?B?${b64}?=`;
}
