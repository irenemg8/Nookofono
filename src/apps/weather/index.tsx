import airlinesIcon from "../../assets/airlines.webp";
import { useWeather } from "./model/use-weather";
import { describe, skyOf } from "./model/wmo";
import { SkyIcon } from "./ui/SkyIcon";
import "./weather.css";

export default function WeatherApp() {
  const state = useWeather();

  if (state.status === "loading") {
    return <p className="wx-note">Mirando por la ventana…</p>;
  }

  if (state.status === "error") {
    return <p className="wx-note">{state.message}</p>;
  }

  const w = state.data;
  const sky = skyOf(w.code);

  return (
    <div className="wx">
      <section className={`wx-sky${w.isDay ? "" : " wx-sky--night"}`}>
        <div className="wx-sky__top">
          <span className="wx-brand">
            <img src={airlinesIcon} alt="" />
            PugPug Airlines
          </span>
        </div>

        <div className="wx-sky__hero">
          <div className="wx-temp">
            <div className="wx-temp__now">{w.temp}°</div>
            <div className="wx-temp__range">
              Máx {w.max}° · Mín {w.min}°
            </div>
          </div>
          <SkyIcon sky={sky} night={!w.isDay} />
        </div>

        <span className="wx-pill">{describe(w.code)}</span>

        <p className="wx-place">
          {w.place}
          {w.approximate && " · ubicación aproximada"}
        </p>
      </section>

      <section className="wx-slots">
        {w.slots.map((slot) => {
          const s = skyOf(slot.code);
          const night = slot.key === "night";
          const grey = s === "overcast" || s === "rain" || s === "fog" || s === "storm";

          return (
            <div
              key={slot.key}
              className={`wx-slot${night ? " wx-slot--night" : grey ? " wx-slot--grey" : ""}`}
            >
              <div className="wx-slot__tile">
                <SkyIcon sky={s} night={night} />
              </div>
              <span className="wx-slot__temp">{slot.temp}°</span>
              <span className="wx-slot__label">{slot.label}</span>
            </div>
          );
        })}
      </section>

      <div className="wx-details">
        <dl className="wx-detail">
          <dt>Sensación</dt>
          <dd>{w.feelsLike}°</dd>
        </dl>
        <dl className="wx-detail">
          <dt>Humedad</dt>
          <dd>{w.humidity} %</dd>
        </dl>
        <dl className="wx-detail">
          <dt>Viento</dt>
          <dd>{w.wind} km/h</dd>
        </dl>
        <dl className="wx-detail">
          <dt>Sol</dt>
          <dd>
            {w.sunrise} – {w.sunset}
          </dd>
        </dl>
      </div>

      <p className="wx-note">Datos de Open-Meteo</p>
    </div>
  );
}
