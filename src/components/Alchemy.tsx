import { useState } from "react";
import { Campaign, Character, Content } from "../../shared/model";
import { ALCHEMY, alchemyMethods } from "../../shared/thin-blood";
import {
  alchemyActionSchema,
  distillationQuality,
  fixatioLimits,
  standardAlchemyFormula,
} from "../../shared/alchemy";
import { FOG, LONG_REACH, ENVELOP, FLIGHT } from "../../shared/alchemy-effects";
import { Flight } from "./Flight";
import { Envelop } from "./Envelop";
import { LongReach } from "./LongReach";
import { evaluate } from "../../shared/rules";
import { CheckBox, Field, Modal } from "./ui";

const statusLabels = {
  pending: "Aguardando Narrador",
  active: "Efeito ativo",
  ended: "Encerrado / resolvido",
};
const operationLabels = {
  prepare: "Preparar fórmula",
  activate: "Ativar preparação",
  resolve: "Resolver ativação",
  move: "Transportar frasco",
  discard: "Descartar preparação",
  end: "Encerrar efeito",
  completeConcentration: "Registrar concentração concluída",
  completeCrafting: "Concluir destilação de três noites",
  rerollDistillation: "Rerrolar destilação",
  acceptDistillation: "Aceitar resultado de destilação",
  formulaTest: "Teste próprio da fórmula",
  rerollFormulaTest: "Rerrolar teste próprio",
  acceptFormulaTest: "Resolver teste próprio",
};
export function Alchemy({
  c,
  catalog,
  characters,
  campaign,
  edit,
  gm,
  run,
  go,
}: {
  c: Character;
  catalog: Content[];
  characters: Character[];
  campaign?: Campaign;
  edit: boolean;
  gm: boolean;
  run: (data: any) => Promise<any>;
  go: (page: string, id?: string) => void;
}) {
  const [modal, setModal] = useState<any>(null);
  const method = c.thinBlood.alchemyMethod;
  const operational =
    !!method && c.disciplines[ALCHEMY] > 0 && c.status === "active";
  if (
    !operational &&
    !c.alchemy.preparations.length &&
    !c.alchemy.activations.some((a) => a.status !== "ended")
  )
    return null;
  const limits = fixatioLimits(c, catalog, "raciocinio"),
    dex = fixatioLimits(c, catalog, "destreza");
  const formulas = catalog.filter(
    (x) =>
      x.kind === "formula" &&
      x.parentId === ALCHEMY &&
      c.powers.includes(x.id) &&
      standardAlchemyFormula(x),
  );
  const open = (
    operation: keyof typeof operationLabels,
    preparationId = "",
    activationId = "",
  ) => setModal({ operation, preparationId, activationId });
  return (
    <section className="panel" aria-label="Preparação e ativação de Alquimia">
      <div className="section-heading">
        <h2>Preparação e ativação de Alquimia</h2>
        {edit && operational && (
          <button className="primary" onClick={() => open("prepare")}>
            Preparar fórmula
          </button>
        )}
      </div>
      <p>
        {alchemyMethods.find((x) => x.value === method)?.label ||
          "Registro anterior de Alquimia"}{" "}
        · Alquimia {c.disciplines[ALCHEMY]}
      </p>
      <p className="hint">
        Destilar custa um Despertar. Ativar paga o custo próprio da fórmula.
        Ingredientes e Ressonância são confirmados na cena. Resultados
        diferentes de 4 sucessos, Críticos Confusos e fórmulas sem automação
        individual aguardam o Narrador após o consumo.
      </p>
      {method === "athanor" && (
        <p className="callout">
          Athanor: pelo menos três turnos de concentração exclusiva. Os
          marcadores de turno reduzem a espera; mudar cena ou noite não comprova
          concentração. A nova ativação encerra o Poder anterior.
        </p>
      )}
      {method === "fixatio" && (
        <p className="callout">
          Fixatio: até {limits.carried} frascos por Raciocínio ou {dex.carried}{" "}
          por Destreza, conforme o critério escolhido; até {limits.stored}{" "}
          armazenados. Role somente no consumo. Equipamento de campo: níveis 1–3
          e −2 dados.
        </p>
      )}
      {method === "calcinatio" && (
        <p className="warning">
          Calcinatio: o Narrador registra um receptáculo humano e mantém sua
          emoção. A ativação bebe nível −1 em unidades de Fome; alimentação
          nociva aplica dano e teste de sobrevivência. Retirar vitae para
          preparações pode envolver Laço ou outras consequências, resolvidas
          pelo Narrador.
        </p>
      )}
      <h3>Preparações disponíveis ({c.alchemy.preparations.length})</h3>
      {!c.alchemy.preparations.length && (
        <p className="hint">
          Nenhuma preparação disponível. Fórmulas adquiridas precisam ser
          destiladas antes do uso.
        </p>
      )}
      {c.alchemy.preparations.map((p) => (
        <div className="list-row" key={p.id}>
          <div>
            <strong>
              {catalog.find((x) => x.id === p.formulaId)?.name || p.formulaId}
            </strong>
            <small>
              {p.location === "body"
                ? `No corpo · ${p.remainingTurns} turno(s) restantes`
                : p.location === "vessel"
                  ? `Receptáculo: ${characters.find((x) => x.id === p.vesselId)?.name || "humano"}`
                  : p.location === "carried"
                    ? "Frasco carregado"
                    : "Frasco armazenado"}
            </small>
            <p className="hint">{p.ingredients}</p>
            {p.formulaId === FLIGHT && (
              <small>
                {p.crafting.nights >= 3
                  ? "Três noites de destilação concluídas pelo Narrador"
                  : "Em destilação: mínimo de três noites, com conclusão do Narrador pendente"}
              </small>
            )}
            {p.distillation && (
              <small>
                {
                  evaluate(p.distillation.normal, p.distillation.hunger, 0)
                    .successes
                }{" "}
                sucessos ·{" "}
                {distillationQuality(
                  evaluate(p.distillation.normal, p.distillation.hunger, 0)
                    .successes,
                )}
              </small>
            )}
            {p.review.original && (
              <small>
                Dados normais anteriores: {p.review.original.normal.join(", ")}{" "}
                · Dados de Fome preservados:{" "}
                {p.review.original.hunger.join(", ") || "nenhum"}
              </small>
            )}
          </div>
          {edit && (
            <div className="row">
              {p.distillation &&
                p.review.state === "open" &&
                !p.review.rerolled &&
                p.distillation.normal.length > 0 &&
                operational && (
                  <button
                    className="secondary"
                    onClick={() => open("rerollDistillation", p.id)}
                  >
                    Rerrolar destilação
                  </button>
                )}
              <button
                className="secondary"
                disabled={
                  !operational ||
                  p.remainingTurns > 0 ||
                  p.location === "stored" ||
                  (p.formulaId === FLIGHT && p.crafting.nights < 3)
                }
                onClick={() => open("activate", p.id)}
              >
                Ativar
              </button>
              {p.method === "fixatio" && (
                <button
                  className="secondary"
                  onClick={() => open("move", p.id)}
                >
                  Transportar
                </button>
              )}
              {gm && p.formulaId === FLIGHT && p.crafting.nights < 3 && (
                <button
                  className="secondary"
                  onClick={() => open("completeCrafting", p.id)}
                >
                  Concluir três noites
                </button>
              )}
              {gm && p.remainingTurns > 0 && (
                <button
                  className="secondary"
                  onClick={() => open("completeConcentration", p.id)}
                >
                  Registrar tempo
                </button>
              )}
              <button
                className="text-button"
                onClick={() => open("discard", p.id)}
              >
                {p.remainingTurns ? "Interromper e descartar" : "Descartar"}
              </button>
            </div>
          )}
        </div>
      ))}
      <h3>Ativações e resoluções</h3>
      {!c.alchemy.activations.length && (
        <p className="hint">Nenhuma ativação registrada.</p>
      )}
      {c.alchemy.activations
        .filter((a, i, all) => a.status !== "ended" || i >= all.length - 10)
        .slice()
        .reverse()
        .map((a) => (
          <div className="list-row alchemy-activation" key={a.id}>
            <div>
              <strong>
                {catalog.find((x) => x.id === a.formulaId)?.name || a.formulaId}
              </strong>
              <small>
                {a.review.state === "open"
                  ? "Revisão dos dados aberta"
                  : statusLabels[a.status]}{" "}
                ·{" "}
                {
                  evaluate(a.distillation.normal, a.distillation.hunger, 0)
                    .successes
                }{" "}
                sucessos
              </small>
              <p className="hint">{a.resolution || a.note}</p>
              {a.review.original && (
                <small>
                  Dados normais anteriores:{" "}
                  {a.review.original.normal.join(", ")} · Dados de Fome
                  preservados: {a.review.original.hunger.join(", ") || "nenhum"}
                </small>
              )}
            </div>
            {edit && a.status !== "ended" && (
              <div className="row">
                {a.review.state === "open" && (
                  <>
                    {!a.review.rerolled && a.distillation.normal.length > 0 && (
                      <button
                        className="secondary"
                        onClick={() => open("rerollDistillation", "", a.id)}
                      >
                        Rerrolar destilação
                      </button>
                    )}
                    <button
                      className="secondary"
                      onClick={() => open("acceptDistillation", "", a.id)}
                    >
                      Aceitar dados da destilação
                    </button>
                  </>
                )}
                {gm &&
                  a.status === "pending" &&
                  a.review.state === "closed" && (
                    <button
                      className="secondary"
                      onClick={() => open("resolve", "", a.id)}
                    >
                      Resolver qualidade e efeito
                    </button>
                  )}
                <button
                  className="text-button"
                  onClick={() => open("end", "", a.id)}
                >
                  Encerrar
                </button>
              </div>
            )}
            {a.formulaId === FLIGHT &&
              (a.status === "active" || a.formulaTests.length > 0) && (
                <Flight {...{ c, a, characters, campaign, edit, run }} />
              )}
            {a.formulaId === ENVELOP &&
              (a.status === "active" || a.formulaTests.length > 0) && (
                <Envelop {...{ c, a, characters, campaign, edit, run }} />
              )}
            {a.formulaId === LONG_REACH &&
              (a.status === "active" || a.formulaTests.length > 0) && (
                <LongReach {...{ c, a, characters, campaign, edit, gm, run }} />
              )}
          </div>
        ))}
      <button
        className="text-button"
        onClick={() => go("library", "basico:274")}
      >
        Consultar custos, tabela e métodos
      </button>
      {modal && (
        <AlchemyDialog
          key={[modal.operation, modal.preparationId, modal.activationId].join(
            ":",
          )}
          {...{ c, catalog, characters, gm, formulas, run }}
          initial={modal}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
function AlchemyDialog({
  c,
  catalog,
  characters,
  gm,
  formulas,
  run,
  initial,
  onClose,
}: {
  c: Character;
  catalog: Content[];
  characters: Character[];
  gm: boolean;
  formulas: Content[];
  run: (data: any) => Promise<any>;
  initial: any;
  onClose: () => void;
}) {
  const preparation = c.alchemy.preparations.find(
    (x) => x.id === initial.preparationId,
  );
  const activation = c.alchemy.activations.find(
    (x) => x.id === initial.activationId,
  );
  const [data, setData] = useState({
    ...alchemyActionSchema.parse(initial),
    reviewDistillation: true,
    tags: activation?.tags || [],
    formulaId:
      preparation?.formulaId || activation?.formulaId || formulas[0]?.id || "",
    rouseCount: 0,
    location: (preparation?.location === "carried" ? "stored" : "carried") as
      "carried" | "stored",
    carryAttribute: preparation?.carryAttribute || "raciocinio",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<any>(null),
    [confirmed, setConfirmed] = useState(false);
  const [tagText, setTagText] = useState(activation?.tags.join(", ") || "");
  const set = (key: string, value: any) =>
    setData((old) => ({ ...old, [key]: value }));
  const formula = catalog.find((x) => x.id === data.formulaId),
    fog = formula?.id === FOG;
  const method =
    preparation?.method || activation?.method || c.thinBlood.alchemyMethod;
  const dice = preparation?.distillation || activation?.distillation;
  return (
    <Modal title={operationLabels[data.operation]} onClose={onClose}>
      <div className="form-grid">
        {data.operation === "completeCrafting" && (
          <section className="wide">
            <p>
              Impulso exige ao menos três noites de destilação. O avanço do
              calendário não comprova trabalho. Confirme a pesquisa já
              concluída, a conclusão da mistura e a origem compatível da gota de
              vitae na ficção. Nenhum custo é repetido.
            </p>
            <CheckBox
              label="Ao menos três noites de destilação foram concluídas"
              checked={data.craftingConfirmed}
              onChange={(v) => set("craftingConfirmed", v)}
            />
            <CheckBox
              label="Pesquisa prévia de ao menos três meses concluída para esta fórmula"
              checked={data.researchConfirmed}
              onChange={(v) => set("researchConfirmed", v)}
            />
            <CheckBox
              label="Gota de vitae de origem compatível confirmada pelo Narrador"
              checked={data.donorConfirmed}
              onChange={(v) => set("donorConfirmed", v)}
            />
            {method === "athanor" && (
              <CheckBox
                label="Concentração exclusiva final de Athanor confirmada"
                checked={data.concentrationConfirmed}
                onChange={(v) => set("concentrationConfirmed", v)}
              />
            )}
            {method === "calcinatio" && (
              <CheckBox
                label="Receptáculo humano disponível e emoção mantida"
                checked={data.vesselEmotionConfirmed}
                onChange={(v) => set("vesselEmotionConfirmed", v)}
              />
            )}
            <p className="hint">
              A fórmula própria não nomeia Disciplina simulada para a
              compatibilidade da gota; registre a decisão do Narrador.
              Athanor/Calcinatio rolam a destilação nesta conclusão; Fixatio, ao
              consumir.
            </p>
          </section>
        )}
        {data.operation === "rerollDistillation" && dice && (
          <section className="wide">
            <p>
              Selecione de um a três dados normais. Custo: um dano superficial
              de Força de Vontade; se a trilha estiver cheia, converte
              superficial em agravado. Dados de Fome e Despertares não são
              rerrolados.
            </p>
            <div
              className="dice-values"
              role="group"
              aria-label="Dados normais da destilação"
            >
              {dice.normal.map((value, index) => (
                <button
                  key={index}
                  className={
                    "die " + (data.indices.includes(index) ? "success" : "")
                  }
                  aria-label={`Selecionar dado normal ${index + 1}, valor ${value}`}
                  aria-pressed={data.indices.includes(index)}
                  disabled={
                    busy ||
                    !!result ||
                    (!data.indices.includes(index) && data.indices.length >= 3)
                  }
                  onClick={() =>
                    set(
                      "indices",
                      data.indices.includes(index)
                        ? data.indices.filter((i) => i !== index)
                        : [...data.indices, index],
                    )
                  }
                >
                  {value}
                </button>
              ))}
            </div>
            <div
              className="dice-values"
              aria-label="Dados de Fome protegidos da destilação"
            >
              {dice.hunger.map((value, index) => (
                <span
                  key={index}
                  className="die hunger"
                  aria-label={`Dado de Fome ${index + 1}, valor ${value}`}
                >
                  {value}
                </span>
              ))}
            </div>
            <p className="hint">
              A destilação só recebe uma operação de rerrolagem. Os dados
              originais ficam no registro; aceitar ou resolver os efeitos
              encerra esta etapa.
            </p>
          </section>
        )}
        {data.operation === "acceptDistillation" && (
          <p className="callout">
            Aceitar conserva os dados e encerra a possibilidade de rerrolar. Um
            resultado normal elegível aplica os efeitos; os demais aguardam a
            resolução do Narrador. Nenhum custo ou consumo é repetido.
          </p>
        )}
        {data.operation === "prepare" && (
          <>
            <Field
              label="Fórmula a preparar"
              value={data.formulaId}
              options={formulas.map((x) => ({
                value: x.id,
                label: `${x.name} · nível ${x.level}`,
              }))}
              onChange={(v) => set("formulaId", v)}
            />
            <Field
              label="Ingredientes, amostras e Ressonância"
              value={data.ingredients}
              type="textarea"
              onChange={(v) => set("ingredients", v)}
            />
            <CheckBox
              label="Vitae própria e sangue humano da Ressonância adequada disponíveis"
              checked={data.ingredientsConfirmed}
              onChange={(v) => set("ingredientsConfirmed", v)}
            />
            {gm && (
              <Field
                label="Qualidade dos ingredientes (−2 a +2 dados)"
                value={data.modifier}
                type="number"
                onChange={(v) => set("modifier", v)}
              />
            )}

            {method === "calcinatio" && (
              <Field
                label="Receptáculo humano"
                value={data.vesselId}
                options={characters
                  .filter(
                    (x) =>
                      x.nature === "mortal" && x.campaignId === c.campaignId,
                  )
                  .map((x) => ({ value: x.id, label: x.name }))}
                onChange={(v) => set("vesselId", v)}
              />
            )}
            {method === "fixatio" && (
              <>
                <CheckBox
                  label="Laboratório e equipamento adequado disponíveis"
                  checked={data.laboratoryConfirmed}
                  onChange={(v) => set("laboratoryConfirmed", v)}
                />
                <CheckBox
                  label="Equipamento de campo (nível máximo 3; −2 dados)"
                  checked={data.fieldEquipment}
                  onChange={(v) => set("fieldEquipment", v)}
                />
              </>
            )}
            <p className="hint">
              Preparar paga um Despertar; Fixatio deixa a rolagem para o
              consumo. Athanor e Calcinatio registram a rolagem agora, exceto
              Impulso, que aguarda conclusão das três noites.
            </p>
          </>
        )}
        {(data.operation === "move" ||
          (data.operation === "prepare" && method === "fixatio")) && (
          <>
            <Field
              label="Local do frasco"
              value={data.location}
              options={[
                { value: "carried", label: "Carregado" },
                { value: "stored", label: "Armazenado no Refúgio" },
              ]}
              onChange={(v) => set("location", v)}
            />
            <Field
              label="Atributo para limite de frascos carregados"
              value={data.carryAttribute}
              options={[
                { value: "raciocinio", label: "Raciocínio" },
                { value: "destreza", label: "Destreza" },
              ]}
              onChange={(v) => set("carryAttribute", v)}
            />
          </>
        )}
        {method === "calcinatio" &&
          ["prepare", "activate"].includes(data.operation) && (
            <>
              <CheckBox
                label="Narrador confirmou o estado emocional mantido no receptáculo"
                checked={data.vesselEmotionConfirmed}
                disabled={!gm}
                onChange={(v) => set("vesselEmotionConfirmed", v)}
              />
              {data.operation === "activate" && (
                <>
                  <CheckBox
                    label="Narrador confirmou alimentação, tempo e consequências para o humano"
                    checked={data.feedingConfirmed}
                    disabled={!gm}
                    onChange={(v) => set("feedingConfirmed", v)}
                  />
                  <Field
                    label="Modo de alimentação"
                    value={data.feedingMode}
                    options={[
                      { value: "safe", label: "Não nociva (até 2 unidades)" },
                      {
                        value: "harmful",
                        label: "Nociva, com dano e teste de sobrevivência",
                      },
                    ]}
                    onChange={(v) => set("feedingMode", v)}
                  />
                  <p className="hint">
                    Bebe {Math.max(0, (formula?.level ?? 1) - 1)} unidade(s) de
                    Fome. Básico PDF 276 remete à página impressa 212; a tabela
                    está na página PDF 188 desta transcrição.
                  </p>
                </>
              )}
            </>
          )}
        {data.operation === "activate" && (
          <>
            {method === "fixatio" && (
              <CheckBox
                label="Revisar dados antes de aplicar os efeitos"
                checked={data.reviewDistillation}
                onChange={(v) => set("reviewDistillation", v)}
              />
            )}
            <p className="callout">
              {formula?.name} · Custo de ativação:{" "}
              {formula?.automation === "unreviewed"
                ? "a conferir pelo Narrador"
                : `${formula?.rouse ?? 0} Despertar(es)`}
              . Destilação já foi paga.
            </p>
            {method === "athanor" && (
              <CheckBox
                label="Três turnos ou mais de concentração exclusiva, sem outras ações"
                checked={data.concentrationConfirmed}
                onChange={(v) => set("concentrationConfirmed", v)}
              />
            )}
            {formula?.id === ENVELOP && (
              <CheckBox
                label="O alvo escolhido de Envolver está à vista"
                checked={data.sceneConfirmed}
                onChange={(v) => set("sceneConfirmed", v)}
              />
            )}
            {fog && (
              <CheckBox
                label="Ampliar Névoa a grupo de até cinco pessoas (+1 Despertar)"
                checked={data.group}
                onChange={(v) => {
                  set("group", v);
                  if (!v) set("targetIds", []);
                }}
              />
            )}
            {formula?.id !== FLIGHT && (!fog || data.group) && (
              <div className="wide">
                <p>
                  Alvos adicionais{" "}
                  {fog
                    ? "(usuário já incluído)"
                    : "(efeitos dirigidos ao alvo)"}
                </p>
                {characters
                  .filter((x) => x.id !== c.id && x.campaignId === c.campaignId)
                  .map((x) => (
                    <CheckBox
                      key={x.id}
                      label={x.name}
                      checked={data.targetIds.includes(x.id)}
                      onChange={(v) =>
                        set(
                          "targetIds",
                          v
                            ? formula?.id === ENVELOP
                              ? [x.id]
                              : [...data.targetIds, x.id]
                            : data.targetIds.filter((key) => key !== x.id),
                        )
                      }
                    />
                  ))}
              </div>
            )}
            {formula?.automation === "unreviewed" && (
              <Field
                label="Despertares de ativação conferidos na fonte"
                value={data.rouseCount}
                type="number"
                onChange={(v) => set("rouseCount", v)}
              />
            )}
            {formula?.attribute && (
              <p className="warning">
                O teste próprio da fórmula ainda exige resolução manual. O
                Narrador deve registrá-lo e informar a margem ao resolver os
                efeitos personalizados.
              </p>
            )}
          </>
        )}
        {data.operation === "resolve" && (
          <>
            <p className="warning">
              {activation &&
                distillationQuality(
                  evaluate(
                    activation.distillation.normal,
                    activation.distillation.hunger,
                    0,
                  ).successes,
                )}
              . Registre a interpretação. A resolução usa o custo e os dados já
              pagos; não realiza novo consumo.
            </p>
            <CheckBox
              label="Aplicar os efeitos cadastrados após a resolução"
              checked={data.applyEffects}
              onChange={(v) => set("applyEffects", v)}
            />
            {fog && (
              <Field
                label="Penalidade de Névoa resolvida pelo Narrador"
                value={data.fogPenalty}
                type="number"
                onChange={(v) => set("fogPenalty", v)}
              />
            )}
            <Field
              label="Duração resolvida, na unidade cadastrada"
              value={data.duration}
              type="number"
              onChange={(v) => set("duration", v)}
            />
            {!fog && (
              <Field
                label="Margem do teste próprio, para efeitos personalizados"
                value={data.effectMargin}
                type="number"
                onChange={(v) => set("effectMargin", v)}
              />
            )}
          </>
        )}
        {(["resolve", "completeConcentration", "completeCrafting"].includes(
          data.operation,
        ) ||
          (data.operation === "activate" &&
            formula?.automation === "unreviewed")) && (
          <CheckBox
            label="Narrador consultou a fonte e confirma a resolução"
            checked={data.narrativeConfirmed}
            disabled={!gm}
            onChange={(v) => set("narrativeConfirmed", v)}
          />
        )}
        {["prepare", "activate"].includes(data.operation) &&
          c.advantages.some(
            (a) => a.contentId === "flaw-dependencia-de-vitae",
          ) && (
            <CheckBox
              label="Narrador confirmou saciedade vampírica na última semana"
              checked={data.dependencyConfirmed}
              disabled={!gm}
              onChange={(v) => set("dependencyConfirmed", v)}
            />
          )}
        {["discard", "end"].includes(data.operation) && (
          <CheckBox
            label="Confirmo o descarte ou encerramento; custos não são devolvidos"
            checked={confirmed}
            onChange={setConfirmed}
          />
        )}
        {["activate", "resolve"].includes(data.operation) && !fog && (
          <Field
            label="Etiquetas das circunstâncias (separadas por vírgulas)"
            value={tagText}
            onChange={(v) => {
              setTagText(v);
              set(
                "tags",
                v
                  .split(",")
                  .map((x: string) => x.trim())
                  .filter(Boolean),
              );
            }}
          />
        )}
        <Field
          label={
            ["rerollDistillation", "acceptDistillation"].includes(
              data.operation,
            )
              ? "Observações (opcional)"
              : "Registro e resolução do Narrador"
          }
          value={data.note}
          type="textarea"
          onChange={(v) => set("note", v)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button
        className="primary"
        disabled={
          busy ||
          !!result ||
          (data.operation === "rerollDistillation" && !data.indices.length) ||
          (["discard", "end"].includes(data.operation) && !confirmed)
        }
        onClick={async () => {
          try {
            setBusy(true);
            setError("");
            const response = await run(data);
            setResult(response.result);
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Registrando…"
          : data.operation === "rerollDistillation"
            ? "Gastar 1 Vontade e rerrolar"
            : "Confirmar operação de Alquimia"}
      </button>
      {result && (
        <div role="status">
          <p className="success-message">{result.message}</p>
          {result.willpowerSpent > 0 && (
            <p>Força de Vontade gasta: {result.willpowerSpent}.</p>
          )}
          {result.review?.original && (
            <p>
              Dados normais originais:{" "}
              {result.review.original.normal.join(", ")}.
            </p>
          )}
          {result.distillation && (
            <>
              <p>
                {result.distillation.successes} sucessos de destilação ·{" "}
                {result.quality}
              </p>
              <div className="dice-values">
                {result.distillation.normal.map((v: number, i: number) => (
                  <span className="die" key={i}>
                    {v}
                  </span>
                ))}
                {result.distillation.hunger.map((v: number, i: number) => (
                  <span className="die hunger" key={"h" + i}>
                    {v}
                  </span>
                ))}
              </div>
            </>
          )}
          {result.rouses?.map((r: any, i: number) => (
            <p key={i}>
              Despertar {i + 1}: {r.dice.join(", ")} ·{" "}
              {r.success ? "Sucesso" : "Falha"} · Fome {r.hunger}
              {r.frenzy ? " · Teste de Frenesi de Fome requerido" : ""}
            </p>
          ))}
          {result.feeding && (
            <p>
              Alimentação: {result.feeding.amount} unidade(s) ·{" "}
              {result.feeding.time}{" "}
              {result.feeding.survival &&
                `· Sobrevivência: ${result.feeding.survival.label}`}
            </p>
          )}
          {result.feeding?.message && (
            <p className="warning">{result.feeding.message}</p>
          )}
          <button className="secondary" onClick={onClose}>
            Fechar resultado
          </button>
        </div>
      )}
    </Modal>
  );
}
