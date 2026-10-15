import { useEffect, useRef, useState, ReactNode } from "react";
import { X, Save, Check, AlertCircle } from "lucide-react";
import { send } from "../api";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  placeholder = "",
  disabled = false,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  type?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className={"field " + (type === "textarea" ? "wide" : "")}>
      <span>{label}</span>
      {options ? (
        <select
          aria-label={label}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Selecionar</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          aria-label={label}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      ) : (
        <input
          aria-label={label}
          type={type}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) =>
            onChange(
              type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
          disabled={disabled}
        />
      )}
    </label>
  );
}
export function Dots({
  value,
  onChange,
  max = 5,
  label,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="dots" role="group" aria-label={label}>
      <button
        disabled={disabled}
        title="Zerar"
        aria-label={"Zerar " + label}
        onClick={() => onChange(0)}
        className="dot-reset"
      >
        −
      </button>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          disabled={disabled}
          title={String(i + 1)}
          aria-label={label + " " + (i + 1)}
          aria-pressed={i < value}
          className={"dot " + (i < value ? "filled" : "")}
          onClick={() => onChange(i + 1)}
        />
      ))}
      <small>{value}</small>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", fn);
    };
  }, [onClose]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button,input,select")?.focus();
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={"modal " + (wide ? "modal-wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const focus = [
            ...ref.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,select,textarea,a[href]",
            ),
          ];
          const first = focus[0],
            last = focus[focus.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">◇</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Badge({ origin }: { origin: string }) {
  const labels: Record<string, string> = {
    official: "Oficial · V5",
    custom: "Personalizado",
    variant: "Variante",
    optional: "Opcional",
    complete: "Automatizado",
    partial: "Automação parcial",
    narrative: "Resolução narrativa",
    unreviewed: "Revisão pendente",
  };
  return <span className={"badge " + origin}>{labels[origin] || origin}</span>;
}
export function CheckBox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
const saveCallbacks = new Set<() => Promise<void>>();
export async function flushAll() {
  for (const cb of saveCallbacks) await cb();
}
export function useAutosave<T extends { id: string; version: number }>(
  initial: T,
  refresh: () => Promise<void>,
) {
  const [value, setValue] = useState(initial),
    [status, setStatus] = useState("Salvo"),
    [error, setError] = useState("");
  const latest = useRef(initial),
    version = useRef(initial.version),
    dirty = useRef(false),
    inflight = useRef<Promise<void> | null>(null),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      mounted.current = false;
      clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (
      initial.version > version.current &&
      !dirty.current &&
      !inflight.current
    ) {
      version.current = initial.version;
      latest.current = initial;
      setValue(initial);
    }
  }, [initial]);
  function update(next: T) {
    latest.current = next;
    dirty.current = true;
    setValue(next);
    setStatus("Alterações pendentes");
    setError("");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 900);
  }
  async function flush(): Promise<void> {
    clearTimeout(timer.current);
    if (inflight.current) {
      await inflight.current;
      if (dirty.current) return flush();
      return;
    }
    if (!dirty.current) return;
    const snapshot = latest.current;
    dirty.current = false;
    setStatus("Salvando…");
    const task = send(
      "/entities/" + snapshot.id,
      { ...snapshot, version: version.current },
      "PUT",
    )
      .then(async (result) => {
        version.current = result.version;
        latest.current = { ...latest.current, version: result.version };
        if (mounted.current) {
          setValue(latest.current);
          setStatus(dirty.current ? "Alterações pendentes" : "Salvo");
        }
        await refresh();
      })
      .catch((e) => {
        dirty.current = true;
        if (mounted.current) {
          setStatus("Falha ao salvar");
          setError(e.message);
        }
        throw e;
      })
      .finally(() => {
        inflight.current = null;
      });
    inflight.current = task;
    await task;
    if (dirty.current) return flush();
  }
  useEffect(() => {
    saveCallbacks.add(flush);
    return () => {
      saveCallbacks.delete(flush);
    };
  }, []);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, []);
  return { value, update, flush, status, error };
}
export function SaveState({
  status,
  error,
  flush,
}: {
  status: string;
  error: string;
  flush: () => Promise<void>;
}) {
  return (
    <div className="save-status" aria-live="polite">
      {error ? (
        <AlertCircle size={15} />
      ) : status === "Salvo" ? (
        <Check size={15} />
      ) : (
        <Save size={15} />
      )}
      <span>{error || status}</span>
      {error && (
        <button onClick={() => void flush().catch(() => {})}>
          Tentar salvar
        </button>
      )}
    </div>
  );
}
