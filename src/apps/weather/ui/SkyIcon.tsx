import type { Sky } from "../model/wmo";

/**
 * Dibujos del tiempo, planos y redondeados como los iconos de las apps.
 * Un solo componente con todas las variantes: son formas simples y así
 * comparten paleta y proporciones sin repetir SVG suelto.
 */
export function SkyIcon({ sky, night = false }: { sky: Sky; night?: boolean }) {
  const sun = night ? "#FFF3B0" : "#F7D046";
  const cloud = "#FFFFFF";
  const grey = "#C9D2DE";

  return (
    <svg viewBox="0 0 64 64" className="wx-icon" aria-hidden="true">
      {sky === "clear" &&
        (night ? (
          <path
            d="M40 12a20 20 0 1 0 14 30 22 22 0 0 1-14-30Z"
            fill={sun}
          />
        ) : (
          <>
            <circle cx="32" cy="32" r="12" fill={sun} />
            {Array.from({ length: 8 }, (_, i) => (
              <rect
                key={i}
                x="30.5"
                y="8"
                width="3"
                height="8"
                rx="1.5"
                fill={sun}
                transform={`rotate(${i * 45} 32 32)`}
              />
            ))}
          </>
        ))}

      {(sky === "cloudy" || sky === "overcast") && (
        <>
          {sky === "cloudy" &&
            (night ? (
              <path d="M30 10a13 13 0 1 0 9 20 14 14 0 0 1-9-20Z" fill={sun} />
            ) : (
              <circle cx="26" cy="24" r="10" fill={sun} />
            ))}
          <path
            d="M20 46a9 9 0 0 1 1-18 13 13 0 0 1 24 3 8 8 0 0 1-1 15Z"
            fill={sky === "overcast" ? grey : cloud}
          />
        </>
      )}

      {sky === "fog" && (
        <>
          <path d="M18 36a9 9 0 0 1 1-18 13 13 0 0 1 24 3 8 8 0 0 1-1 15Z" fill={grey} />
          {[44, 51].map((y) => (
            <rect key={y} x="14" y={y} width="36" height="4" rx="2" fill={cloud} opacity="0.9" />
          ))}
        </>
      )}

      {sky === "rain" && (
        <>
          <path d="M20 38a9 9 0 0 1 1-18 13 13 0 0 1 24 3 8 8 0 0 1-1 15Z" fill={cloud} />
          {[24, 32, 40].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={44 + (i % 2) * 3}
              width="3.4"
              height="11"
              rx="1.7"
              fill="#6FB4E8"
              transform={`rotate(12 ${x} 48)`}
            />
          ))}
        </>
      )}

      {sky === "snow" && (
        <>
          <path d="M20 38a9 9 0 0 1 1-18 13 13 0 0 1 24 3 8 8 0 0 1-1 15Z" fill={cloud} />
          {[24, 32, 40].map((x, i) => (
            <circle key={x} cx={x + 1.5} cy={48 + (i % 2) * 5} r="3" fill="#BFE3F5" />
          ))}
        </>
      )}

      {sky === "storm" && (
        <>
          <path d="M20 36a9 9 0 0 1 1-18 13 13 0 0 1 24 3 8 8 0 0 1-1 15Z" fill={grey} />
          <path d="M34 40 24 54h7l-2 10 12-16h-8l3-8Z" fill={sun} />
        </>
      )}
    </svg>
  );
}
