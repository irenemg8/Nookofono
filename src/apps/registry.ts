import airlinesIcon from "../assets/airlines.webp";
import archivosIcon from "../assets/archivos.webp";
import cicloIcon from "../assets/ciclo.webp";
import docsIcon from "../assets/docs.webp";
import imbecilIcon from "../assets/imbecil.webp";
import tractiveIcon from "../assets/tractive.webp";
import auxilioIcon from "../assets/auxilio_me_agobio_sobrecarga_salvame_cacahuete.webp";
import calculatorIcon from "../assets/calculadora.webp";
import calendarIcon from "../assets/calendario.webp";
import consejosIcon from "../assets/Valentin_consejos.webp";
import deporteIcon from "../assets/deporte.webp";
import fotosIcon from "../assets/fotos.webp";
import houseIcon from "../assets/casa.webp";
import incidentsIcon from "../assets/incidencias_y_reparaciones_domesticas.webp";
import moneyIcon from "../assets/gastos.webp";
import musicIcon from "../assets/spotify.webp";
import niloIcon from "../assets/nilo.webp";
import notesIcon from "../assets/notas.webp";
import problemasIcon from "../assets/problemas_a_resolver_y_charla_profunda.webp";
import profileIcon from "../assets/perfil.webp";
import sheetsIcon from "../assets/excel.webp";
import shoppingIcon from "../assets/supermercado.webp";
import tasksIcon from "../assets/lista.webp";
import weatherIcon from "../assets/tiempo.webp";

/**
 * Manifiesto de una mini-app.
 *
 * Añadir una app = añadir una entrada aquí (y, cuando tenga pantalla propia,
 * una carpeta en `src/apps/<id>/`). Quitarla = `enabled: false` o borrar la
 * entrada. Ningún otro fichero cambia: la rejilla de inicio, el dock, la
 * paginación y —en el futuro— las herramientas del LLM se generan de aquí.
 *
 * Ver docs/PROYECTO.md §4.3
 */
export interface MiniAppManifest {
  id: string;
  /** Se muestra en la interfaz, en español. */
  title: string;
  /** Icono ilustrado en WebP. Trae su propio fondo: se pinta a sangre. */
  iconSrc: string;
  path: string;
  enabled: boolean;
  /** Página de la rejilla, empezando en 1. */
  page: number;
  /**
   * Además de estar en la rejilla, aparece en la barra fija inferior (sin
   * etiqueta). Las apps del dock NO se quitan de la rejilla: salen en ambos
   * sitios, como pidió Irene.
   */
  inDock?: boolean;
  /** Se pinta atenuada: el icono existe pero la pantalla aún no. */
  comingSoon?: boolean;
  /** Frase de la burbuja de diálogo mientras no hay pantalla real. */
  teaser?: string;
}

