import { useState } from "react";
import { Swords, Plus } from "lucide-react";
import { Field, CheckBox, Empty, Modal } from "../components/ui";
import { send } from "../api";
import { PageProps } from "../types";
import { attributes, skills, labels, Character } from "../../shared/model";
import { DiceView } from "./Characters";
const techniques = [
  ["strike", "Ataque / conflito"],
  ["grapple", "Agarrar"],
  ["hold", "Manter agarramento"],
  ["crush", "Causar dano no agarramento"],
  ["bite", "Morder"],
  ["escape", "Escapar do agarramento"],
  ["stake", "Estaquear no coração"],
  ["release", "Soltar alvo"],
].map(([value, label]) => ({ value, label }));
const sources = [
  ["manual", "Tipo definido pelo Narrador"],
  ["blunt", "Contundente leve"],
  ["heavyBlunt", "Contundente pesado"],
  ["piercing", "Corte / perfuração"],
  ["gunshot", "Projétil"],
  ["fire", "Fogo"],
  ["supernatural", "Agravado sobrenatural"],
].map(([value, label]) => ({ value, label }));
const cover = [
  [-2, "Sem cobertura (−2)"],
  [-1, "Encobrimento (−1)"],
  [0, "Cobertura dura (0)"],
  [1, "Entrincheirado (+1)"],
  [2, "Fenda protegida (+2)"],
].map(([value, label]) => ({ value: String(value), label: String(label) }));
export default function Combat({ state, refresh, notify, go }: PageProps) {
  const [data, setData] = useState<any>({
    a: "",
    b: "",
    attributeA: "forca",
    skillA: "briga",
    attributeB: "forca",
    skillB: "briga",
    modifierA: 0,
    modifierB: 0,
    tagsA: "",
    tagsB: "",
    weaponA: 0,
    weaponB: 0,
    weaponItemA: "",
    weaponItemB: "",
    armorItemA: "",
    armorItemB: "",
    sourceA: "manual",
    sourceB: "manual",
    social: false,
    unilateral: false,
    aggravated: false,
    technique: "strike",
    calledPenaltyA: 0,
    calledPenaltyB: 0,
    rangedA: false,
    rangedB: false,
    coverA: 0,
    coverB: 0,
    fullDefenseB: false,
    successiveDefenseA: 0,
    successiveDefenseB: 0,
    staticDefense: false,
    difficulty: 1,
    lethalBody: false,
    recordId: "",
    mixedOrderA: "aggravatedFirst",
    mixedOrderB: "aggravatedFirst",
    note: "",
  });
  const [mode, setMode] = useState("exchanges"),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [editor, setEditor] = useState({
      name: "",
      campaignId: "",
      participants: [] as string[],
      description: "",
    }),
    [party, setParty] = useState<string[]>([]),
    [difficulty, setDifficulty] = useState(4),
    [singleAttribute, setSingleAttribute] = useState("forca"),
    [singleSkill, setSingleSkill] = useState("briga"),
    [singleModifier, setSingleModifier] = useState(0),
    [singleTags, setSingleTags] = useState("");
  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));
  const gmChars = state.characters.filter((c) => c.isGM),
    records = state.records.filter(
      (r) => r.kind === "combat" && r.isGM && r.status !== "Encerrado",
    ),
    record = records.find((r) => r.id === data.recordId),
    chars = record
      ? gmChars.filter((c) => record.participants.includes(c.id))
      : gmChars,
    options = chars.map((c) => ({
      value: c.id,
      label: c.name + " · " + (c.nature === "mortal" ? "Mortal" : "Vampiro"),
    }));
  function equipment(c: Character | undefined, kind: string) {
    return (c?.inventory ?? [])
      .filter(
        (i) =>
          i.equipped &&
          state.content.find((e) => e.id === i.contentId)?.equipmentType ===
            kind,
      )
      .map((i) => ({
        value: i.id,
        label:
          state.content.find((e) => e.id === i.contentId)?.name ??
          "Equipamento",
      }));
  }
  async function resolve() {
    try {
      setBusy(true);
      setResult(null);
      const r =
        mode === "single"
          ? await send("/combat/one-roll", {
              difficulty,
              social: data.social,
              aggravated: data.aggravated,
              recordId: data.recordId,
              note: data.note,
              participants: party.map((id) => ({
                id,
                attribute: singleAttribute,
                skill: singleSkill,
                modifier: singleModifier,
                tags: singleTags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })),
            })
          : await send("/combat", {
              ...data,
              tagsA: data.tagsA
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
              tagsB: data.tagsB
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
            });
      setResult(r);
      await refresh();
      if (mode === "single" && data.recordId) {
        set("recordId", "");
        setParty([]);
        notify(
          "Confronto encerrado; recursos e estados das fichas atualizados.",
        );
      } else
        notify(
          "Conflito registrado; recursos e estados das fichas atualizados.",
        );
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">QUANDO AS VONTADES COLIDEM</span>
          <h1>Combate e Conflitos</h1>
          <p>
            Declare ações, resolva oposição e acompanhe os efeitos nas fichas.
          </p>
        </div>
        <Swords size={36} />
      </header>
      <div className="callout">
        <p>
          As trocas usam margem e bônus de arma. Agarrar restringe sem dano;
          mordida direta subtrai um sucesso e causa exatamente dois agravados ao
          vencer. O Narrador avança os turnos pela campanha. “Conflito de Uma
          Rolagem” é uma regra opcional do Básico PDF 292. Contundente pesado
          contra mortal é agravado no Companion; na versão Básico, selecione
          tipo definido pelo Narrador para resolver a ambiguidade da fonte.
        </p>
        <button
          className="text-button"
          onClick={() => go("library", "basico:294")}
        >
          Consultar procedimentos de combate
        </button>
      </div>
      <section className="panel">
        <div className="row">
          <Field
            label="Confronto ativo"
            value={data.recordId}
            options={records.map((r) => ({ value: r.id, label: r.name }))}
            onChange={(v) => {
              setData((d: any) => ({ ...d, recordId: v, a: "", b: "" }));
              setParty([]);
              setResult(null);
            }}
          />
          {state.campaigns.some((c) => c.isGM) && (
            <button
              className="secondary"
              onClick={() => {
                setEditor({
                  name: "",
                  campaignId: state.campaigns.find((c) => c.isGM)!.id,
                  participants: [],
                  description: "",
                });
                setCreating(true);
              }}
            >
              <Plus size={15} />
              Criar confronto
            </button>
          )}
          {record && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await send(
                    "/entities/" + record.id,
                    { ...record, status: "Encerrado" },
                    "PUT",
                  );
                  await refresh();
                  set("recordId", "");
                  notify(
                    "Confronto encerrado. Agarramentos persistentes devem ser resolvidos pelo Narrador.",
                  );
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              Encerrar confronto
            </button>
          )}
        </div>
        {record?.description && <p>{record.description}</p>}
        <Field
          label="Procedimento"
          value={mode}
          options={[
            { value: "exchanges", label: "Trocas de conflito / técnicas" },
            { value: "single", label: "Opcional · Conflito de Uma Rolagem" },
          ]}
          onChange={(v) => {
            setMode(v);
            setResult(null);
          }}
        />
      </section>
      {!chars.length ? (
        <Empty
          title="Adicione participantes"
          detail="O Narrador precisa ter acesso às fichas. Selecione um confronto com participantes ou cadastre personagens."
        />
      ) : (
        <section className="panel">
          {mode === "exchanges" ? (
            <>
              <Field
                label="Ação declarada"
                value={data.technique}
                options={techniques}
                onChange={(v) =>
                  setData((d: any) => ({
                    ...d,
                    technique: v,
                    social: false,
                    unilateral: v !== "strike",
                    calledPenaltyA: 0,
                    calledPenaltyB: 0,
                  }))
                }
              />
              <div className="combat-grid">
                {["A", "B"].map((side, i) => {
                  const c = chars.find((c) => c.id === data[i ? "b" : "a"]);
                  return (
                    <div key={side}>
                      <h2>{i ? "Oposição" : "Participante ativo"}</h2>
                      <Field
                        label={"Participante " + side}
                        value={data[i ? "b" : "a"]}
                        options={options}
                        onChange={(v) =>
                          setData((d: any) => ({
                            ...d,
                            [i ? "b" : "a"]: v,
                            ["weaponItem" + side]: "",
                            ["armorItem" + side]: "",
                          }))
                        }
                      />
                      {c?.grappledBy && (
                        <p className="warning">
                          Agarrado por{" "}
                          {state.characters.find((x) => x.id === c.grappledBy)
                            ?.name ?? "outro participante"}
                          .
                        </p>
                      )}
                      <div className="form-grid">
                        <Field
                          label={"Arma equipada " + side}
                          value={data["weaponItem" + side]}
                          options={equipment(c, "weapon")}
                          onChange={(v) => {
                            const item = c?.inventory.find((x) => x.id === v),
                              e = state.content.find(
                                (e) => e.id === item?.contentId,
                              );
                            setData((d: any) => ({
                              ...d,
                              ["weaponItem" + side]: v,
                              ...(e
                                ? {
                                    ["weapon" + side]: e.damage,
                                    ["source" + side]: e.damageSource,
                                    ["ranged" + side]:
                                      e.damageSource === "gunshot",
                                  }
                                : {}),
                            }));
                          }}
                        />
                        <Field
                          label={"Armadura equipada " + side}
                          value={data["armorItem" + side]}
                          options={equipment(c, "armor")}
                          onChange={(v) => set("armorItem" + side, v)}
                        />
                        {(c?.nature === "mortal" ||
                          (c?.generation ?? 0) >= 14) && (
                          <Field
                            label={"Ordem para dano misto " + side}
                            value={data["mixedOrder" + side]}
                            options={[
                              {
                                value: "aggravatedFirst",
                                label:
                                  "Critério do Narrador · agravado primeiro",
                              },
                              {
                                value: "superficialFirst",
                                label:
                                  "Critério do Narrador · superficial primeiro",
                              },
                            ]}
                            onChange={(v) => set("mixedOrder" + side, v)}
                          />
                        )}
                        <Field
                          label={"Atributo " + side}
                          value={data["attribute" + side]}
                          options={attributes.map((value) => ({
                            value,
                            label: labels[value],
                          }))}
                          onChange={(v) => set("attribute" + side, v)}
                        />
                        <Field
                          label={"Perícia " + side}
                          value={data["skill" + side]}
                          options={skills.map((value) => ({
                            value,
                            label: labels[value],
                          }))}
                          onChange={(v) => set("skill" + side, v)}
                        />
                        <Field
                          label={"Modificador de dados " + side}
                          type="number"
                          value={data["modifier" + side]}
                          onChange={(v) => set("modifier" + side, v)}
                        />
                        <Field
                          label={"Bônus de dano " + side}
                          type="number"
                          value={data["weapon" + side]}
                          onChange={(v) => set("weapon" + side, v)}
                        />
                        <Field
                          label={"Etiquetas de circunstância " + side}
                          value={data["tags" + side]}
                          onChange={(v) => set("tags" + side, v)}
                        />
                        <Field
                          label={"Fonte do dano " + side}
                          value={data["source" + side]}
                          options={sources}
                          onChange={(v) => set("source" + side, v)}
                        />
                        <Field
                          label={
                            "Sucessos subtraídos por alvo específico " + side
                          }
                          type="number"
                          value={data["calledPenalty" + side]}
                          onChange={(v) => set("calledPenalty" + side, v)}
                        />
                        <Field
                          label={"Defesas sucessivas já realizadas " + side}
                          type="number"
                          value={data["successiveDefense" + side]}
                          onChange={(v) => set("successiveDefense" + side, v)}
                        />
                        <CheckBox
                          label={"Ataque à distância " + side}
                          checked={data["ranged" + side]}
                          onChange={(v) => set("ranged" + side, v)}
                        />
                        <Field
                          label={"Cobertura " + side}
                          value={String(data["cover" + side])}
                          options={cover}
                          onChange={(v) => set("cover" + side, Number(v))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="row">
                <CheckBox
                  label="Unilateral (oposição só se defende)"
                  checked={data.unilateral}
                  onChange={(v) => set("unilateral", v)}
                />
                <CheckBox
                  label="Defesa total da oposição (+1 dado)"
                  checked={data.fullDefenseB}
                  onChange={(v) => set("fullDefenseB", v)}
                />
                <CheckBox
                  label="Defesa estática (surpresa ou alvo imóvel)"
                  checked={data.staticDefense}
                  onChange={(v) =>
                    setData((d: any) => ({
                      ...d,
                      staticDefense: v,
                      unilateral: v || d.unilateral,
                    }))
                  }
                />
                <CheckBox
                  label="Corpo Letal: usar agravado desarmado contra mortal"
                  checked={data.lethalBody}
                  onChange={(v) => set("lethalBody", v)}
                />
              </div>
              {data.staticDefense && (
                <Field
                  label="Dificuldade estática"
                  type="number"
                  value={data.difficulty}
                  onChange={(v) => set("difficulty", v)}
                />
              )}
              <p className="hint">
                Agarramentos e mordidas usam Força + Briga; a continuação exige
                avançar o turno. Estaqueamento subtrai dois sucessos e exige
                cinco danos antes da divisão. A arma selecionada fornece bônus e
                fonte; sem arma, use os campos definidos pelo Narrador. Escolha
                uma armadura aplicável, sem somar proteções.
              </p>
            </>
          ) : (
            <>
              <p className="warning">
                Opcional: a oposição não rola. O dano de cada participante é
                duas vezes a dificuldade menos seus sucessos, com mínimo zero.
                Superficial não é dividido; armadura e Fortitude não reduzem o
                dano. Surto e rerrolagem de Vontade não são permitidos neste
                procedimento.
              </p>
              <div className="check-grid">
                {chars.map((c) => (
                  <CheckBox
                    key={c.id}
                    label={c.name}
                    checked={party.includes(c.id)}
                    onChange={(v) =>
                      setParty((p) =>
                        v ? [...p, c.id] : p.filter((x) => x !== c.id),
                      )
                    }
                  />
                ))}
              </div>
              <div className="form-grid">
                <Field
                  label="Dificuldade da oposição"
                  type="number"
                  value={difficulty}
                  onChange={setDifficulty}
                />
                <Field
                  label="Atributo do grupo"
                  value={singleAttribute}
                  options={attributes.map((value) => ({
                    value,
                    label: labels[value],
                  }))}
                  onChange={setSingleAttribute}
                />
                <Field
                  label="Perícia do grupo"
                  value={singleSkill}
                  options={skills.map((value) => ({
                    value,
                    label: labels[value],
                  }))}
                  onChange={setSingleSkill}
                />
                <Field
                  label="Modificador do grupo"
                  type="number"
                  value={singleModifier}
                  onChange={setSingleModifier}
                />
                <Field
                  label="Etiquetas de circunstância do grupo"
                  value={singleTags}
                  onChange={setSingleTags}
                />
              </div>
            </>
          )}
          <div className="row">
            <CheckBox
              label="Conflito social (Força de Vontade)"
              checked={data.social}
              onChange={(v) =>
                setData((d: any) => ({
                  ...d,
                  social: v,
                  technique: "strike",
                  lethalBody: false,
                  staticDefense: false,
                  rangedA: false,
                  rangedB: false,
                  fullDefenseB: false,
                  successiveDefenseA: 0,
                  successiveDefenseB: 0,
                  weaponItemA: "",
                  weaponItemB: "",
                }))
              }
            />
            <CheckBox
              label="Agravado quando o tipo for definido pelo Narrador"
              checked={data.aggravated}
              onChange={(v) => set("aggravated", v)}
            />
          </div>
          <p className="hint">
            Etiquetas separadas por vírgula ativam os efeitos condicionais
            cadastrados. “combate” é automática; nas trocas, um alvo mortal
            também recebe “alvoMortal”. Outras circunstâncias são confirmadas
            pelo Narrador.
          </p>
          <Field
            label="Apostas, circunstâncias e resolução narrativa"
            type="textarea"
            value={data.note}
            onChange={(v) => set("note", v)}
          />
          <button
            className="primary"
            disabled={
              busy ||
              (mode === "single"
                ? !party.length
                : !data.a || !data.b || data.a === data.b)
            }
            onClick={resolve}
          >
            {busy ? "Resolvendo…" : "Resolver conflito"}
          </button>
        </section>
      )}
      {result && (
        <section className="panel">
          <h2>Resolução</h2>
          {result.results ? (
            <>
              <p>
                {result.victories} de {result.participants} participantes
                venceram.
              </p>
              {result.results.map((r: any) => (
                <article key={r.id}>
                  <h3>{r.name}</h3>
                  <DiceView result={r.result} />
                  <p>Dano aplicado sem divisão: {r.damage}</p>
                  {r.report.consequence && (
                    <p className="warning">{r.report.consequence}</p>
                  )}
                </article>
              ))}
            </>
          ) : (
            <>
              <p>{result.message}</p>
              <div className="combat-grid">
                {["a", "b"].map((side, i) => {
                  const report = result.reports?.[i ? "toB" : "toA"];
                  return (
                    <div key={side}>
                      <h3>{chars.find((c) => c.id === data[side])?.name}</h3>
                      <DiceView result={result[side]} />
                      {result[side]?.successPenalty > 0 && (
                        <p>
                          Após subtrair {result[side].successPenalty}{" "}
                          sucesso(s): {result[side].netSuccesses}.
                        </p>
                      )}
                      <p>
                        Dano recebido antes da redução:{" "}
                        {result.damage[i ? "toB" : "toA"]}
                      </p>
                      {report && (
                        <p>
                          Após reduções: {report.superficial} superficial e{" "}
                          {report.aggravated} agravado · Armadura converteu{" "}
                          {report.converted}; Rigidez reduziu {report.reduction}
                          .
                        </p>
                      )}
                      {report?.mixed && (
                        <p className="warning">
                          Dano misto: a fonte não define a ordem ao preencher a
                          trilha. Aplicado{" "}
                          {report.order === "aggravatedFirst"
                            ? "agravado primeiro"
                            : "superficial primeiro"}
                          , conforme o critério selecionado.
                        </p>
                      )}
                      {report?.consequence && (
                        <p className="warning">{report.consequence}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}
      {creating && (
        <Modal title="Criar confronto" onClose={() => setCreating(false)}>
          <Field
            label="Nome do confronto"
            value={editor.name}
            onChange={(v) => setEditor((p) => ({ ...p, name: v }))}
          />
          <Field
            label="Campanha do confronto"
            value={editor.campaignId}
            options={state.campaigns
              .filter((c) => c.isGM)
              .map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) =>
              setEditor((p) => ({ ...p, campaignId: v, participants: [] }))
            }
          />
          <Field
            label="Apostas do confronto"
            type="textarea"
            value={editor.description}
            onChange={(v) => setEditor((p) => ({ ...p, description: v }))}
          />
          <p>Participantes</p>
          {gmChars
            .filter((c) => c.campaignId === editor.campaignId)
            .map((c) => (
              <CheckBox
                key={c.id}
                label={c.name}
                checked={editor.participants.includes(c.id)}
                onChange={(v) =>
                  setEditor((p) => ({
                    ...p,
                    participants: v
                      ? [...p.participants, c.id]
                      : p.participants.filter((x) => x !== c.id),
                  }))
                }
              />
            ))}
          <button
            className="primary"
            disabled={
              !editor.name.trim() || !editor.participants.length || busy
            }
            onClick={async () => {
              try {
                setBusy(true);
                const r = await send("/entities/records", {
                  ...editor,
                  kind: "combat",
                  status: "Em andamento",
                });
                await refresh();
                setData((d: any) => ({ ...d, recordId: r.id, a: "", b: "" }));
                setParty([]);
                setCreating(false);
                notify("Confronto persistente criado.");
              } catch (e: any) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Salvar confronto
          </button>
        </Modal>
      )}
    </>
  );
}
