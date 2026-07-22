import { useCallback, useEffect, useRef, useState } from "react";
import { accessToken } from "./spotify-auth";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const API = "https://api.spotify.com/v1";

export interface Track {
  name: string;
  artists: string;
  album: string;
  cover: string | null;
}

export interface PlayerState {
  /** El SDK ha arrancado y tenemos un dispositivo propio. */
  ready: boolean;
  /** El SDK no pudo arrancar; hay que caer al reproductor incrustado. */
  failed: string | null;
  playing: boolean;
  position: number;
  duration: number;
  track: Track | null;
  shuffle: boolean;
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (payload: never) => void): void;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(v: number): Promise<void>;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}

/**
 * El tocadiscos como dispositivo de Spotify, vía Web Playback SDK.
 *
 * Requiere Premium (y no vale un plan "sólo móvil", que Spotify excluye
 * expresamente). En iOS el audio no arranca solo tras transferir la
 * reproducción: hace falta un gesto, y por eso todo empieza en el botón de
 * play en lugar de al abrir la pantalla.
 *
 * Si el SDK no puede arrancar, `failed` explica por qué y la pantalla cae al
 * reproductor incrustado, que funciona siempre.
 */
export function useSpotifyPlayer(playlistUri: string) {
  const player = useRef<SpotifyPlayer | null>(null);
  const deviceId = useRef<string | null>(null);
  const [state, setState] = useState<PlayerState>({
    ready: false,
    failed: null,
    playing: false,
    position: 0,
    duration: 0,
    track: null,
    shuffle: false,
  });

  useEffect(() => {
    let cancelled = false;

    function build() {
      if (cancelled || !window.Spotify) return;

      const p = new window.Spotify.Player({
        name: "iPug",
        getOAuthToken: (cb) => {
          accessToken().then((t) => t && cb(t));
        },
        volume: 0.8,
      });

      p.addListener("ready", ((e: { device_id: string }) => {
        deviceId.current = e.device_id;
        setState((s) => ({ ...s, ready: true, failed: null }));
      }) as never);

      p.addListener("not_ready", (() => {
        setState((s) => ({ ...s, ready: false }));
      }) as never);

      // Los tres errores que de verdad ocurren: cuenta sin Premium, navegador
      // sin DRM (EME) y token caducado.
      const fail = (msg: string) => ((e: { message: string }) => {
        setState((s) => ({ ...s, ready: false, failed: `${msg}: ${e.message}` }));
      }) as never;

      p.addListener("account_error", fail("Cuenta"));
      p.addListener("initialization_error", fail("Este navegador"));
      p.addListener("authentication_error", fail("Sesión"));

      p.addListener("player_state_changed", ((s: {
        paused: boolean;
        position: number;
        duration: number;
        shuffle: boolean;
        track_window: {
          current_track: {
            name: string;
            album: { name: string; images: { url: string }[] };
            artists: { name: string }[];
          };
        };
      } | null) => {
        if (!s) return;
        const t = s.track_window.current_track;
        setState((prev) => ({
          ...prev,
          playing: !s.paused,
          position: s.position,
          duration: s.duration,
          shuffle: s.shuffle,
          track: {
            name: t.name,
            artists: t.artists.map((a) => a.name).join(", "),
            album: t.album.name,
            cover: t.album.images[0]?.url ?? null,
          },
        }));
      }) as never);

      p.connect();
      player.current = p;
    }

    if (window.Spotify) {
      build();
    } else {
      window.onSpotifyWebPlaybackSDKReady = build;
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      player.current?.disconnect();
      player.current = null;
    };
  }, []);

  // El SDK sólo avisa al cambiar de estado, así que entre canción y canción la
  // posición se quedaría congelada. Se avanza en local mientras suena.
  useEffect(() => {
    if (!state.playing) return;
    const id = setInterval(
      () => setState((s) => ({ ...s, position: Math.min(s.position + 1000, s.duration) })),
      1000,
    );
    return () => clearInterval(id);
  }, [state.playing]);

  const call = useCallback(async (path: string, method: string, body?: unknown) => {
    const token = await accessToken();
    if (!token) return;
    await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }, []);

  /** Arranca la lista en nuestro dispositivo. Es el gesto que iOS exige. */
  const playPlaylist = useCallback(async () => {
    if (!deviceId.current) return;
    await call(`/me/player/play?device_id=${deviceId.current}`, "PUT", {
      context_uri: playlistUri,
    });
  }, [call, playlistUri]);

  const toggle = useCallback(async () => {
    // Si todavía no hay nada cargado, el primer play pone la lista entera.
    if (!state.track) await playPlaylist();
    else await player.current?.togglePlay();
  }, [state.track, playPlaylist]);

  return {
    state,
    toggle,
    next: () => player.current?.nextTrack(),
    previous: () => player.current?.previousTrack(),
    seek: (ms: number) => player.current?.seek(ms),
    setShuffle: (on: boolean) =>
      call(`/me/player/shuffle?state=${on}&device_id=${deviceId.current}`, "PUT"),
  };
}
