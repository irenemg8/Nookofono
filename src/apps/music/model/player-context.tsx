import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { hasSession } from "./spotify-auth";
import { useSpotifyPlayer } from "./use-spotify-player";

/** La lista compartida de Irene y Vicente. */
export const PLAYLIST_ID = "7MoqMt8vUbuC16bGHyUdPl";
export const PLAYLIST_URL = `https://open.spotify.com/playlist/${PLAYLIST_ID}`;
export const PLAYLIST_URI = `spotify:playlist:${PLAYLIST_ID}`;

type PlayerApi = ReturnType<typeof useSpotifyPlayer> & { activate: () => void };

const PlayerContext = createContext<PlayerApi | null>(null);

/**
 * Reproductor de Spotify que vive por encima de la navegación.
 *
 * Se monta una vez, en la raíz de la app, y **no se desmonta** al salir de la
 * pantalla de Música. Por eso la canción sigue sonando cuando te vas a otra
 * app: el dispositivo de Spotify no se desconecta.
 *
 * El SDK no se carga hasta que se abre Música por primera vez (`activate`),
 * para no molestar a quien nunca use la app.
 */
export function SpotifyPlayerProvider({ children }: { children: ReactNode }) {
  // Sólo tiene sentido si hay sesión de Spotify; si no, ni se activa.
  const [active, setActive] = useState(false);
  const player = useSpotifyPlayer(PLAYLIST_URI, active && hasSession());

  const api = useMemo<PlayerApi>(
    () => ({ ...player, activate: () => setActive(true) }),
    [player],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function useSpotifyPlayerContext(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("Falta SpotifyPlayerProvider");
  return ctx;
}