export const registry: MiniAppManifest[] = [
  // ------------------------------------------------------------ Página 1
  {
    id: "shopping",
    title: "Compra",
    iconSrc: shoppingIcon,
    path: "/compra",
    enabled: true,
    page: 1,
    inDock: true,
    comingSoon: true,
    teaser: "Listas con precios de Mercadona y vuestros favoritos.",
  },
  {
    id: "music",
    title: "Spotify",
    iconSrc: musicIcon,
    path: "/musica",
    enabled: true,
    page: 1,
    inDock: true,
    comingSoon: true,
    teaser: "Vuestra lista compartida de Spotify.",
  },
  {
    id: "sos",
    title: "Cacahuete",
    iconSrc: auxilioIcon,
    path: "/auxilio",
    enabled: true,
    page: 1,
    inDock: true,
    comingSoon: true,
    teaser: "Bandera blanca: me agobio y necesito que me rescates.",
  },
  {
    id: "advice",
    title: "Valentín",
    iconSrc: consejosIcon,
    path: "/consejos",
    enabled: true,
    page: 1,
    inDock: true,
    comingSoon: true,
    teaser: "Los consejos de Valentín cuando hacen falta.",
  },
  {
    id: "weather",
    title: "Tiempo",
    iconSrc: weatherIcon,
    path: "/tiempo",
    enabled: true,
    page: 1,
    comingSoon: true,
    teaser: "El tiempo en Valencia y allá donde estéis.",
  },
  {
    id: "profile",
    title: "Pugporte",
    iconSrc: profileIcon,
    path: "/perfil",
    enabled: true,
    page: 1,
    comingSoon: true,
    teaser: "Vuestros pasaportes de isla, con foto, lema y sello de residente.",
  },
  {
    id: "airlines",
    title: "Pug airlines",
    iconSrc: airlinesIcon,
    path: "/pugpug",
    enabled: true,
    page: 1,
    comingSoon: true,
    teaser: "Globo terráqueo con chinchetas y líneas desde Valencia.",
  },
  {
    id: "money",
    title: "Cuentas",
    iconSrc: moneyIcon,
    path: "/dinero",
    enabled: true,
    page: 1,
    comingSoon: true,
    teaser: "Cuentas, gastos y quién debe a quién.",
  },
  {
    id: "calendar",
    title: "Calendario",
    iconSrc: calendarIcon,
    path: "/calendario",
    enabled: true,
    page: 1,
    comingSoon: true,
    teaser: "Fechas compartidas, con quién va: Irene, Vicente o los dos.",
  },
  {
    id: "notes",
    title: "Notas",
    iconSrc: notesIcon,
    path: "/notas",
    enabled: true,
    page: 1,
    comingSoon: true,
    teaser: "Blocs personales y compartidos.",
  },
  {
    id: "nilo",
    title: "Nilo",
    iconSrc: niloIcon,
    path: "/nilo",
    enabled: true,
    page: 1,
    comingSoon: true,
    teaser: "Vacunas, peso, chip, pasaporte y paseos.",
  },
  {
    id: "home",
    title: "Casa",
    iconSrc: houseIcon,
    path: "/casa",
    enabled: true,
    page: 1,
    teaser: "Las tareas del hogar, con aviso el domingo si algo queda por hacer.",
  },

  // ------------------------------------------------------------ Página 2
  {
    id: "tasks",
    title: "Tareas",
    iconSrc: tasksIcon,
    path: "/tareas",
    enabled: true,
    page: 2,
    comingSoon: true,
    teaser: "Listas de cosas por hacer, marcables.",
  },
  {
    id: "incidents",
    title: "Incidencias",
    iconSrc: incidentsIcon,
    path: "/incidencias",
    enabled: true,
    page: 2,
    teaser: "Averías y reparaciones domésticas, con plazo y aviso.",
  },
  {
    id: "calculator",
    title: "Calculadora",
    iconSrc: calculatorIcon,
    path: "/calculadora",
    enabled: true,
    page: 2,
    comingSoon: true,
    teaser: "La única que funciona entera sin servidor.",
  },
  {
    id: "sheets",
    title: "Excel",
    iconSrc: sheetsIcon,
    path: "/hojas",
    enabled: true,
    page: 2,
    comingSoon: true,
    teaser: "Hojas de cálculo ligeras.",
  },
  {
    id: "photos",
    title: "Fotos",
    iconSrc: fotosIcon,
    path: "/fotos",
    enabled: true,
    page: 2,
    teaser: "Vuestra galería compartida: subir, ver y descargar.",
  },
  {
    id: "files",
    title: "RAG-Pugtín",
    iconSrc: archivosIcon,
    path: "/archivos",
    enabled: true,
    page: 2,
    teaser: "Vuestro Drive: carpetas, ficheros, etiquetas. Alimenta a Valentín.",
  },
  {
    id: "sport",
    title: "Deporte",
    iconSrc: deporteIcon,
    path: "/deporte",
    enabled: true,
    page: 2,
    teaser: "Cronómetro, rutinas y historial; cada uno el suyo.",
  },
  {
    id: "talks",
    title: "Por hablar",
    iconSrc: problemasIcon,
    path: "/charlas",
    enabled: true,
    page: 2,
    comingSoon: true,
    teaser: "Temas pendientes de hablar con calma.",
  },
  {
    id: "tractive",
    title: "Tractive",
    iconSrc: tractiveIcon,
    path: "/tractive",
    enabled: true,
    page: 2,
    teaser: "Cuando Irene busca a Vicente, le avisa al momento.",
  },
  {
    id: "cycle",
    title: "Ciclo",
    iconSrc: cicloIcon,
    path: "/ciclo",
    enabled: true,
    page: 2,
    teaser: "El ciclo de Belinda: regla, días fértiles y síntomas.",
  },
  {
    id: "imbecil",
    title: "Imbécil",
    iconSrc: imbecilIcon,
    path: "/imbecil",
    enabled: true,
    page: 3,
    teaser: "Un botón para avisar al otro cuando hace falta atención.",
  },
  {
    id: "docs",
    title: "Docs",
    iconSrc: docsIcon,
    path: "/docs",
    enabled: true,
    page: 3,
    teaser: "Documentos de texto de RAG-Pugtín: ver, editar y descargar.",
  },
];

/**
 * Apps activas en su orden por defecto (por página y, dentro de ella, por orden
 * de declaración). Es el punto de partida; a partir de ahí manda el orden que
 * Irene y Vicente hayan guardado arrastrando iconos.
 */
export const enabledApps: MiniAppManifest[] = registry
  .filter((app) => app.enabled)
  .sort((a, b) => a.page - b.page);

/** Apps de la barra fija inferior. También siguen apareciendo en la rejilla. */
export const dockApps = enabledApps.filter((app) => app.inDock);

export const appsById = new Map(enabledApps.map((app) => [app.id, app]));
