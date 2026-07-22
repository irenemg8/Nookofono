/**
 * Límite de intentos de login.
 *
 * Un código de 6 dígitos son un millón de combinaciones, pero sin límite de
 * intentos un atacante persistente acaba teniendo probabilidad no despreciable.
 * Cinco intentos cada 15 minutos lo elimina.
 *
 * El contador vive en memoria del proceso. `MIGRACION-BACKEND.md` §9.5 lo ponía
 * en KV de Cloudflare, pero aquí hay un único proceso y dos usuarios: una tabla
 * en Postgres o Redis sería infraestructura para nada. La contrapartida honesta
 * es que **reiniciar el contenedor borra los contadores**; para forzar eso un
 * atacante necesitaría poder reiniciarlo, y en ese caso ya habría perdido.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitVerdict {
  allowed: boolean;
  /** Segundos que faltan para poder reintentar. */
  retryAfter: number;
}

export function hit(key: string, max: number, windowSec: number): RateLimitVerdict {
  const now = Date.now();
  const found = buckets.get(key);

  if (!found || now >= found.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, retryAfter: 0 };
  }

  if (found.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((found.resetAt - now) / 1000) };
  }

  found.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/** Se llama al acertar el código: un login correcto limpia el historial. */
export function reset(key: string): void {
  buckets.delete(key);
}

/**
 * Barrido periódico de las entradas caducadas.
 *
 * Sin esto el mapa sólo crece. Con dos usuarios da igual, pero un `Map` que
 * nunca se limpia es una fuga esperando a que cambien las condiciones.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, 600_000).unref();
