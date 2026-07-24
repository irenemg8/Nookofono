import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { useRemoteCollection } from "../../shared/lib/use-remote-collection";
import { Train } from "./ui/Train";
import { Routines } from "./ui/Routines";
import { History } from "./ui/History";
import { PRESET_SPORTS, type Routine, type SportKind, type SportSession } from "./model/types";
import "./sport.css";

type Tab = "train" | "routines" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "train", label: "Entrenar" },
  { id: "routines", label: "Rutinas" },
  { id: "history", label: "Historial" },
];

export default function SportApp() {
  const me = useCurrentUser();
  const sports = useRemoteCollection<SportKind>("/api/sport/sports");
  const sessions = useRemoteCollection<SportSession>("/api/sport/sessions");
  const routines = useRemoteCollection<Routine>("/api/sport/routines");
  const [tab, setTab] = useState<Tab>("train");

  // El catálogo se siembra solo con los deportes de siempre la primera vez.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (sports.status !== "ready" || sports.items.length > 0) return;
    seeded.current = true;
    PRESET_SPORTS.forEach((s, i) =>
      sports.create({ name: s.name, emoji: s.emoji, position: i }),
    );
  }, [sports]);

  if (sports.status === "loading") return <p className="sp-empty">Cargando…</p>;
  if (sports.status === "error") return <p className="sp-empty">{sports.error}</p>;

  return (
    <div className="sp">
      <div className="sp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="sp-tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "train" && <Train me={me} sports={sports} sessions={sessions} />}
      {tab === "routines" && <Routines me={me} routines={routines} sessions={sessions} />}
      {tab === "history" && <History me={me} sessions={sessions} />}
    </div>
  );
}
