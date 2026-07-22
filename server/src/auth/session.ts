/**
 * Sesiones: JWT HS256 firmado con Web Crypto.
 *
 * No hace falta una librería para esto. Un JWT son tres trozos en base64url
 * separados por puntos, y `crypto.subtle` ya trae el HMAC. Menos dependencias
 * que auditar en la única puerta de entrada de la app.
 *
 * El token viaja en una cookie `HttpOnly`, que es lo que impide que un XSS lo
 * robe — la diferencia principal frente a guardarlo en `localStorage`.
 */
import { randomUUID } from "node:crypto";

export interface SessionClaims {
  /** 'irene' | 'vicente' */
  sub: string;
  iat: number;
  exp: number;
  /** Identificador de esta sesión, para poder revocarla. */
  jti: string;
}

const enc = new TextEncoder();

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof data === "string"
      ? enc.encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  return Buffer.from(bytes).toString("base64url");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(
  secret: string,
  personId: string,
  ttlDays: number,
): Promise<{ token: string; claims: SessionClaims }> {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    sub: personId,
    iat: now,
    exp: now + ttlDays * 86_400,
    jti: randomUUID(),
  };

  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const data = `${head}.${body}`;

  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data));
  return { token: `${data}.${b64url(sig)}`, claims };
}

/**
 * Devuelve los claims si el token es auténtico y no ha caducado, o `null`.
 *
 * La firma se comprueba con `crypto.subtle.verify`, que compara en tiempo
 * constante: comparar las cadenas con `===` filtraría información por el tiempo
 * de respuesta.
 */
export async function verifySession(
  secret: string,
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [head, body, sig] = parts;

  let ok: boolean;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      Buffer.from(sig, "base64url"),
      enc.encode(`${head}.${body}`),
    );
  } catch {
    return null;
  }
  if (!ok) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionClaims;
    if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (claims.sub !== "irene" && claims.sub !== "vicente") return null;
    return claims;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = "ipug_session";

/**
 * `SameSite=Lax` deja pasar la cookie al navegar al sitio pero la bloquea en
 * peticiones cruzadas, que es lo que corta el CSRF. Como la API y la web se
 * sirven desde el mismo dominio, no hace falta `None`.
 */
export function cookieHeader(token: string, ttlDays: number, secure: boolean): string {
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${ttlDays * 86_400}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearCookieHeader(secure: boolean): string {
  const attrs = [`${COOKIE_NAME}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}
