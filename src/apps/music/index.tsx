import { useState } from "react";
import { hasSession, isConfigured, login, logout, redirectUri } from "./model/spotify-auth";
import { usePlaylistInfo, useSpotifyEmbed } from "./model/use-spotify-embed";
import { useSpotifyPlayer } from "./model/use-spotify-player";
import "./music.css";

/** La lista compartida de Irene y Vicente. */
const PLAYLIST_ID = "7MoqMt8vUbuC16bGHyUdPl";
const PLAYLIST_URL = `https://open.spotify.com/playlist/${PLAYLIST_ID}`;
const PLAYLIST_URI = `spotify:playlist:${PLAYLIST_ID}`;

export default function MusicApp() {
  const info = usePlaylistInfo(PLAYLIST_URL);
  const [signedIn, setSignedIn] = useState(hasSession);

  if (!isConfigured()) return <Setup />;

  if (!signedIn) {
    return (
      <div className="mu">
        <Turntable cover={info?.cover ?? null} title={info?.title} playing={false} />
        <div className="mu-card">
          <p>Inicia sesión en Spotify para manejar el tocadiscos desde aquí.</p>
          <button type="button" className="nk-btn" onClick={login}>
            Conectar con Spotify
          </button>
        </div>
      </div>
    );
  }

  return <Player info={info} onLogout={() => (logout(), setSignedIn(false))} />;
}

/* ------------------------------------------------------------- reproductor */

function Player({
  info,
  onLogout,
}: {
  info: { title: string; cover: string } | null;
  onLogout: () => void;
}) {
  const { state, toggle, next, previous, seek, setShuffle } = useSpotifyPlayer(PLAYLIST_URI);

  // Si el SDK no arranca (plan sólo móvil, navegador sin DRM…), el reproductor
  // incrustado sigue funcionando y no se pierde la música.
  if (state.failed) return <EmbedFallback info={info} reason={state.failed} />;

  const cover = state.track?.cover ?? info?.cover ?? null;
  const progress = state.duration > 0 ? (state.position / state.duration) * 100 : 0;

  return (
    <div className="mu">
      <Turntable cover={cover} title={info?.title} playing={state.playing} />

      <div className="mu-now">
        <div className="mu-now__title">{state.track?.name ?? info?.title ?? "Vuestra lista"}</div>
        <div className="mu-now__state">
          {state.track?.artists ?? (state.ready ? "Toca para empezar" : "Preparando el plato…")}
        </div>
      </div>

      <input
        className="mu-seek"
        type="range"
        min={0}
        max={state.duration || 1}
        value={state.position}
        disabled={!state.track}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Avanzar en la canción"
      />
      <div className="mu-times">
        <span>{clock(state.position)}</span>
        <span>{clock(state.duration)}</span>
      </div>

      <div className="mu-controls">
        <button
          type="button"
          className={`mu-side${state.shuffle ? " mu-side--on" : ""}`}
          onClick={() => setShuffle(!state.shuffle)}
          aria-label="Modo aleatorio"
        >
          <ShuffleIcon />
        </button>

        <button type="button" className="mu-side" onClick={previous} aria-label="Anterior">
          <PrevIcon />
        </button>

        <button
          type="button"
          className="mu-play"
          onClick={toggle}
          disabled={!state.ready}
          aria-label={state.playing ? "Pausar" : "Reproducir"}
        >
          {state.playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button type="button" className="mu-side" onClick={next} aria-label="Siguiente">
          <NextIcon />
        </button>

        <button type="button" className="mu-side" onClick={onLogout} aria-label="Cerrar sesión">
          <ExitIcon />
        </button>
      </div>

      <div className="mu-progress" aria-hidden="true">
        <div className="mu-progress__fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- respaldo */

function EmbedFallback({
  info,
  reason,
}: {
  info: { title: string; cover: string } | null;
  reason: string;
}) {
  const { hostRef, state, toggle } = useSpotifyEmbed(PLAYLIST_URI);

  return (
    <div className="mu">
      <Turntable cover={info?.cover ?? null} title={info?.title} playing={state.playing} />

      <div className="mu-controls">
        <button
          type="button"
          className="mu-play"
          onClick={toggle}
          disabled={!state.ready}
          aria-label={state.playing ? "Pausar" : "Reproducir"}
        >
          {state.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      <div className="mu-list">
        <div ref={hostRef} />
      </div>

      <p className="mu-note">{reason}. Se usa el reproductor incrustado.</p>
    </div>
  );
}

/* --------------------------------------------------------------- montaje */

function Setup() {
  return (
    <div className="mu-card mu-card--setup">
      <h2>Falta configurar Spotify</h2>
      <ol>
        <li>
          Entra en <b>developer.spotify.com/dashboard</b> y crea una app.
        </li>
        <li>
          Marca <b>Web API</b> y <b>Web Playback SDK</b>.
        </li>
        <li>
          Añade esta URL de redirección, exactamente igual:
          <code>{redirectUri()}</code>
        </li>
        <li>
          Copia el <b>Client ID</b> y pásamelo.
        </li>
      </ol>
      <p className="mu-note">
        El Client ID no es un secreto: en el flujo PKCE va en el navegador a propósito.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- tocadiscos */

function Turntable({
  cover,
  title,
  playing,
}: {
  cover: string | null;
  title?: string;
  playing: boolean;
}) {
  return (
    <section className="mu-deck">
      <div className="mu-deck__plate">
        <div className={`mu-vinyl${playing ? " mu-vinyl--on" : ""}`}>
          <div className="mu-label">{cover && <img src={cover} alt="" draggable={false} />}</div>
        </div>

        <div className={`mu-arm${playing ? " mu-arm--on" : ""}`} aria-hidden="true">
          <span className="mu-arm__pivot" />
          <span className="mu-arm__rod" />
          <span className="mu-arm__head" />
        </div>
      </div>

      {title && <p className="mu-deck__caption">{title}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ iconos */

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.2c0-.9 1-1.5 1.8-1L19 11.1c.7.5.7 1.4 0 1.8L9.8 19.8c-.8.5-1.8-.1-1.8-1V5.2Z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="4" width="4.5" height="16" rx="1.6" />
    <rect x="13.5" y="4" width="4.5" height="16" rx="1.6" />
  </svg>
);

const PrevIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 5.5a1 1 0 0 1 2 0v13a1 1 0 0 1-2 0v-13ZM18.5 5.6v12.8c0 .8-.9 1.3-1.6.9l-9-6.4a1.1 1.1 0 0 1 0-1.8l9-6.4c.7-.4 1.6.1 1.6.9Z" />
  </svg>
);

const NextIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17 5.5a1 1 0 0 0-2 0v13a1 1 0 0 0 2 0v-13ZM5.5 5.6v12.8c0 .8.9 1.3 1.6.9l9-6.4a1.1 1.1 0 0 0 0-1.8l-9-6.4c-.7-.4-1.6.1-1.6.9Z" />
  </svg>
);

const ShuffleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 6h4l10 12h4M3 18h4l3-3.6M14 8.4 17 6h4" strokeLinecap="round" />
    <path d="m18 3 3 3-3 3M18 15l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ExitIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function clock(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
