import { Character, Content } from "../../shared/model";
import {
  ALCHEMY,
  alchemyMethods,
  hasTrait,
  thinBloodTraits,
} from "../../shared/thin-blood";
import { Field, CheckBox } from "./ui";
export function ThinBloodProfile({
  c,
  catalog,
  edit,
  gm,
  onChange,
  notify,
  go,
}: {
  c: Character;
  catalog: Content[];
  edit: boolean;
  gm: boolean;
  onChange: (value: Character) => void;
  notify: (s: string) => void;
  go: (page: string, id?: string) => void;
}) {
  const draft = c.status === "draft",
    traits = thinBloodTraits(c, catalog),
    choice = c.thinBlood;
  const update = (key: string, value: string) =>
    onChange({
      ...c,
      thinBlood: {
        ...choice,
        [key]: value,
        ...(key === "affinityDiscipline" ? { affinityPower: "" } : {}),
      },
    });
  const clan = catalog.find((e) => e.id === choice.clanCurse);
  return (
    <section className="panel">
      <h2>Características de Sangue-Ralo</h2>
      <p className="hint">
        Básico PDF 128,159–160: escolha uma a três Qualidades e o mesmo número
        de Defeitos. Cada característica é uma escolha sem custo; o orçamento
        comum continua em sete Vantagens e dois Defeitos. As concessões iniciais
        são aplicadas ao concluir a ficha.
      </p>
      {!draft && gm && (
        <p className="warning">
          Ajustes do Narrador não reaplicam concessões iniciais. Confira os
          pontos, Poderes e XP na ficha. O método aprendido não pode ser
          substituído por outro.
        </p>
      )}
      <p>
        {traits.filter((t) => t.entry?.kind === "merit").length} Qualidades ·{" "}
        {traits.filter((t) => t.entry?.kind === "flaw").length} Defeitos de
        Sangue-Ralo
      </p>
      {(draft || gm) && (
        <div className="combat-grid">
          {["merit", "flaw"].map((kind) => (
            <div key={kind}>
              <h3>
                {kind === "merit"
                  ? "Qualidades sem custo"
                  : "Defeitos sem custo"}
              </h3>
              {catalog
                .filter((e) => e.category === "Sangue-Ralo" && e.kind === kind)
                .map((e) => {
                  const selected = hasTrait(c, e.id);
                  return (
                    <div key={e.id}>
                      <CheckBox
                        label={e.name}
                        checked={selected}
                        disabled={
                          !edit ||
                          (draft &&
                            !selected &&
                            traits.filter((t) => t.entry?.kind === kind)
                              .length >= 3)
                        }
                        onChange={(checked) => {
                          if (
                            checked &&
                            catalog.some(
                              (other) =>
                                hasTrait(c, other.id) &&
                                (e.incompatible.includes(other.id) ||
                                  other.incompatible.includes(e.id)),
                            )
                          ) {
                            notify(
                              "Características incompatíveis. Consulte a referência antes de alterar a escolha.",
                            );
                            return;
                          }
                          onChange({
                            ...c,
                            advantages: checked
                              ? [
                                  ...c.advantages,
                                  {
                                    contentId: e.id,
                                    level: 1,
                                    source: draft ? "creation" : "manual",
                                    notes: "",
                                  },
                                ]
                              : c.advantages.filter(
                                  (a) => a.contentId !== e.id,
                                ),
                            thinBlood: {
                              ...choice,
                              ...(draft &&
                              !checked &&
                              e.id === "merit-afinidade-de-disciplina"
                                ? { affinityDiscipline: "", affinityPower: "" }
                                : {}),
                              ...(draft &&
                              !checked &&
                              e.id === "merit-alquimia-sangue-ralo"
                                ? {
                                    alchemyMethod: "" as const,
                                    initialFormula: "",
                                  }
                                : {}),
                              ...(draft &&
                              !checked &&
                              e.id === "flaw-maldicao-de-cla"
                                ? { clanCurse: "" }
                                : {}),
                            },
                          });
                        }}
                      />
                      <small>{e.description}</small>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      )}
      <div className="form-grid">
        {hasTrait(c, "merit-afinidade-de-disciplina") && (
          <>
            <Field
              label="Disciplina de Afinidade"
              value={choice.affinityDiscipline}
              disabled={!edit || (!draft && !gm)}
              options={catalog
                .filter((e) => e.kind === "discipline" && e.id !== ALCHEMY)
                .map((e) => ({ value: e.id, label: e.name }))}
              onChange={(v) => update("affinityDiscipline", v)}
            />
            <Field
              label="Poder inicial de Afinidade"
              value={choice.affinityPower}
              disabled={!edit || (!draft && !gm)}
              options={catalog
                .filter(
                  (e) =>
                    e.kind === "power" &&
                    e.parentId === choice.affinityDiscipline &&
                    e.level === 1,
                )
                .map((e) => ({ value: e.id, label: e.name }))}
              onChange={(v) => update("affinityPower", v)}
            />
          </>
        )}
        {(hasTrait(c, "merit-alquimia-sangue-ralo") ||
          (c.disciplines[ALCHEMY] ?? 0) > 0) && (
          <>
            <Field
              label="Método inicial de destilação"
              value={choice.alchemyMethod}
              disabled={!edit || (!draft && (!gm || !!choice.alchemyMethod))}
              options={alchemyMethods}
              onChange={(v) => update("alchemyMethod", v)}
            />
            {hasTrait(c, "merit-alquimia-sangue-ralo") && (
              <Field
                label="Fórmula inicial de Alquimia"
                value={choice.initialFormula}
                disabled={!edit || (!draft && !gm)}
                options={catalog
                  .filter(
                    (e) =>
                      e.kind === "formula" &&
                      e.parentId === ALCHEMY &&
                      e.level === 1,
                  )
                  .map((e) => ({ value: e.id, label: e.name }))}
                onChange={(v) => update("initialFormula", v)}
              />
            )}
          </>
        )}
        {hasTrait(c, "flaw-maldicao-de-cla") && (
          <Field
            label="Perdição escolhida para Maldição de Clã"
            value={choice.clanCurse}
            disabled={!edit || (!draft && !gm)}
            options={catalog
              .filter(
                (e) =>
                  ["clan", "lineage"].includes(e.kind) &&
                  !["clan-caitiff", "clan-sangue-ralo"].includes(e.id),
              )
              .map((e) => ({ value: e.id, label: e.name }))}
            onChange={(v) => update("clanCurse", v)}
          />
        )}
      </div>
      {clan && hasTrait(c, "flaw-maldicao-de-cla") && (
        <div className="callout">
          <strong>Perdição de {clan.name} · Gravidade 1</strong>
          <p>
            {clan.bane ||
              "Consulte a Perdição na fonte do Clã. As exceções específicas permanecem narrativas."}
          </p>
          <p>Esta escolha não concede a Compulsão do Clã.</p>
        </div>
      )}
      {(hasTrait(c, "merit-alquimia-sangue-ralo") ||
        (c.disciplines[ALCHEMY] ?? 0) > 0) && (
        <p className="warning">
          Método, níveis, fórmulas e preparações são persistentes. Use
          Preparação e ativação de Alquimia na aba Sangue. Ingredientes e
          resultados não definidos pela tabela exigem resolução do Narrador.
          Métodos adicionais contam como Disciplinas separadas e ainda não têm
          aquisição automática. Consulte Básico PDF 274–277.
        </p>
      )}
      {hasTrait(c, "flaw-dependencia-de-vitae") && (
        <p className="warning">
          Dependência de Vitae: o Narrador confirma a saciedade vampírica da
          última semana antes do uso ou evolução de Disciplinas. Calendário
          automático dessa dependência e desativação de poderes passivos ainda
          são pendentes.
        </p>
      )}
      <button
        className="text-button"
        onClick={() => go("library", "basico:159")}
      >
        Consultar características e restrições
      </button>
    </section>
  );
}
