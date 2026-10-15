import { useState } from "react";
import { AlchemyActivation, Character, Campaign } from "../../shared/model";
import { turnKey } from "../../shared/blood-mechanics";
import { flightSpeed } from "../../shared/alchemy-effects";
import { flightModes } from "../../shared/alchemy-flight";
import { FormulaDice, FormulaReroll } from "./LongReach";
import { CheckBox, Field, Modal } from "./ui";
export function Flight({
  c,
  a,
  characters,
  campaign,
  edit,
  run,
}: {
  c: Character;
  a: AlchemyActivation;
  characters: Character[];
  campaign?: Campaign;
  edit: boolean;
  run: (data: any) => Promise<any>;
}) {
  const [modal, setModal] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function accept(testId: string) {
    setBusy(true);
    setError("");
    try {
      await run({ operation: "acceptFormulaTest", activationId: a.id, testId });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wide" aria-label="Usos de Impulso Suspenso no Ar">
      <h4>Impulso Suspenso no Ar · {flightSpeed(a)}</h4>
      <p>
        {a.flight.airborne ? "Alquimista em voo" : "Alquimista no chão"}
        {a.flight.load ? ` · Carga: ${a.flight.load}` : ""}
      </p>
      <p className="hint">
        Voo pessoal em qualquer direção, aproximadamente em velocidade de
        corrida. Uma massa humana reduz à caminhada. Levar quem resiste e puxar
        o voador ao chão usam Força + Alquimia contra Força + Atletismo. Em
        empate, vence quem inicia a ação.
      </p>
      <p className="hint">
        Dura uma cena. Altura, espaço, contato, obstáculos, quedas e interações
        com agarramentos são resolvidos pelo Narrador. Nenhuma distância, dano
        de queda ou iniciativa adicional é presumida.
      </p>
      {edit && a.status === "active" && (
        <button
          className="secondary"
          disabled={a.formulaTests.some(
            (t) => t.status === "pending" || t.turn === turnKey(c, campaign),
          )}
          onClick={() => setModal(true)}
        >
          Usar voo alquímico
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
              {t.mode in flightModes
                ? flightModes[t.mode as keyof typeof flightModes]
                : "Uso registrado"}{" "}
              · {t.object}
            </strong>
            <small>
              {t.status === "pending"
                ? "Uso em revisão; movimento ainda não aplicado"
                : t.status === "cancelled"
                  ? "Uso cancelado pelo tempo ou encerramento"
                  : "Uso de voo resolvido"}
            </small>
            <FormulaDice t={t} />
            {t.outcome && <p>{t.outcome.message}</p>}
            {edit && t.status === "pending" && (
              <div className="row">
                <FormulaReroll {...{ t, a, run }} side="actor" />
                <FormulaReroll {...{ t, a, run }} side="opposition" />
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => accept(t.id)}
                >
                  Aceitar dados e resolver voo
                </button>
              </div>
            )}
          </div>
        ))}
      {modal && (
        <FlightDialog
          {...{ c, a, characters, run }}
          onClose={() => setModal(false)}
        />
      )}
    </section>
  );
}
function FlightDialog({
  c,
  a,
  characters,
  run,
  onClose,
}: {
  c: Character;
  a: AlchemyActivation;
  characters: Character[];
  run: (data: any) => Promise<any>;
  onClose: () => void;
}) {
  const [data, setData] = useState({
    mode: "fly",
    targetId: "",
    object: "",
    sceneConfirmed: false,
    humanMassConfirmed: false,
    consentConfirmed: false,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (key: string, value: any) => setData({ ...data, [key]: value });
  return (
    <Modal title="Usar voo alquímico" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await run({
              operation: "formulaTest",
              activationId: a.id,
              ...data,
              targetId: ["fly", "land"].includes(data.mode)
                ? ""
                : data.targetId,
            });
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Uso do voo"
          value={data.mode}
          onChange={(v) => set("mode", v)}
          options={Object.entries(flightModes).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {!["fly", "land"].includes(data.mode) && (
          <Field
            label="Participante (vazio para carga sem pessoa)"
            value={data.targetId}
            onChange={(v) => set("targetId", v)}
            options={characters
              .filter((x) => x.id !== c.id && x.campaignId === c.campaignId)
              .map((x) => ({ value: x.id, label: x.name }))}
          />
        )}
        <Field
          label="Carga ou descrição da ação de voo"
          value={data.object}
          onChange={(v) => set("object", v)}
        />
        {["carry", "capture"].includes(data.mode) && (
          <>
            <CheckBox
              label="A carga cabe em uma massa de tamanho humano"
              checked={data.humanMassConfirmed}
              onChange={(v) => set("humanMassConfirmed", v)}
            />
            {data.mode === "carry" && data.targetId && (
              <CheckBox
                label="O passageiro não oferece resistência ao transporte"
                checked={data.consentConfirmed}
                onChange={(v) => set("consentConfirmed", v)}
              />
            )}
          </>
        )}
        {data.mode === "ground" && (
          <p className="callout">
            O participante escolhido inicia a tentativa de puxar ao chão. Em
            empate ele vence; o alquimista precisa superá-lo para continuar em
            voo.
          </p>
        )}
        <CheckBox
          label="Confirmo espaço, contato e circunstâncias de voo na cena"
          checked={data.sceneConfirmed}
          onChange={(v) => set("sceneConfirmed", v)}
        />
        <p className="hint">
          Um uso por ativação/turno nesta ferramenta. Não repete consumo ou
          Despertar. Movimentos sem resistência não sorteiam dados. Resolva
          altura, queda e carga com o Narrador ao pousar/encerrar.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="primary"
          type="submit"
          disabled={busy || !data.sceneConfirmed}
        >
          Registrar uso do voo
        </button>
      </form>
    </Modal>
  );
}
