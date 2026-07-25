import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import "./shopping.css";

interface Product {
  id: string;
  name: string;
  packaging: string;
  thumbnail: string;
  priceCents: number;
  category: string;
  favorite: boolean;
  position: number;
  createdAt: number;
  updatedAt: number;
}

interface CartLine {
  id: string;
  productId: string;
  quantity: number;
  checked: boolean;
  position: number;
  name: string;
  packaging: string;
  thumbnail: string;
  priceCents: number;
  createdAt: number;
  updatedAt: number;
}

function euros(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) throw new Error("request failed");
  if (res.status === 204) return undefined as T;
  return res.json();
}

export default function ShoppingApp() {
  const [cart, setCart] = useState<CartLine[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<CartLine | null>(null);

  async function loadCart() {
    try {
      const data = await fetchJSON<CartLine[]>("/api/mercadona/cart");
      setCart(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    loadCart();
  }, []);

  async function patchLine(id: string, patch: Partial<Pick<CartLine, "quantity" | "checked" | "position">>) {
    setCart((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) : prev));
    await fetchJSON(`/api/mercadona/cart/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    loadCart();
  }

  async function removeLine(id: string) {
    setCart((prev) => (prev ? prev.filter((l) => l.id !== id) : prev));
    await fetchJSON(`/api/mercadona/cart/${id}`, { method: "DELETE" });
    loadCart();
  }

  async function addToCart(productId: string) {
    await fetchJSON<CartLine>("/api/mercadona/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    loadCart();
  }

  async function clearChecked() {
    await fetchJSON<{ removed: number }>("/api/mercadona/cart/clear-checked", { method: "POST" });
    loadCart();
  }

  if (status === "loading") return <p className="sh-empty">Cargando…</p>;
  if (status === "error" || !cart) return <p className="sh-empty">No se pudo cargar. Comprueba la conexión.</p>;

  const unchecked = cart.filter((l) => !l.checked).sort((a, b) => a.position - b.position);
  const checked = cart.filter((l) => l.checked).sort((a, b) => a.position - b.position);
  const ordered = [...unchecked, ...checked];
  const total = cart.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const hasChecked = checked.length > 0;

  return (
    <div className="sh">
      <button type="button" className="sh-new" onClick={() => setAdding(true)}>
        + Añadir productos
      </button>

      {ordered.length === 0 ? (
        <p className="sh-empty">El carrito está vacío. Añade productos.</p>
      ) : (
        <ul className="sh-list">
          {ordered.map((line) => (
            <CartRow
              key={line.id}
              line={line}
              onToggle={() => patchLine(line.id, { checked: !line.checked })}
              onQuantity={(q) => patchLine(line.id, { quantity: q })}
              onRemove={() => setPending(line)}
            />
          ))}
        </ul>
      )}

      <div className="sh-summary">
        <div className="sh-summary__total">
          <span>Total aproximado</span>
          <strong>{euros(total)}</strong>
        </div>
        {hasChecked && (
          <button type="button" className="nk-btn nk-btn--ghost sh-clear" onClick={clearChecked}>
            Quitar lo cogido
          </button>
        )}
      </div>

      {adding && (
        <AddPanel
          cart={cart}
          onClose={() => setAdding(false)}
          onAdd={addToCart}
        />
      )}

      {pending && (
        <ConfirmDialog
          title="¿Quitar del carrito?"
          body={`Se quita «${pending.name}».`}
          confirmLabel="Quitar"
          onConfirm={() => {
            removeLine(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

function CartRow({
  line,
  onToggle,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  onToggle: () => void;
  onQuantity: (q: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className={`sh-item${line.checked ? " sh-item--checked" : ""}`}>
      <button
        type="button"
        className="sh-check"
        aria-pressed={line.checked}
        aria-label={line.checked ? "Marcar como no cogido" : "Marcar como cogido"}
        onClick={onToggle}
      >
        {line.checked && (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </button>

      <img className="sh-thumb" src={line.thumbnail} alt="" loading="lazy" />

      <div className="sh-body">
        <strong className="sh-title">{line.name}</strong>
        <div className="sh-meta">
          <span>{line.packaging}</span>
          <span className="sh-price">{euros(line.priceCents)}</span>
        </div>
      </div>

      <div className="sh-qty">
        <button
          type="button"
          className="sh-qty__btn"
          aria-label="Quitar una unidad"
          onClick={() => (line.quantity <= 1 ? onRemove() : onQuantity(line.quantity - 1))}
        >
          −
        </button>
        <span className="sh-qty__count">{line.quantity}</span>
        <button
          type="button"
          className="sh-qty__btn"
          aria-label="Añadir una unidad"
          onClick={() => onQuantity(line.quantity + 1)}
        >
          +
        </button>
      </div>

      <button type="button" className="nk-remove sh-item__remove" aria-label={`Quitar ${line.name}`} onClick={onRemove}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function AddPanel({
  cart,
  onClose,
  onAdd,
}: {
  cart: CartLine[];
  onClose: () => void;
  onAdd: (productId: string) => void;
}) {
  const [favorites, setFavorites] = useState<Product[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchJSON<Product[]>("/api/mercadona/products")
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      fetchJSON<Product[]>(`/api/mercadona/products?q=${encodeURIComponent(q)}`)
        .then((data) => {
          setResults(data);
          setSearching(false);
        })
        .catch(() => {
          setResults([]);
          setSearching(false);
        });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const inCart = new Set(cart.map((l) => l.productId));
  const list = query.trim() ? results : favorites;

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Añadir productos</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <input
          className="sh-search"
          value={query}
          placeholder="Buscar en el catálogo…"
          onChange={(e) => setQuery(e.target.value)}
        />

        {list === null ? (
          <p className="sh-empty">Cargando…</p>
        ) : searching ? (
          <p className="sh-empty">Buscando…</p>
        ) : list.length === 0 ? (
          <p className="sh-empty">
            {query.trim() ? "Sin resultados para esa búsqueda." : "Aún no hay favoritos guardados."}
          </p>
        ) : (
          <ul className="nk-sheet__list sh-panel-list">
            {list.map((product) => (
              <li key={product.id} className="sh-panel-item">
                <img className="sh-thumb sh-thumb--sm" src={product.thumbnail} alt="" loading="lazy" />
                <div className="sh-body">
                  <strong className="sh-title">{product.name}</strong>
                  <div className="sh-meta">
                    <span>{product.packaging}</span>
                    <span className="sh-price">{euros(product.priceCents)}</span>
                  </div>
                </div>
                {inCart.has(product.id) ? (
                  <span className="sh-in-cart">En el carrito</span>
                ) : (
                  <button
                    type="button"
                    className="nk-btn nk-btn--sm"
                    onClick={() => onAdd(product.id)}
                  >
                    Añadir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
