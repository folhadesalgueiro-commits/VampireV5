import { useState } from "react";
import { Moon, ArrowRight } from "lucide-react";
import { StoryClock } from "../../shared/model";
import { send } from "../api";
import { Field, Modal } from "./ui";
export function StoryClockControls({
  clock,
  id,
  editable,
  refresh,
  notify,
  beforeAdvance,
  date,
}: {
  clock: StoryClock;
  id: string;
  editable: boolean;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
  beforeAdvance?: () => Promise<void>;
  date?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  async function advance(scope: "turn" | "scene" | "night") {
    try {
      setBusy(true);
      await beforeAdvance?.();
      await send("/clock/" + id + "/advance", { scope });
      await refresh();
      notify(
        scope === "night"
          ? "Nova noite iniciada. Cada vampiro deve realizar seu Despertar."
          : "Tempo narrativo atualizado e durações resolvidas.",
      );
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="story-clock">
      <div>
        <Moon size={17} />
        <strong>
          Noite {clock.night} · Cena {clock.scene} · Turno {clock.turn}
        </strong>
        <small>
          Tempo marcado pelo Narrador; durações e limites seguem esses
          marcadores.
        </small>
        <small>
          {date
            ? "Data da crônica: " + date.split("-").reverse().join("/")
            : "Calendário da crônica ainda não definido."}
        </small>
      </div>
      {editable && (
        <div className="row">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => advance("turn")}
          >
            Avançar turno
            <ArrowRight size={14} />
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => advance("scene")}
          >
            Avançar cena
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => advance("night")}
          >
            Próxima noite
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setValue(date ?? "");
              setReason("");
              setError("");
              setEditing(true);
            }}
          >
            Definir data
          </button>
        </div>
      )}
      {editing && (
        <Modal title="Calendário da crônica" onClose={() => setEditing(false)}>
          <p>
            Escolha uma data da ficção. Após definir o calendário, Próxima noite
            acrescenta um dia. Um salto de data inicia uma nova noite e encerra
            durações menores. A decadência de Laços exige confirmar afastamento
            e desafios.
          </p>
          <Field
            label="Data da crônica"
            type="date"
            value={value}
            onChange={setValue}
          />
          <Field
            label="Motivo do avanço de data"
            value={reason}
            onChange={setReason}
          />
          {error && <p className="error">{error}</p>}
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true);
                await beforeAdvance?.();
                await send("/clock/" + id + "/date", { date: value, reason });
                await refresh();
                setEditing(false);
                notify("Calendário narrativo atualizado.");
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Salvar data da crônica
          </button>
        </Modal>
      )}
    </div>
  );
}
