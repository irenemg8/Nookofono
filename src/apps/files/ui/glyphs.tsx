import type { Kind } from "../model/types";

/** Iconos de tipo de fichero, blancos sobre el cuadro de color de cada familia. */

export function FolderGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h7A1.5 1.5 0 0 1 19 8.5v9A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5v-11Z" />
    </svg>
  );
}

export function FileGlyph({ kind }: { kind: Kind }) {
  // Base común: la hoja de papel con la esquina doblada.
  const page = (
    <path
      d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
      fill="currentColor"
      opacity="0.9"
    />
  );

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {page}
      <path d="M13 3v5h5" fill="#ffffff" opacity="0.45" />
      {kind === "sheet" && (
        <g fill="#ffffff">
          <rect x="7.5" y="11" width="9" height="1.6" rx="0.6" />
          <rect x="7.5" y="14" width="9" height="1.6" rx="0.6" />
          <rect x="11" y="11" width="1.6" height="6" rx="0.6" />
        </g>
      )}
      {kind === "image" && (
        <g fill="#ffffff">
          <circle cx="9.5" cy="12" r="1.4" />
          <path d="M7.5 17l3-3 2 2 2.5-3 1.5 4Z" />
        </g>
      )}
      {kind === "pdf" && (
        <text x="12" y="17" textAnchor="middle" fontSize="5" fontWeight="700" fill="#fff">
          PDF
        </text>
      )}
      {kind === "doc" && (
        <g fill="#ffffff">
          <rect x="7.5" y="12" width="9" height="1.5" rx="0.6" />
          <rect x="7.5" y="15" width="6" height="1.5" rx="0.6" />
        </g>
      )}
      {(kind === "text" || kind === "other") && (
        <g fill="#ffffff">
          <rect x="7.5" y="12" width="9" height="1.4" rx="0.6" />
          <rect x="7.5" y="14.6" width="9" height="1.4" rx="0.6" />
          <rect x="7.5" y="17.2" width="5" height="1.4" rx="0.6" />
        </g>
      )}
    </svg>
  );
}
