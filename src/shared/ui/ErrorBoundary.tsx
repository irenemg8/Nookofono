import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Aísla el fallo de una mini-app.
 *
 * Sin esto, un error dentro de cualquier pantalla desmonta **toda** la
 * aplicación: React tira el árbol entero y sólo queda el fondo del `body`, que
 * es un turquesa liso. Desde fuera parece que la app "no va", sin ninguna pista
 * de qué ha pasado.
 *
 * Con la barrera, el fallo se queda dentro de la app y además se ve el mensaje,
 * que es lo único que permite arreglarlo sin adivinar.
 */
interface Props {
  children: ReactNode;
  /** Nombre de la app, para saber cuál se rompió. */
  name: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en la consola con la pila completa, por si hace falta más detalle.
    console.error(`[iPug] ${this.props.name} ha fallado`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="nk-crash">
        <h2>Esta app se ha roto</h2>
        <p>{this.props.name} ha dado un error y no se puede abrir.</p>
        <pre>{this.state.error.message}</pre>
        <button type="button" className="nk-btn" onClick={() => this.setState({ error: null })}>
          Reintentar
        </button>
      </div>
    );
  }
}
