/**
 * Inicio de sesión de Spotify con **Authorization Code + PKCE**.
 *
 * PKCE es lo que permite hacerlo entero en el navegador: no hay `client_secret`
 * que esconder, así que no hace falta servidor. El `client_id` es público por
 * diseño en este flujo — no es un secreto filtrado.
 *
 * Comprobado el 22/07/2026: `accounts.spotify.com/api/token` responde con CORS
 * al origen que la llama, y `api.spotify.com` con `*`.
 */
/**
 * Va en el código a propósito. En PKCE el `client_id` es público: sin
 * `client_secret` que proteger, no hay nada que esconder, y así el despliegue a
 * Pages no necesita variables de entorno. Se puede sobreescribir con
 * `VITE_SPOTIFY_CLIENT_ID` si algún día hace falta otra app.
 */
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "a23f4196bca240a3a31fafd02b1340a5";

const AUTHORIZE = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";

const STORE = "ipug.spotify.session";
const VERIFIER = "ipug.spotify.verifier";

const SCOPES = [
  "streaming", // reproducir desde el navegador (Web Playback SDK)
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

interface Session {
  accessToken: string;
  refreshToken: string;
  /** Epoch en ms. */
  expiresAt: number;
}

export const isConfigured = () => CLIENT_ID.length > 0;

/**
 * Debe coincidir **exactamente** con la registrada en el panel de Spotify,
 * barra final incluida. Es la causa número uno de `INVALID_CLIENT`.
 */
export function redirectUri(): string {
  return window.location.origin + import.meta.env.BASE_URL;
}

export async function login(): Promise<void> {
  const verifier = randomString(64);
  sessionStorage.setItem(VERIFIER, verifier);

  const challenge = await sha256Base64Url(verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });

  window.location.href = `${AUTHORIZE}?${params}`;
}

export function logout() {
  localStorage.removeItem(STORE);
}

/**
 * Canjea el `?code=` de la vuelta de Spotify.
 *
 * Se llama al arrancar la app, no al abrir la pantalla de música: tras el
 * redirect se aterriza en la pantalla de bloqueo, y si esperáramos a montar el
 * reproductor el código seguiría colgando de la URL y se perdería al recargar.
 */
export async function consumeRedirect(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const verifier = sessionStorage.getItem(VERIFIER);

  if (!code || !verifier) return false;

  // Se limpia la URL enseguida: un código de autorización sólo vale una vez, y
  // dejarlo a la vista invita a reintentos que fallarían.
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, "", url.toString());
  sessionStorage.removeItem(VERIFIER);

  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!res.ok) return false;
  save(await res.json());
  return true;
}

/** Token válido, renovándolo si hace falta. `null` si no hay sesión. */
export async function accessToken(): Promise<string | null> {
  const session = read();
  if (!session) return null;

  // Un minuto de margen: si caduca a mitad de petición, la llamada falla.
  if (Date.now() < session.expiresAt - 60_000) return session.accessToken;

  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
  });

  if (!res.ok) {
    logout();
    return null;
  }

  const json = await res.json();
  // Spotify no siempre devuelve un refresh_token nuevo: hay que conservar el
  // anterior o la sesión se pierde en la siguiente renovación.
  save({ ...json, refresh_token: json.refresh_token ?? session.refreshToken });
  return json.access_token;
}

export function hasSession(): boolean {
  return read() !== null;
}

/* ------------------------------------------------------------------ interno */

function save(json: { access_token: string; refresh_token: string; expires_in: number }) {
  const session: Session = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  localStorage.setItem(STORE, JSON.stringify(session));
}

function read(): Session | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    return raw?.accessToken && raw?.refreshToken ? (raw as Session) : null;
  } catch {
    return null;
  }
}

function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
