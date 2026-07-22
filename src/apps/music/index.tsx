import { usePlaylistInfo, useSpotifyEmbed } from "./model/use-spotify-embed";
import "./music.css";

/** La lista compartida de Irene y Vicente. */
const PLAYLIST_ID = "7MoqMt8vUbuC16bGHyUdPl";
const PLAYLIST_URL = `https://open.spotify.com/playlist/${PLAYLIST_ID}`;
const PLAYLIST_URI = `spotify:playlist:${PLAYLIST_ID}`;

export default function MusicApp() {
  const { hostRef, state, toggle } = useSpotifyEmbed(PLAYLIST_URI);
  const info = usePlaylistInfo(PLAYLIST_URL);

  const progress = state.duration > 0 ? (state.position / state.duration) * 100 : 0;

  return (
    <div className="mu">
      <section className="mu-deck">
        <div className="mu-deck__plate">
          <div className={`mu-vinyl${state.playing ? " mu-vinyl--on" : ""}`}>
            <div className="mu-label">
              {info?.cover && <img src={info.cover} alt="" draggable={false} />}
            </div>
          </div>

          <div className={`mu-arm${state.playing ? " mu-arm--on" : ""}`} aria-hidden="true">
            <span className="mu-arm__pivot" />
            <span className="mu-arm__rod" />
            <span className="mu-arm__head" />
          </div>
        </div>

        <div className="mu-now">
          <div className="mu-now__title">{info?.title ?? "Vuestra lista"}</div>
          <div className="mu-now__state">
            {!state.ready
              ? "Poniendo el disco…"
              : state.buffering
                ? "Cargando…"
                : state.playing
                  ? "Sonando"
                  : "En pausa"}
          </div>
        </div>

        <div className="mu-progress">
          <div className="mu-progress__fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="mu-controls">
          <button
            type="button"
            className="mu-play"
            onClick={toggle}
            disabled={!state.ready}
            aria-label={state.playing ? "Pausar" : "Reproducir"}
          >
            {state.playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4.5" height="16" rx="1.6" />
                <rect x="13.5" y="4" width="4.5" height="16" rx="1.6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.2c0-.9 1-1.5 1.8-1L19 11.1c.7.5.7 1.4 0 1.8L9.8 19.8c-.8.5-1.8-.1-1.8-1V5.2Z" />
              </svg>
            )}
          </button>
        </div>
      </section>

      {/* Spotify sustituye este div por su reproductor: es la lista de temas. */}
      <div className="mu-list">
        <div ref={hostRef} />
      </div>

      <p className="mu-note">
        Con Spotify Premium suena entera; sin cuenta, adelantos de 30 segundos.
      </p>
    </div>
  );
}
