import { useState } from "react";
import {
  AlchemyActivation,
  AlchemyFormulaTest,
  Character,
  Campaign,
} from "../../shared/model";
import { evaluate } from "../../shared/rules";
import { turnKey } from "../../shared/blood-mechanics";
import { flightModes } from "../../shared/alchemy-flight";
import { longReachModes } from "../../shared/alchemy-formulas";
import { CheckBox, Field, Modal } from "./ui";

export function LongReach({
  c,
  a,
  characters,
  campaign,
  edit,
  gm,
  run,
}: {
  c: Character;
  a: AlchemyActivation;
  characters: Character[];
  campaign?: Campaign;
  edit: boolean;
  gm: boolean;
  run: (data: any) => Promise<any>;
}) {
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = a.formulaTests.find((t) => t.status === "pending");
  async function resolve(t: AlchemyFormulaTest) {
    setBusy(true);
    setError("");
    try {
      await run({
        operation: "acceptFormulaTest",
        activationId: a.id,
        testId: t.id,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wide" aria-label="Usos de Longo Alcance">
      <h4>Usar Longo Alcance</h4>
      <p className="hint">
        Alvo à vista, menos de 100 kg e cerca de 10 metros. Sustentar exige
        Determinação + Alquimia, dificuldade 3, a cada turno. Puxar não aplica
        agarramento. Objetos deslocados não causam dano; objetos frágeis, queda
        e altura ficam para o Narrador.
      </p>
      {a.longReach.sustaining && a.status === "active" && (
        <p className="callout">
          Sustentação ativa.{" "}
          {a.longReach.lastHeldTurn === turnKey(c, campaign)
            ? "Teste deste turno já resolvido."
            : "Resolva a manutenção neste turno antes de avançar novamente."}
        </p>
      )}
      {edit && a.status === "active" && !pending && (
        <button
          className="secondary"
          disabled={a.longReach.lastActionTurn === turnKey(c, campaign)}
          onClick={() => setModal(true)}
        >
          Usar fórmula ativa
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {a.formulaTests
        .slice(-8)
        .reverse()
        .map((t) => (
          <div className="panel" key={t.id}>
            <strong>
              {t.mode === "suffocate"
                ? "Sufocar mortal"
                : t.mode in flightModes
                  ? flightModes[t.mode as keyof typeof flightModes]
                  : longReachModes[t.mode as keyof typeof longReachModes]}{" "}
              · {t.object}
            </strong>
            <small>
              {t.status === "pending"
                ? "Dados em revisão; efeito ainda não aplicado"
                : t.status === "cancelled"
                  ? "Teste cancelado pelo avanço de tempo ou encerramento"
                  : "Teste resolvido"}
            </small>
            <FormulaDice t={t} />
            {t.outcome && <p>{t.outcome.message}</p>}
            {t.note && <p className="hint">{t.note}</p>}
            {edit && t.status === "pending" && (
              <div className="row">
                <FormulaReroll t={t} side="actor" a={a} run={run} />
                {t.opposition && (
                  <FormulaReroll t={t} side="opposition" a={a} run={run} />
                )}
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => resolve(t)}
                >
                  Aceitar dados e resolver uso
                </button>
              </div>
            )}
          </div>
        ))}
      {modal && (
        <UseDialog
          {...{ c, a, characters, gm, run }}
          onClose={() => setModal(false)}
        />
      )}
    </section>
  );
}
export function FormulaDice({ t }: { t: AlchemyFormulaTest }) {
  const opposition = t.opposition
    ? evaluate(t.opposition.normal, t.opposition.hunger, 0).successes
    : 0;
  return (
    <>
      {(["actor", "opposition"] as const).map((side) => {
        const d = t[side],
          review = side === "actor" ? t.actorReview : t.oppositionReview;
        if (!d) return null;
        const r = evaluate(
          d.normal,
          d.hunger,
          side === "actor"
            ? t.opposition
              ? opposition + (t.mode === "ground" ? 1 : 0)
              : t.difficulty
            : t.mode === "ground"
              ? evaluate(t.actor!.normal, t.actor!.hunger, 0).successes
              : 0,
        );
        return (
          <div key={side}>
            <p>
              {side === "actor"
                ? "Usuário"
                : t.mode === "ground"
                  ? "Oponente que puxa ao chão"
                  : "Resistência do alvo"}
              : {r.successes} sucesso(s)
              {(side === "actor" || t.mode === "ground") && (
                <>
                  {" "}
                  · {r.label}
                  {t.mode === "throw" && r.margin === 0
                    ? " · empate sem arremesso ou dano"
                    : ""}
                </>
              )}
            </p>
            <div
              className="dice-row"
              aria-label={
                side === "actor" ? "Dados do usuário" : "Dados da resistência"
              }
            >
              {d.normal.map((v, i) => (
                <span className="die" key={`n${i}`}>
                  {v}
                </span>
              ))}
              {d.hunger.map((v, i) => (
                <span
                  className="die hunger"
                  key={`h${i}`}
                  title="Dado de Fome, não pode ser rerrolado"
                >
                  {v}
                </span>
              ))}
            </div>
            {review.original && (
              <small>
                Normais anteriores: {review.original.normal.join(", ")} · Fome
                preservada: {review.original.hunger.join(", ") || "nenhum"}
              </small>
            )}
          </div>
        );
      })}
    </>
  );
}
export function FormulaReroll({
  t,
  side,
  a,
  run,
}: {
  t: AlchemyFormulaTest;
  side: "actor" | "opposition";
  a: AlchemyActivation;
  run: (data: any) => Promise<any>;
}) {
  const [open, setOpen] = useState(false),
    [indices, setIndices] = useState<number[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const d = t[side],
    review = side === "actor" ? t.actorReview : t.oppositionReview;
  if (!d || review.rerolled || !d.normal.length) return null;
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await run({
        operation: "rerollFormulaTest",
        activationId: a.id,
        testId: t.id,
        side,
        indices,
      });
      setOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="secondary" onClick={() => setOpen(true)}>
        Rerrolar{" "}
        {side === "actor"
          ? "usuário"
          : t.mode === "ground"
            ? "oponente"
            : "resistência"}
      </button>
      {open && (
        <Modal
          title={`Rerrolar ${side === "actor" ? "usuário" : t.mode === "ground" ? "oponente" : "resistência"}`}
          onClose={() => setOpen(false)}
        >
          <p>
            Selecione até três dados normais. Custa um ponto de Força de Vontade
            de quem rolou, superficial sem divisão. Dados de Fome são
            preservados.
          </p>
          <div className="row">
            {d.normal.map((v, i) => (
              <CheckBox
                key={i}
                label={`Dado normal ${i + 1}: ${v}`}
                checked={indices.includes(i)}
                onChange={(yes) =>
                  setIndices(
                    yes
                      ? [...indices, i].slice(-3)
                      : indices.filter((x) => x !== i),
                  )
                }
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={busy || !indices.length}
            onClick={submit}
          >
            Gastar Vontade e rerrolar
          </button>
        </Modal>
      )}
    </>
  );
}
function UseDialog({
  c,
  a,
  characters,
  gm,
  run,
  onClose,
}: {
  c: Character;
  a: AlchemyActivation;
  characters: Character[];
  gm: boolean;
  run: (data: any) => Promise<any>;
  onClose: () => void;
}) {
  const [data, setData] = useState({
    mode: "move",
    targetId: "",
    object: "",
    weightKg: 1,
    sceneConfirmed: false,
    difficulty: 3,
    note: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (key: string, value: any) =>
    setData({ ...data, [key]: value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await run({
        operation: "formulaTest",
        activationId: a.id,
        ...data,
        targetId: ["pull", "throw", "hold"].includes(data.mode)
          ? data.targetId
          : "",
      });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Usar fórmula ativa" onClose={onClose}>
      <form onSubmit={submit}>
        <Field
          label="Uso de Longo Alcance"
          value={data.mode}
          onChange={(v) => change("mode", v)}
          options={Object.entries(longReachModes)
            .filter(([key]) => gm || !["knife", "delicate"].includes(key))
            .map(([value, label]) => ({ value, label }))}
        />
        {["pull", "throw", "hold"].includes(data.mode) && (
          <Field
            label="Alvo da fórmula (vazio para objeto ao sustentar)"
            value={data.targetId}
            onChange={(v) => change("targetId", v)}
            options={characters
              .filter((x) => x.id !== c.id && x.campaignId === c.campaignId)
              .map((x) => ({ value: x.id, label: x.name }))}
          />
        )}
        <Field
          label="Objeto ou ação na cena"
          value={data.object}
          onChange={(v) => change("object", v)}
        />
        <Field
          label="Peso estimado em kg (menor que 100)"
          type="number"
          value={data.weightKg}
          onChange={(v) => change("weightKg", v)}
        />
        {["delicate", "knife"].includes(data.mode) && (
          <>
            <Field
              label="Dificuldade definida pelo Narrador"
              type="number"
              value={data.difficulty}
              onChange={(v) => change("difficulty", v)}
            />
            <p className="hint">
              Manipulação delicada usa Raciocínio + Alquimia. Precisão com
              faca/ferramenta usa Determinação + Alquimia −2. O ataque de faca e
              seu bônus +1 de dano são resolvidos separadamente.
            </p>
          </>
        )}
        {data.mode === "hold" && (
          <p className="callout">
            Determinação + Alquimia, dificuldade 3. Novo teste necessário a cada
            turno; falhar encerra a sustentação. Reação de pessoa que resiste e
            dano de queda exigem Narrador.
          </p>
        )}
        <Field
          label="Registro da interpretação"
          type="textarea"
          value={data.note}
          onChange={(v) => change("note", v)}
        />
        <CheckBox
          label="Confirmo alvo à vista, com menos de 100 kg e a cerca de 10 metros"
          checked={data.sceneConfirmed}
          onChange={(v) => change("sceneConfirmed", v)}
        />
        <p className="hint">
          Registra um uso desta ativação por turno. Nenhum Despertar ou consumo
          é repetido. Os dados ficam disponíveis para revisão antes da
          resolução.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="primary"
          disabled={busy || !data.sceneConfirmed}
        >
          Registrar teste da fórmula
        </button>
      </form>
    </Modal>
  );
}
