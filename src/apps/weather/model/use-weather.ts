import { useEffect, useState } from "react";

/** Valencia, por si el navegador no da la ubicación. */
const FALLBACK = { lat: 39.4699, lon: -0.3763, place: "Valencia" };

export interface Slot {
  key: "morning" | "noon" | "afternoon" | "night";
  label: string;
  hour: number;
  code: number;
  temp: number;
}

export interface Weather {
  place: string;
  temp: number;
  feelsLike: number;
  code: number;
  isDay: boolean;
  humidity: number;
  wind: number;
  max: number;
  min: number;
  sunrise: string;
  sunset: string;
  slots: Slot[];
  approximate: boolean;
}

type State =
  | { status: "loading" }
  | { status: "ready"; data: Weather }
  | { status: "error"; message: string };

/**
 * El tiempo de donde estéis ahora mismo.
 *
 * Dos servicios, ambos gratuitos, sin clave y con CORS abierto (comprobado el
 * 22/07/2026), así que funcionan desde un sitio estático sin backend:
 *
 * - **Open-Meteo** para la predicción.
 * - **BigDataCloud** para traducir las coordenadas a un nombre de sitio.
 *
 * Si el navegador deniega la ubicación no se falla: se cae a Valencia y se
 * marca como aproximada, para no mentir sobre de dónde son los datos.
 */
export function useWeather(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    locate()
      .then(async ({ lat, lon, approximate }) => {
        const [forecast, place] = await Promise.all([fetchForecast(lat, lon), fetchPlace(lat, lon)]);
        if (cancelled) return;
        setState({
          status: "ready",
          data: { ...forecast, place: place ?? FALLBACK.place, approximate },
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "No se pudo consultar el tiempo",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function locate(): Promise<{ lat: number; lon: number; approximate: boolean }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: FALLBACK.lat, lon: FALLBACK.lon, approximate: true });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, approximate: false }),
      // Denegado, no disponible o agotado: seguimos con Valencia.
      () => resolve({ lat: FALLBACK.lat, lon: FALLBACK.lon, approximate: true }),
      { timeout: 8000, maximumAge: 600_000 },
    );
  });
}

async function fetchForecast(lat: number, lon: number): Promise<Omit<Weather, "place" | "approximate">> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m" +
    "&hourly=temperature_2m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset" +
    "&timezone=auto&forecast_days=2";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo no responde");
  const json = await res.json();

  // Las horas vienen en la zona horaria del sitio, así que el índice 0 es la
  // medianoche de hoy y basta con sumar la hora que interesa.
  const slots: Slot[] = (
    [
      { key: "morning", label: "Mañana", hour: 9 },
      { key: "noon", label: "Mediodía", hour: 13 },
      { key: "afternoon", label: "Tarde", hour: 18 },
      { key: "night", label: "Noche", hour: 22 },
    ] as const
  ).map(({ key, label, hour }) => ({
    key,
    label,
    hour,
    code: json.hourly.weather_code[hour] ?? json.current.weather_code,
    temp: Math.round(json.hourly.temperature_2m[hour] ?? json.current.temperature_2m),
  }));

  return {
    temp: Math.round(json.current.temperature_2m),
    feelsLike: Math.round(json.current.apparent_temperature),
    code: json.current.weather_code,
    isDay: json.current.is_day === 1,
    humidity: Math.round(json.current.relative_humidity_2m),
    wind: Math.round(json.current.wind_speed_10m),
    max: Math.round(json.daily.temperature_2m_max[0]),
    min: Math.round(json.daily.temperature_2m_min[0]),
    sunrise: String(json.daily.sunrise[0]).slice(11, 16),
    sunset: String(json.daily.sunset[0]).slice(11, 16),
    slots,
  };
}

async function fetchPlace(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.city || json.locality || json.principalSubdivision || null;
  } catch {
    // El nombre del sitio es adorno: si falla, el tiempo se enseña igual.
    return null;
  }
}
