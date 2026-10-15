import { useState } from "react";
import { AlchemyActivation, Character, Campaign } from "../../shared/model";
import { turnKey } from "../../shared/blood-mechanics";
import { UNCONSCIOUS_ENVELOP } from "../../shared/alchemy-effects";
import { FormulaDice, FormulaReroll } from "./LongReach";
import { CheckBox } from "./ui";

export function Envelop({
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
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const target = characters.find(
    (x) => x.id === a.targets.find((key) => key !== c.id),
  );
  const pending = a.formulaTests.some((t) => t.status === "pending");
  async function act(operation: string, testId = "") {
    setBusy(true);
    setError("");
    try {
      await run({
        operation,
        activationId: a.id,
        testId,
        mode: "suffocate",
        sceneConfirmed: confirmed,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wide" aria-label="Usos de Envolver">
      <h4>Envolver · {target?.name || "Alvo indisponível"}</h4>
      <p className="hint">
        −3 dados em detecção visual e ataques à distância. Use o contexto de
        percepção visual nas rolagens; Armas de Fogo e ataques à distância no
        confronto são reconhecidos automaticamente. Dura uma cena ou até
        encerrar. Um alvo por alquimista.
      </p>
      <p className="hint">
        Sufocar um mortal exige Raciocínio + Alquimia contra Vigor +
        Sobrevivência. Vitória restringe a tossir/sufocar; vitória crítica causa
        inconsciência. Não há dano periódico automático. A consciência só é
        recuperada por resolução do Narrador, que remove a condição na ficha.
      </p>
      {edit &&
        a.status === "active" &&
        target?.nature === "mortal" &&
        !target.conditions.includes(UNCONSCIOUS_ENVELOP) &&
        !pending && (
          <>
            <CheckBox
              label="O alvo de Envolver permanece à vista nesta cena"
              checked={confirmed}
              onChange={setConfirmed}
            />
            <button
              className="secondary"
              disabled={
                busy ||
                !confirmed ||
                a.formulaTests.some((t) => t.turn === turnKey(c, campaign))
              }
              onClick={() => act("formulaTest")}
            >
              Testar asfixia de Envolver
            </button>
            <small>
              Uma tentativa por ativação/turno nesta ferramenta; não repete
              Despertar nem consumo.
            </small>
          </>
        )}
      {target?.nature === "vampire" && (
        <p className="callout">
          O alvo vampiro sofre a obstrução visual; a asfixia desta fórmula só se
          aplica a mortais.
        </p>
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
            <strong>Asfixia de Envolver</strong>
            <small>
              {t.status === "pending"
                ? "Dados em revisão; asfixia ainda não aplicada"
                : t.status === "cancelled"
                  ? "Teste cancelado pelo avanço de tempo ou encerramento"
                  : "Asfixia resolvida"}
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
                  onClick={() => act("acceptFormulaTest", t.id)}
                >
                  Aceitar dados e resolver asfixia
                </button>
              </div>
            )}
          </div>
        ))}
    </section>
  );
}
