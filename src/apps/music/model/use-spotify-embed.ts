import { useEffect, useRef, useState } from "react";

const API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

interface PlaybackData {
  isPaused: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
}

interface Controller {
  togglePlay(): void;
  addListener(event: "ready", cb: () => void): void;
  addListener(event: "playback_update", cb: (e: { data: PlaybackData }) => void): void;
  destroy(): void;
}

interface IFrameAPI {
  createController(
    host: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    cb: (controller: Controller) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

export interface PlayerState {
  ready: boolean;
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
}

/**
 * Reproductor de la lista compartida, con el *embed* oficial de Spotify.
 *
 * Se usa el embed y no la Web API por una razón de peso: desde febrero de 2026
 * la Web API exige que **el dueño de la aplicación tenga Premium activo**, y si
 * la suscripción caduca la app deja de funcionar. El Web Playback SDK además
 * exige Premium a quien escucha. El embed, en cambio, no necesita ni clave, ni
 * inicio de sesión, ni backend: funciona para cualquiera, con reproducción
 * completa si estás logueado en Spotify y adelantos si no.
 *
 * Lo que sí aporta la *iframe API* sobre un `<iframe>` pelado es que emite
 * eventos de reproducción, y con ellos el disco puede girar de verdad al
 * ritmo de lo que suena en vez de fingirlo.
 */
export function useSpotifyEmbed(uri: string) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const [state, setState] = useState<PlayerState>({
    ready: false,
    playing: false,
    buffering: false,
    position: 0,
    duration: 0,
  });

  useEffect(() => {
    let cancelled = false;

    function build(api: IFrameAPI) {
      if (cancelled || !hostRef.current) return;

      api.createController(hostRef.current, { uri, width: "100%", height: 352 }, (c) => {
        if (cancelled) {
          c.destroy();
          return;
        }
        controller.current = c;

        c.addListener("ready", () => setState((s) => ({ ...s, ready: true })));
        c.addListener("playback_update", (e) =>
          setState({
            ready: true,
            playing: !e.data.isPaused,
            buffering: e.data.isBuffering,
            position: e.data.position,
            duration: e.data.duration,
          }),
        );
      });
    }

    // El script sólo llama a `onSpotifyIframeApiReady` una vez, así que si ya
    // se cargó antes hay que reutilizar la instancia guardada.
    const cached = (window as { __spotifyIframeApi?: IFrameAPI }).__spotifyIframeApi;
    if (cached) {
      build(cached);
      return () => {
        cancelled = true;
      };
    }

    window.onSpotifyIframeApiReady = (api) => {
      (window as { __spotifyIframeApi?: IFrameAPI }).__spotifyIframeApi = api;
      build(api);
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = API_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      controller.current?.destroy();
      controller.current = null;
    };
  }, [uri]);

  return {
    hostRef,
    state,
    toggle: () => controller.current?.togglePlay(),
  };
}

/**
 * Título y portada de la lista, vía oEmbed.
 *
 * Es un endpoint público, sin clave y con CORS abierto (comprobado el
 * 22/07/2026), así que se puede llamar directamente desde el navegador.
 */
export function usePlaylistInfo(playlistUrl: string) {
  const [info, setInfo] = useState<{ title: string; cover: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(playlistUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setInfo({ title: json.title, cover: json.thumbnail_url });
      })
      .catch(() => {
        // Es sólo el adorno del disco: si falla, el reproductor va igual.
      });

    return () => {
      cancelled = true;
    };
  }, [playlistUrl]);

  return info;
}
